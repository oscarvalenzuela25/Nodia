import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { CheckModuleAccessUseCase } from '../../authorization/use-case/check-module-access.use-case.js';

const leaseDuration = 30_000;
const maxAttempts = 3;
const batchSize = 64;

export interface WebPushDeliveryClaim {
  id: string;
  leaseToken: string;
}

export interface ArmedWebPushDelivery extends WebPushDeliveryClaim {
  userId: string;
  installationId: string;
  keyId: string;
  ciphertext: string;
  notificationId: string;
  businessId: string;
  expiresAt: Date;
  attemptCount: number;
}

export interface WebPushDeliveryResult {
  state: 'accepted' | 'retry' | 'failed' | 'expired' | 'unknown';
  reason: string;
  httpStatus?: number;
  nextAttemptAt?: Date;
}

interface LeasedDelivery {
  business_id: string;
  provider_id: string;
  contact_id: string;
  visit_date: string;
  user_id: string;
  installation_id: string;
  source_revision: string;
  installation_revision: number;
  attempt_count: number;
}

interface VisitWindow {
  source_revision: string;
  send_at: Date;
  expires_at: Date;
}

interface RecipientInstallation {
  revision: number;
  key_id: string;
  subscription_ciphertext: string;
  expires_at: Date | null;
}

// The queue is updated in the same transaction as activity, scope and agenda changes.
const visitSources = `
  JOIN provider_visit_planning_queue queue
    ON queue.provider_id=visit.provider_id AND queue.source_revision=visit.source_revision
  JOIN businesses business ON business.id=visit.business_id AND business.is_active=true
  JOIN providers provider ON provider.id=visit.provider_id
    AND provider.business_id=visit.business_id AND provider.is_active=true
  JOIN personal_info_provider contact ON contact.id=visit.contact_id
    AND contact.provider_id=visit.provider_id AND contact.is_active=true`;

// Opt-in and explicit relationship always apply, including for super_admin.
const recipientEligibility = `
  JOIN users account ON account.id=preference.user_id AND account.is_active=true
  JOIN web_push_installations installation
    ON installation.user_id=preference.user_id AND installation.state='active'
  JOIN auth_sessions session ON session.public_id=installation.session_id
    AND session.user_id=installation.user_id AND session.revoked_at IS NULL`;

const explicitRelationship = `(
  business.owner_id=preference.user_id OR EXISTS (
    SELECT 1 FROM business_collaborators collaborator
    WHERE collaborator.business_id=business.id AND collaborator.user_id=preference.user_id
      AND collaborator.is_active=true
  )
)`;

const revisable = `(
  delivery.state IN ('pending', 'retry') OR (
    delivery.state='expired' AND delivery.attempt_count=0
  ) OR (
    delivery.state='cancelled' AND delivery.last_reason IN ('source_changed', 'installation_changed')
  )
)`;

@Injectable()
export class WebPushDeliveryStore {
  constructor(
    private readonly source: DataSource,
    private readonly modules: CheckModuleAccessUseCase,
  ) {}

  async prepare({ now, keyId }: { now: Date; keyId: string | null }): Promise<void> {
    await this.source.transaction(async (manager) => {
      await manager.query("SET LOCAL statement_timeout = '5s'");
      await manager.query("SET LOCAL lock_timeout = '2s'");
      await this.recoverAndPrune(manager, now);
      if (keyId !== null) await this.materialize(manager, now, keyId);
    });
  }

  claim(now: Date): Promise<WebPushDeliveryClaim | null> {
    return this.source.transaction(async (manager) => {
      await manager.query("SET LOCAL statement_timeout = '5s'");
      await manager.query("SET LOCAL lock_timeout = '2s'");
      const [claim]: WebPushDeliveryClaim[] = await manager.query(
        `WITH ready AS (
           SELECT id FROM provider_visit_deliveries
           WHERE state IN ('pending','retry') AND next_attempt_at <= $1 AND expires_at > $1
           ORDER BY next_attempt_at, id LIMIT 1 FOR UPDATE SKIP LOCKED
         ), claimed AS (
           UPDATE provider_visit_deliveries delivery
           SET state='leased', next_attempt_at=NULL, lease_token=gen_random_uuid(),
               lease_expires_at=$2, updated_at=$1
           FROM ready WHERE delivery.id=ready.id
           RETURNING delivery.id, delivery.lease_token AS "leaseToken"
         ) SELECT * FROM claimed`,
        [now, new Date(now.getTime() + leaseDuration)],
      );
      return claim ?? null;
    });
  }

