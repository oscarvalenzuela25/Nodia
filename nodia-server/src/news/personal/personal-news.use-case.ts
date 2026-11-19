import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
} from '../../authorization/authority-transaction.js';
import type { PersonalNewsConnection } from './entities/personal-news-connection.entity.js';
import { DevCommunityNewsClient } from './dev-community-news.client.js';
import { DailyDevNewsClient } from './daily-dev-news.client.js';
import { dailyDevPilotAllowed } from './daily-dev-pilot.policy.js';
import {
  decryptNewsCredential,
  encryptNewsCredential,
  personalNewsKey,
} from './personal-news-crypto.js';
import { PersonalNewsService } from './personal-news.service.js';
import {
  DAILY_DEV,
  DAILY_DEV_PAT_PATTERN,
  DEV_COMMUNITY,
  PERSONAL_NEWS_API_KEY_PATTERN,
  PERSONAL_NEWS_PROVIDERS,
  PersonalNewsProviderError,
  type PersonalNewsArticle,
  type PersonalNewsClient,
  type PersonalNewsConnectionView,
  type PersonalNewsProvider,
  type PersonalNewsRefresh,
} from './personal-news.types.js';

const LEASE_MS = 30_000;
const LOCAL_RETRY_MS = 60_000;
const REFRESH_COOLDOWN_MS = 15 * 60_000;
const DEV_SNAPSHOT_TTL_MS = 24 * 60 * 60_000;
const DAILY_DEV_SNAPSHOT_TTL_MS = 60 * 60_000;

type Lease = {
  owner: string;
  provider: PersonalNewsProvider;
  token: string;
  version: string;
};
type StoredLease = Lease & { ciphertext: string; key: Buffer };
type Operation = 'test' | 'refresh';

function after(now: Date, milliseconds: number): Date {
  return new Date(now.getTime() + milliseconds);
}

function active(until: Date | null | undefined, now: Date): until is Date {
  return !!until && until > now;
}

function requireProvider(
  provider: string,
): asserts provider is PersonalNewsProvider {
  if (!PERSONAL_NEWS_PROVIDERS.some((allowed) => allowed === provider))
    throw new BadRequestException('news:invalid_input');
}

function providerAllowed(
  provider: PersonalNewsProvider,
  owner: string,
): boolean {
  return provider === DEV_COMMUNITY || dailyDevPilotAllowed(owner);
}

function providerKey(provider: PersonalNewsProvider, owner: string): Buffer {
  requireProvider(provider);
  const key = providerAllowed(provider, owner) ? personalNewsKey() : null;
  if (!key) throw new ServiceUnavailableException('news:provider_pending');
  return key;
}

function connectionView(
  provider: PersonalNewsProvider,
  row: PersonalNewsConnection | null,
  now: Date,
  available: boolean,
): PersonalNewsConnectionView {
  const current = available ? row : null;
  const refresh = current?.next_refresh_at;
  const retry = current?.retry_until;
  const providerBackoff =
    active(retry, now) && (!active(refresh, now) || retry >= refresh);
  return {
    provider,
    state: available ? (current?.state ?? 'disconnected') : 'pending',
    account_name: current?.account_name ?? null,
    key_hint: current?.state === 'connected' ? '••••••••' : null,
    last_tested_at: current?.last_tested_at?.toISOString() ?? null,
    last_test_error_code: current?.last_test_error_code ?? null,
    last_refresh_attempt_at:
      current?.last_refresh_attempt_at?.toISOString() ?? null,
    last_refresh_success_at:
      current?.last_refresh_success_at?.toISOString() ?? null,
    last_refresh_error_code: current?.last_refresh_error_code ?? null,
    next_refresh_at: providerBackoff
      ? retry.toISOString()
      : (refresh?.toISOString() ?? null),
    retry_source: providerBackoff
      ? (current?.retry_source ?? null)
      : active(refresh, now)
        ? 'local'
        : null,
    snapshot_status: active(current?.snapshot_expires_at, now)
      ? (current?.snapshot_status ?? null)
      : null,
  };
}

