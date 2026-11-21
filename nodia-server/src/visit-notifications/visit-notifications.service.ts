import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { businessAccessPredicate } from '../business-access/business-access.js';
import { ProviderVisitNotificationPreference } from './entities/provider-visit-notification-preference.entity.js';
import { WebPushInstallation } from './entities/web-push-installation.entity.js';

export const clearedWebPushTransport = {
  key_id: null,
  endpoint_fingerprint: null,
  subscription_fingerprint: null,
  subscription_ciphertext: null,
  expires_at: null,
};

@Injectable()
export class VisitNotificationsService {
  async isExplicitActiveMember(
    manager: EntityManager,
    businessId: string,
    userId: string,
  ): Promise<boolean> {
    const rows: { id: string }[] = await manager.query(
      `SELECT business.id FROM businesses business WHERE business.id=$1 AND business.is_active
       AND ${businessAccessPredicate('business.id', '$2')}`,
      [businessId, userId],
    );
    return rows.length === 1;
  }

  async preference(
    manager: EntityManager,
    businessId: string,
    userId: string,
  ): Promise<boolean> {
    const row = await manager
      .getRepository(ProviderVisitNotificationPreference)
      .findOneBy({
        business_id: businessId,
        user_id: userId,
      });
    return row?.enabled ?? false;
  }

  async savePreference(
    manager: EntityManager,
    businessId: string,
    userId: string,
    enabled: boolean,
  ): Promise<void> {
    await manager
      .getRepository(ProviderVisitNotificationPreference)
      .upsert({ business_id: businessId, user_id: userId, enabled }, [
        'user_id',
        'business_id',
      ]);
  }

  async lockInstallation(
    manager: EntityManager,
    userId: string,
    installationId: string,
  ) {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`web-push-installation:${userId}:${installationId}`],
    );
    const row = await manager
      .getRepository(WebPushInstallation)
      .createQueryBuilder('device')
      .addSelect('device.subscription_fingerprint')
      .where(
        'device.user_id=:userId AND device.installation_id=:installationId',
        { userId, installationId },
      )
      .setLock('pessimistic_write')
      .getOne();
    return row;
  }

  async writeInstallation(
    manager: EntityManager,
    row: Partial<WebPushInstallation>,
    identity: Pick<WebPushInstallation, 'user_id' | 'installation_id'>,
    current: WebPushInstallation | null,
  ): Promise<void> {
    const repository = manager.getRepository(WebPushInstallation);
    if (current) await repository.update(identity, row);
    else await repository.insert({ ...row, ...identity });
  }
}

/** Bounded maintenance, safe to run from multiple reconciler processes. */
export async function sweepWebPushInstallations(
  manager: EntityManager,
): Promise<void> {
  await manager.query(`
    WITH expired AS (
      SELECT user_id, installation_id FROM web_push_installations
       WHERE state='active' AND expires_at <= clock_timestamp()
       ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
    )
    UPDATE web_push_installations device
       SET state='expired', revision=device.revision+1, key_id=NULL,
           endpoint_fingerprint=NULL, subscription_fingerprint=NULL,
           subscription_ciphertext=NULL, expires_at=NULL, updated_at=clock_timestamp()
      FROM expired WHERE device.user_id=expired.user_id AND device.installation_id=expired.installation_id
  `);
  await manager.query(`
    WITH retired AS (
      SELECT device.user_id, device.installation_id FROM web_push_installations device
        LEFT JOIN auth_sessions session ON session.public_id=device.session_id AND session.user_id=device.user_id
       WHERE device.state<>'active'
         AND GREATEST(device.updated_at, COALESCE(session.revoked_at, session.expires_at, device.updated_at))
             <= clock_timestamp() - interval '30 days'
       ORDER BY device.updated_at LIMIT 100 FOR UPDATE OF device SKIP LOCKED
    )
    DELETE FROM web_push_installations device USING retired
     WHERE device.user_id=retired.user_id AND device.installation_id=retired.installation_id
  `);
}