  async arm(
    claim: WebPushDeliveryClaim,
    keyId: string,
    now: Date,
  ): Promise<ArmedWebPushDelivery | null> {
    return this.source.transaction(async (manager) => {
      await lockAuthority(manager);
      const [delivery]: LeasedDelivery[] = await manager.query(
        `SELECT business_id, provider_id, contact_id, visit_date::text, user_id,
                installation_id, source_revision, installation_revision, attempt_count
         FROM provider_visit_deliveries
         WHERE id=$1 AND lease_token=$2 AND state='leased' AND lease_expires_at > $3
         FOR UPDATE`,
        [claim.id, claim.leaseToken, now],
      );
      if (!delivery) return null;

      const visit = await this.currentVisit(manager, delivery);
      if (!visit || visit.source_revision !== delivery.source_revision || visit.send_at > now)
        return this.closeLease(manager, claim, now, 'cancelled', 'source_changed');
      if (visit.expires_at <= now)
        return this.closeLease(manager, claim, now, 'expired', 'expired');
      if (delivery.attempt_count >= maxAttempts)
        return this.closeLease(manager, claim, now, 'failed', 'retry_limit');

      const installation = await this.currentInstallation(manager, delivery, keyId, now);
      if (!installation)
        return this.closeLease(manager, claim, now, 'cancelled', 'recipient_ineligible');
      if (installation.revision !== delivery.installation_revision)
        return this.closeLease(manager, claim, now, 'cancelled', 'installation_changed');

      try {
        await this.modules.execute(delivery.user_id, ['/business'], manager);
      } catch (error) {
        if (error instanceof ForbiddenException || error instanceof UnauthorizedException)
          return this.closeLease(manager, claim, now, 'cancelled', 'recipient_ineligible');
        throw error;
      }

      const expiration = installation.expires_at && installation.expires_at < visit.expires_at
        ? installation.expires_at : visit.expires_at;
      await manager.query(
        `UPDATE provider_visit_deliveries
         SET state='sending', attempt_count=attempt_count+1, expires_at=$4,
             lease_expires_at=$5, updated_at=$3
         WHERE id=$1 AND lease_token=$2`,
        [claim.id, claim.leaseToken, now, expiration, new Date(now.getTime() + leaseDuration)],
      );
      return {
        ...claim,
        userId: delivery.user_id,
        installationId: delivery.installation_id,
        keyId: installation.key_id,
        ciphertext: installation.subscription_ciphertext,
        notificationId: claim.id,
        businessId: delivery.business_id,
        expiresAt: expiration,
        attemptCount: delivery.attempt_count + 1,
      };
    });
  }

  async finish(
    claim: WebPushDeliveryClaim,
    result: WebPushDeliveryResult,
    now: Date,
  ): Promise<boolean> {
    return this.source.transaction(async (manager) => {
      await manager.query("SET LOCAL statement_timeout = '5s'");
      await manager.query("SET LOCAL lock_timeout = '2s'");
      const [delivery]: { user_id: string; installation_id: string; installation_revision: number }[] =
        await manager.query(
          `WITH finalized AS (
             UPDATE provider_visit_deliveries
             SET state=CASE WHEN $4='retry' AND ($7::timestamptz >= expires_at OR $3 >= expires_at) THEN 'expired'
                            WHEN $4='retry' AND attempt_count >= $8 THEN 'failed' ELSE $4 END,
                 next_attempt_at=CASE WHEN $4='retry' AND $7 < expires_at AND $3 < expires_at
                                       AND attempt_count < $8 THEN $7 END,
                 last_reason=CASE WHEN $4='retry' AND ($7 >= expires_at OR $3 >= expires_at) THEN 'expired'
                                  WHEN $4='retry' AND attempt_count >= $8 THEN 'retry_limit' ELSE $5 END,
                 last_http_status=$6, lease_token=NULL, lease_expires_at=NULL, updated_at=$3
             WHERE id=$1 AND lease_token=$2 AND state='sending' AND lease_expires_at > $3
             RETURNING user_id, installation_id, installation_revision
           ) SELECT * FROM finalized`,
          [claim.id, claim.leaseToken, now, result.state, result.reason,
            result.httpStatus ?? null, result.nextAttemptAt ?? null, maxAttempts],
        );
      if (!delivery) return false;
      if (result.httpStatus === 404 || result.httpStatus === 410) {
        await manager.query(
          `UPDATE web_push_installations
           SET state='expired', revision=revision+1, key_id=NULL,
               endpoint_fingerprint=NULL, subscription_fingerprint=NULL,
               subscription_ciphertext=NULL, expires_at=NULL, updated_at=$4
           WHERE user_id=$1 AND installation_id=$2 AND revision=$3 AND state='active'`,
          [delivery.user_id, delivery.installation_id, delivery.installation_revision, now],
        );
      }
      return true;
    });
  }