function requireNotLimited(row: PersonalNewsConnection, now: Date): void {
  if (active(row.retry_until, now))
    throw new HttpException(
      {
        message: 'news:provider_rate_limited',
        retry_after_seconds: Math.ceil(
          (row.retry_until.getTime() - now.getTime()) / 1000,
        ),
        retry_source: row.retry_source,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
}

function classifyFailure(error: unknown): PersonalNewsProviderError {
  return error instanceof PersonalNewsProviderError
    ? error
    : new PersonalNewsProviderError('news:provider_unavailable');
}

function httpFailure(
  error: PersonalNewsProviderError,
  row: PersonalNewsConnection,
  now: Date,
): HttpException {
  if (error.code === 'news:provider_credentials_invalid')
    return new BadRequestException(error.code);
  const backoff = active(row.retry_until, now)
    ? {
        retry_after_seconds: Math.ceil(
          (row.retry_until.getTime() - now.getTime()) / 1000,
        ),
        retry_source: row.retry_source,
      }
    : {};
  return new HttpException(
    { message: error.code, ...backoff },
    error.code === 'news:provider_rate_limited'
      ? HttpStatus.TOO_MANY_REQUESTS
      : HttpStatus.SERVICE_UNAVAILABLE,
  );
}

function applyBackoff(
  row: PersonalNewsConnection,
  now: Date,
  error: PersonalNewsProviderError,
): void {
  if (error.code === 'news:provider_credentials_invalid') return;
  const providerRetry = active(error.retryAt, now);
  const retryUntil = providerRetry ? error.retryAt : after(now, LOCAL_RETRY_MS);
  if (!active(row.retry_until, now) || retryUntil > row.retry_until) {
    row.retry_until = retryUntil;
    row.retry_source = providerRetry ? 'provider' : 'local';
  }
}

function clearSnapshot(row: PersonalNewsConnection): void {
  row.articles = [];
  row.snapshot_status = null;
  row.snapshot_expires_at = null;
}

@Injectable()
export class PersonalNewsUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly news: PersonalNewsService,
    private readonly dev: DevCommunityNewsClient,
    private readonly dailyDev: DailyDevNewsClient,
  ) {}

  private client(provider: PersonalNewsProvider): PersonalNewsClient {
    return provider === DEV_COMMUNITY ? this.dev : this.dailyDev;
  }

  private asOwner<T>(
    actor: ActorReference,
    work: (manager: EntityManager, owner: string) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await lockAuthority(manager);
      const authority = await currentActor(manager, actor);
      return work(manager, authority.actorId);
    });
  }

  connections(
    actor: ActorReference,
  ): Promise<{ connections: PersonalNewsConnectionView[] }> {
    return this.asOwner(actor, async (manager, owner) => {
      const configured = personalNewsKey() !== null;
      const now = await this.news.clock(manager);
      const connections = [];
      for (const provider of PERSONAL_NEWS_PROVIDERS) {
        const available = configured && providerAllowed(provider, owner);
        const row = available
          ? await this.news.find(manager, owner, provider)
          : null;
        connections.push(connectionView(provider, row, now, available));
      }
      return { connections };
    });
  }

  articles(
    actor: ActorReference,
    provider: PersonalNewsProvider = DEV_COMMUNITY,
  ): Promise<{ items: PersonalNewsArticle[] }> {
    requireProvider(provider);
    return this.asOwner(actor, async (manager, owner) => {
      if (!providerAllowed(provider, owner) || !personalNewsKey())
        return { items: [] };
      const row = await this.news.find(manager, owner, provider);
      const now = await this.news.clock(manager);
      return {
        items:
          row?.state === 'connected' && active(row.snapshot_expires_at, now)
            ? row.articles
            : [],
      };
    });
  }

  async connect(
    actor: ActorReference,
    provider: PersonalNewsProvider,
    apiKey: string,
  ): Promise<{ connection: PersonalNewsConnectionView }> {
    const { lease, key } = await this.asOwner(
      actor,
      async (manager, owner): Promise<{ lease: Lease; key: Buffer }> => {
        const key = providerKey(provider, owner);
        const pattern =
          provider === DAILY_DEV
            ? DAILY_DEV_PAT_PATTERN
            : PERSONAL_NEWS_API_KEY_PATTERN;
        if (typeof apiKey !== 'string' || !pattern.test(apiKey))
          throw new BadRequestException('news:invalid_input');
        await this.news.create(manager, owner, provider, randomUUID());
        const row = await this.news.lock(manager, owner, provider);
        if (!row) throw new ConflictException('news:operation_superseded');
        const now = await this.news.clock(manager);
        requireNotLimited(row, now);
        if (active(row.connect_lease_until, now))
          throw new ConflictException('news:operation_in_progress');
        const token = randomUUID();
        row.connect_lease_id = token;
        row.connect_lease_until = after(now, LEASE_MS);
        if (provider === DAILY_DEV && !active(row.snapshot_expires_at, now))
          clearSnapshot(row);
        await this.news.save(manager, row);
        return {
          key,
          lease: { owner, provider, token, version: row.credential_version },
        };
      },
    );

    let accountName: string;
    try {
      ({ account_name: accountName } =
        await this.client(provider).test(apiKey));
    } catch (error) {
      throw await this.finishFailure(
        actor,
        lease,
        'connect',
        classifyFailure(error),
      );
    }
    const version = randomUUID();
    const ciphertext = encryptNewsCredential(
      apiKey,
      key,
      provider,
      lease.owner,
      version,
    );
    return this.finish(actor, lease, 'connect', (row, now) => {
      row.state = 'connected';
      row.account_name = accountName;
      row.credential_version = version;
      row.credential_ciphertext = ciphertext;
      row.operation_lease_id = null;
      row.operation_lease_until = null;
      row.last_tested_at = now;
      row.last_test_error_code = null;
      row.last_refresh_attempt_at = null;
      row.last_refresh_success_at = null;
      row.last_refresh_error_code = null;
      row.next_refresh_at = null;
      row.retry_until = null;
      row.retry_source = null;
      clearSnapshot(row);
      return { connection: connectionView(provider, row, now, true) };
    });
  }

  async test(
    actor: ActorReference,
    provider: PersonalNewsProvider,
  ): Promise<{ connection: PersonalNewsConnectionView }> {
    const reservation = await this.reserve(actor, provider, 'test');
    if ('cached' in reservation)
      throw new ConflictException('news:operation_superseded');
    const lease = reservation;
    const response = await this.withCredential(actor, lease, 'test', (apiKey) =>
      this.client(provider).test(apiKey),
    );
    return this.finish(actor, lease, 'test', (row, now) => {
      row.account_name = response.account_name;
      row.last_tested_at = now;
      row.last_test_error_code = null;
      return { connection: connectionView(provider, row, now, true) };
    });
  }

  async refresh(
    actor: ActorReference,
    provider: PersonalNewsProvider,
  ): Promise<PersonalNewsRefresh> {
    const reservation = await this.reserve(actor, provider, 'refresh');
    if ('cached' in reservation) return reservation.cached;
    const lease = reservation;
    const result = await this.withCredential(
      actor,
      lease,
      'refresh',
      (apiKey) => this.client(provider).refresh(apiKey),
    );
    return this.finish(actor, lease, 'refresh', (row, now) => {
      const status = result.articles.length
        ? 'updated'
        : result.hasFollowedTags === false
          ? 'no_followed_tags'
          : 'empty';
      row.articles = result.articles;
      row.snapshot_status = status;
      row.snapshot_expires_at = after(
        now,
        provider === DAILY_DEV
          ? DAILY_DEV_SNAPSHOT_TTL_MS
          : DEV_SNAPSHOT_TTL_MS,
      );
      row.last_refresh_success_at = now;
      row.last_refresh_error_code = null;
      row.next_refresh_at = after(now, REFRESH_COOLDOWN_MS);
      return {
        connection: connectionView(provider, row, now, true),
        status,
        received_count: row.articles.length,
      };
    });
  }

  private reserve(
    actor: ActorReference,
    provider: PersonalNewsProvider,
    operation: Operation,
  ): Promise<StoredLease | { cached: PersonalNewsRefresh }> {
    return this.asOwner(actor, async (manager, owner) => {
      const key = providerKey(provider, owner);
      const row = await this.news.lock(manager, owner, provider);
      if (row?.state !== 'connected' || !row.credential_ciphertext)
        throw new ConflictException('news:connection_required');
      const now = await this.news.clock(manager);
      requireNotLimited(row, now);
      if (
        active(row.connect_lease_until, now) ||
        active(row.operation_lease_until, now)
      )
        throw new ConflictException('news:operation_in_progress');
      if (operation === 'refresh' && active(row.next_refresh_at, now))
        return {
          cached: {
            connection: connectionView(provider, row, now, true),
            status: 'cached',
            received_count: 0,
          },
        };
      const token = randomUUID();
      row.operation_lease_id = token;
      row.operation_lease_until = after(now, LEASE_MS);
      if (operation === 'refresh') row.last_refresh_attempt_at = now;
      if (!active(row.snapshot_expires_at, now)) clearSnapshot(row);
      await this.news.save(manager, row);
      return {
        owner,
        provider,
        token,
        version: row.credential_version,
        ciphertext: row.credential_ciphertext,
        key,
      };
    });
  }

  private async withCredential<T>(
    actor: ActorReference,
    lease: StoredLease,
    operation: Operation,
    work: (apiKey: string) => Promise<T>,
  ): Promise<T> {
    try {
      const apiKey = decryptNewsCredential(
        lease.ciphertext,
        lease.key,
        lease.provider,
        lease.owner,
        lease.version,
      );
      return await work(apiKey);
    } catch (error) {
      throw await this.finishFailure(
        actor,
        lease,
        operation,
        classifyFailure(error),
      );
    }
  }

  private finish<T>(
    actor: ActorReference,
    lease: Lease,
    operation: Operation | 'connect',
    apply: (row: PersonalNewsConnection, now: Date) => T,
  ): Promise<T> {
    return this.asOwner(actor, async (manager, owner) => {
      if (lease.provider === DAILY_DEV) providerKey(lease.provider, owner);
      const row = await this.news.lock(manager, owner, lease.provider);
      const now = await this.news.clock(manager);
      const connecting = operation === 'connect';
      const token = connecting
        ? row?.connect_lease_id
        : row?.operation_lease_id;
      const until = connecting
        ? row?.connect_lease_until
        : row?.operation_lease_until;
      if (
        !row ||
        owner !== lease.owner ||
        lease.version !== row.credential_version ||
        token !== lease.token ||
        !active(until, now)
      )
        throw new ConflictException('news:operation_superseded');
      if (connecting) {
        row.connect_lease_id = null;
        row.connect_lease_until = null;
      } else {
        row.operation_lease_id = null;
        row.operation_lease_until = null;
      }
      const outcome = apply(row, now);
      await this.news.save(manager, row);
      return outcome;
    });
  }

  private finishFailure(
    actor: ActorReference,
    lease: Lease,
    operation: Operation | 'connect',
    error: PersonalNewsProviderError,
  ): Promise<HttpException> {
    return this.finish(actor, lease, operation, (row, now) => {
      applyBackoff(row, now, error);
      if (operation === 'test') {
        row.last_tested_at = now;
        row.last_test_error_code = error.code;
      }
      if (operation === 'refresh') row.last_refresh_error_code = error.code;
      if (
        operation !== 'connect' &&
        error.code === 'news:provider_credentials_invalid'
      ) {
        row.state = 'reconnect_required';
        row.credential_ciphertext = null;
        row.account_name = null;
        row.next_refresh_at = null;
        clearSnapshot(row);
      }
      return httpFailure(error, row, now);
    });
  }

  disconnect(
    actor: ActorReference,
    provider: PersonalNewsProvider,
  ): Promise<void> {
    requireProvider(provider);
    return this.asOwner(actor, async (manager, owner) => {
      if (providerAllowed(provider, owner))
        await this.news.delete(manager, owner, provider);
    });
  }
}
