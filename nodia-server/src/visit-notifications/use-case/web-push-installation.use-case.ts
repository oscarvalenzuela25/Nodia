import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
} from '../../authorization/authority-transaction.js';
import type { SaveWebPushInstallationDto } from '../dto/visit-notifications.dto.js';
import type { WebPushInstallation } from '../entities/web-push-installation.entity.js';
import {
  clearedWebPushTransport,
  VisitNotificationsService,
} from '../visit-notifications.service.js';
import { readWebPushRegistrationConfig } from '../web-push-config.js';
import { prepareWebPushSubscription } from '../web-push-subscription.js';

type InstallationIdentity = Pick<
  WebPushInstallation,
  'user_id' | 'installation_id'
>;
type InstallationCommand =
  | { kind: 'read' }
  | { kind: 'register'; value: SaveWebPushInstallationDto }
  | { kind: 'revoke'; expectedRevision: number };

function publicStatus(installationId: string, row: WebPushInstallation | null) {
  return {
    installation_id: installationId,
    state: row?.state ?? 'unregistered',
    revision: row?.revision ?? 0,
    updated_at: row?.updated_at ?? null,
  };
}

function assertExpectedRevision(expected: number): void {
  if (!Number.isInteger(expected) || expected < 0 || expected > 2_147_483_646)
    throw new BadRequestException('visit_notifications:invalid_revision');
}

function nextRevision(
  current: WebPushInstallation | null,
  expected: number,
): number {
  const revision = current?.revision ?? 0;
  if (revision !== expected)
    throw new ConflictException('visit_notifications:installation_changed');
  return revision + 1;
}

@Injectable()
export class WebPushInstallationUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly settings: VisitNotificationsService,
  ) {}

  async execute(
    installationId: string,
    actor: ActorReference,
    command: InstallationCommand,
  ) {
    if (command.kind === 'revoke')
      assertExpectedRevision(command.expectedRevision);
    if (command.kind === 'register')
      assertExpectedRevision(command.value.expected_revision);
    try {
      return await this.source.transaction(async (manager) => {
        await lockAuthority(manager, false, actor.statementTimeoutMs);
        const authority = await currentActor(manager, actor);
        // Explicit session revocation locks the session before touching installations.
        const session: { public_id: string }[] = await manager.query(
          `
          SELECT public_id FROM auth_sessions WHERE user_id=$1 AND public_id=$2
           AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE
        `,
          [authority.actorId, authority.sessionId],
        );
        if (!session.length)
          throw new UnauthorizedException('auth:session_expired');
        const identity: InstallationIdentity = {
          user_id: authority.actorId,
          installation_id: installationId.toLowerCase(),
        };
        let current = await this.settings.lockInstallation(
          manager,
          identity.user_id,
          identity.installation_id,
        );
        const [{ now }] = (await manager.query(
          'SELECT clock_timestamp() AS now',
        )) as { now: Date }[];
        if (
          current?.state === 'active' &&
          current.expires_at &&
          current.expires_at <= now
        ) {
          const expired = {
            ...current,
            ...clearedWebPushTransport,
            state: 'expired' as const,
            revision: current.revision + 1,
            updated_at: now,
          };
          await this.settings.writeInstallation(
            manager,
            expired,
            identity,
            current,
          );
          current = expired;
        }
        if (command.kind === 'read')
          return publicStatus(identity.installation_id, current);

        if (command.kind === 'revoke') {
          if (current && current.state !== 'active')
            return publicStatus(identity.installation_id, current);
          const revoked: WebPushInstallation = {
            ...identity,
            ...clearedWebPushTransport,
            state: 'revoked',
            session_id: authority.sessionId,
            revision: nextRevision(current, command.expectedRevision),
            updated_at: now,
          };
          await this.settings.writeInstallation(
            manager,
            revoked,
            identity,
            current,
          );
          return publicStatus(identity.installation_id, revoked);
        }

        const config = readWebPushRegistrationConfig();
        if (!config)
          throw new ServiceUnavailableException(
            'visit_notifications:registration_unavailable',
          );
        if (command.value.key_id !== config.keyId)
          throw new ConflictException('visit_notifications:vapid_key_changed');
        const prepared = prepareWebPushSubscription(
          command.value.subscription,
          config,
          {
            userId: identity.user_id,
            installationId: identity.installation_id,
          },
          now,
        );
        const sameSubscription =
          current?.state === 'active' &&
          current.key_id === config.keyId &&
          current.subscription_fingerprint ===
            prepared.subscription_fingerprint;
        if (
          current &&
          sameSubscription &&
          current.session_id === authority.sessionId &&
          current.expires_at?.getTime() === prepared.expires_at?.getTime()
        )
          return publicStatus(identity.installation_id, current);
        if (
          current?.state === 'active' &&
          current.session_id !== authority.sessionId &&
          !sameSubscription
        )
          throw new ConflictException(
            'visit_notifications:subscription_rebind_mismatch',
          );
        const registered: WebPushInstallation = {
          ...identity,
          ...prepared,
          state: 'active',
          session_id: authority.sessionId,
          key_id: config.keyId,
          revision: nextRevision(current, command.value.expected_revision),
          updated_at: now,
        };
        await this.settings.writeInstallation(
          manager,
          registered,
          identity,
          current,
        );
        return publicStatus(identity.installation_id, registered);
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { constraint?: string }).constraint ===
          'uq_web_push_installations_active_endpoint'
      )
        throw new ConflictException('visit_notifications:endpoint_in_use');
      throw error;
    }
  }
}