  private async recoverAndPrune(manager: EntityManager, now: Date): Promise<void> {
    await manager.query(
      `WITH stale AS (
         SELECT id FROM provider_visit_deliveries
         WHERE (state IN ('leased','sending') AND lease_expires_at <= $1)
           OR (state IN ('pending','retry') AND expires_at <= $1)
         ORDER BY COALESCE(lease_expires_at, expires_at), id LIMIT $2 FOR UPDATE SKIP LOCKED
       ) UPDATE provider_visit_deliveries delivery
         SET state=CASE WHEN delivery.state='sending' THEN 'unknown'
                        WHEN delivery.expires_at <= $1 THEN 'expired'
                        WHEN delivery.attempt_count > 0 THEN 'retry' ELSE 'pending' END,
             next_attempt_at=CASE WHEN delivery.state='leased' AND delivery.expires_at > $1 THEN $1 END,
             last_reason=CASE WHEN delivery.state='sending' THEN 'interrupted_after_arm'
                              WHEN delivery.expires_at <= $1 THEN 'expired' ELSE 'lease_recovered' END,
             lease_token=NULL, lease_expires_at=NULL, updated_at=$1
         FROM stale WHERE delivery.id=stale.id`,
      [now, batchSize],
    );
    await manager.query(
      `WITH prunable AS (
         SELECT id FROM provider_visit_deliveries
         WHERE state IN ('accepted','failed','expired','cancelled','unknown')
           AND updated_at <= $1::timestamptz - interval '30 days'
         ORDER BY updated_at, id LIMIT $2 FOR UPDATE SKIP LOCKED
       ) DELETE FROM provider_visit_deliveries delivery USING prunable
         WHERE delivery.id=prunable.id`,
      [now, batchSize],
    );
  }

  private async materialize(manager: EntityManager, now: Date, keyId: string): Promise<void> {
    await manager.query(
      `WITH candidates AS (
         SELECT visit.business_id, visit.provider_id, visit.contact_id, visit.visit_date,
                installation.user_id, installation.installation_id,
                visit.source_revision, installation.revision AS installation_revision,
                LEAST(visit.expires_at, installation.expires_at) AS expires_at
         FROM provider_visit_occurrences visit
         ${visitSources}
         JOIN provider_visit_notification_preferences preference
           ON preference.business_id=visit.business_id AND preference.enabled=true
         ${recipientEligibility}
         LEFT JOIN provider_visit_deliveries delivery ON (
           delivery.business_id, delivery.provider_id, delivery.contact_id, delivery.visit_date,
           delivery.user_id, delivery.installation_id
         )=(visit.business_id, visit.provider_id, visit.contact_id, visit.visit_date,
            installation.user_id, installation.installation_id)
         WHERE visit.status='planned' AND visit.send_at <= $1 AND visit.expires_at > $1
           AND installation.key_id=$2 AND (installation.expires_at IS NULL OR installation.expires_at > $1)
           AND ${explicitRelationship}
           AND (delivery.id IS NULL OR (
             ${revisable} AND delivery.attempt_count < $4
             AND (delivery.source_revision, delivery.installation_revision)
                 IS DISTINCT FROM (visit.source_revision, installation.revision)
           ))
         ORDER BY visit.expires_at, visit.business_id, visit.provider_id, visit.contact_id,
                  visit.visit_date, installation.user_id, installation.installation_id
         LIMIT $3
       ) INSERT INTO provider_visit_deliveries AS delivery (
           business_id, provider_id, contact_id, visit_date, user_id, installation_id,
           source_revision, installation_revision, expires_at, state, next_attempt_at, updated_at
         ) SELECT business_id, provider_id, contact_id, visit_date, user_id, installation_id,
                  source_revision, installation_revision, expires_at, 'pending', $1, $1
           FROM candidates
         ON CONFLICT ON CONSTRAINT uq_provider_visit_delivery_installation DO UPDATE
           SET source_revision=EXCLUDED.source_revision, installation_revision=EXCLUDED.installation_revision,
               expires_at=EXCLUDED.expires_at, state=CASE WHEN delivery.attempt_count>0 THEN 'retry' ELSE 'pending' END,
               next_attempt_at=GREATEST(delivery.next_attempt_at, EXCLUDED.next_attempt_at),
               last_reason=NULL, updated_at=EXCLUDED.updated_at
           WHERE ${revisable} AND delivery.attempt_count < $4
             AND delivery.source_revision <= EXCLUDED.source_revision
             AND delivery.installation_revision <= EXCLUDED.installation_revision
             AND (delivery.source_revision, delivery.installation_revision)
                 IS DISTINCT FROM (EXCLUDED.source_revision, EXCLUDED.installation_revision)`,
      [now, keyId, batchSize, maxAttempts],
    );
  }

  private async currentVisit(
    manager: EntityManager,
    delivery: LeasedDelivery,
  ): Promise<VisitWindow | undefined> {
    // Membership writers lock the parent; source/agenda writers acquire the queue row.
    await manager.query('SELECT id FROM businesses WHERE id=$1 FOR SHARE', [delivery.business_id]);
    await manager.query(
      'SELECT provider_id FROM provider_visit_planning_queue WHERE provider_id=$1 FOR SHARE',
      [delivery.provider_id],
    );
    const [visit]: VisitWindow[] = await manager.query(
      `SELECT visit.source_revision, visit.send_at, visit.expires_at
       FROM provider_visit_occurrences visit ${visitSources}
       WHERE visit.business_id=$1 AND visit.provider_id=$2 AND visit.contact_id=$3
         AND visit.visit_date=$4 AND visit.status='planned'`,
      [delivery.business_id, delivery.provider_id, delivery.contact_id, delivery.visit_date],
    );
    return visit;
  }

  private async currentInstallation(
    manager: EntityManager,
    delivery: LeasedDelivery,
    keyId: string,
    now: Date,
  ): Promise<RecipientInstallation | undefined> {
    const [installation]: RecipientInstallation[] = await manager.query(
      `SELECT installation.revision, installation.key_id, installation.subscription_ciphertext, installation.expires_at
       FROM provider_visit_notification_preferences preference
       JOIN businesses business ON business.id=preference.business_id AND business.is_active=true
       ${recipientEligibility}
       WHERE preference.business_id=$1 AND preference.user_id=$2 AND preference.enabled=true
         AND installation.installation_id=$3 AND installation.key_id=$4
         AND (installation.expires_at IS NULL OR installation.expires_at>$5)
         AND ${explicitRelationship}
       FOR SHARE OF preference, installation`,
      [delivery.business_id, delivery.user_id, delivery.installation_id, keyId, now],
    );
    return installation;
  }

  private async closeLease(
    manager: EntityManager,
    claim: WebPushDeliveryClaim,
    now: Date,
    state: 'cancelled' | 'expired' | 'failed',
    reason: 'source_changed' | 'installation_changed' | 'recipient_ineligible' | 'expired' | 'retry_limit',
  ): Promise<null> {
    await manager.query(
      `UPDATE provider_visit_deliveries SET state=$4, last_reason=$5,
          lease_token=NULL, lease_expires_at=NULL, updated_at=$3
       WHERE id=$1 AND lease_token=$2`,
      [claim.id, claim.leaseToken, now, state, reason],
    );
    return null;
  }
}
