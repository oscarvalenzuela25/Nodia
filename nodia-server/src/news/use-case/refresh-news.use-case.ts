import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
} from '../../authorization/authority-transaction.js';
import { NewsService } from '../news.service.js';
import { NewsFeedClient } from '../news-feed.client.js';
import {
  NEWS_COOLDOWN_MS,
  NEWS_LEASE_MS,
  NEWS_RETENTION_MS,
  NewsFeedError,
  currentNewsArticles,
  mergeNewsArticles,
} from '../news.policy.js';
import type { NewsRefreshResponse } from '../news.types.js';
import type { NewsSource } from '../entities/news-source.entity.js';
import { newsSource } from '../news.sources.js';

@Injectable()
export class RefreshNewsUseCase {
  private readonly logger = new Logger(RefreshNewsUseCase.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly news: NewsService,
    private readonly feed: NewsFeedClient,
  ) {}

  private async asAdmin<T>(
    actor: ActorReference,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await lockAuthority(manager);
      const authority = await currentActor(manager, actor);
      if (!authority.isSuperAdmin)
        throw new ForbiddenException('news:super_admin_required');
      return work(manager);
    });
  }
  private response(
    source: NewsSource,
    status: NewsRefreshResponse['status'],
    count: number,
    now: Date,
  ): NewsRefreshResponse {
    return {
      source_key: source.source_key,
      status,
      received_count: count,
      stored_count: currentNewsArticles(source.articles, now).length,
      last_attempt_at: source.last_attempt_at!.toISOString(),
      last_success_at: source.last_success_at?.toISOString() ?? null,
      next_refresh_at: source.next_refresh_at!.toISOString(),
    };
  }

  async execute(
    actor: ActorReference,
    input: { source_key: string },
  ): Promise<NewsRefreshResponse> {
    const definition = newsSource(input?.source_key);
    if (!definition) throw new BadRequestException('news:invalid_input');
    const token = randomUUID();
    const reservation = await this.asAdmin(actor, async (manager) => {
      await this.news.create(manager, definition.key);
      const source = (await this.news.snapshot(manager, true, definition.key))!;
      const now = await this.news.clock(manager);
      if (source.lease_token && source.lease_until && source.lease_until > now)
        throw new ConflictException('news:refresh_in_progress');
      if (source.next_refresh_at && source.next_refresh_at > now)
        return { source, cached: this.response(source, 'cached', 0, now) };
      source.articles = currentNewsArticles(source.articles, now);
      if (
        !source.last_success_at ||
        source.last_success_at.getTime() <= now.getTime() - NEWS_RETENTION_MS
      ) {
        source.etag = null;
        source.last_modified = null;
        source.feed_ids = [];
      }
      source.last_attempt_at = now;
      source.next_refresh_at = new Date(now.getTime() + NEWS_COOLDOWN_MS);
      source.lease_token = token;
      source.lease_until = new Date(now.getTime() + NEWS_LEASE_MS);
      await this.news.save(manager, source);
      return { source, cached: null };
    });
    if (reservation.cached) return reservation.cached;

    try {
      const result = await this.feed.fetch(
        {
          etag: reservation.source.etag,
          lastModified: reservation.source.last_modified,
        },
        definition.key,
      );
      if (
        result.status === 'not_modified' &&
        !reservation.source.last_success_at
      )
        throw new NewsFeedError('invalid_feed');
      const response = await this.asAdmin(actor, async (manager) => {
        const source = await this.news.snapshot(manager, true, definition.key);
        const now = await this.news.clock(manager);
        if (
          !source ||
          source.lease_token !== token ||
          !source.lease_until ||
          source.lease_until <= now
        )
          throw new ConflictException('news:refresh_superseded');
        const incoming =
          result.status === 'updated'
            ? result.articles
            : source.articles
                .filter((item) => source.feed_ids.includes(item.id))
                .map((item) => ({ ...item, last_seen_at: now.toISOString() }));
        source.articles = mergeNewsArticles(source.articles, incoming, now);
        const incomingUrls = new Set(incoming.map((item) => item.url));
        source.feed_ids = source.articles
          .filter((item) => incomingUrls.has(item.url))
          .map((item) => item.id);
        source.etag = result.etag;
        source.last_modified = result.lastModified;
        source.last_success_at = now;
        source.last_error_code = null;
        source.lease_token = null;
        source.lease_until = null;
        await this.news.save(manager, source);
        return this.response(
          source,
          result.status,
          result.articles.length,
          now,
        );
      });
      this.logger.log({
        event: 'news_refresh',
        source: definition.key,
        status: response.status,
        count: response.received_count,
      });
      return response;
    } catch (error) {
      const failure = error instanceof NewsFeedError ? error : null;
      // Internal cleanup is fenced and cannot publish content after revocation or takeover.
      await this.dataSource.transaction(async (manager) => {
        const source = await this.news.snapshot(manager, true, definition.key);
        if (!source || source.lease_token !== token) return;
        source.lease_token = null;
        source.lease_until = null;
        source.last_error_code = failure?.message ?? 'news:source_unavailable';
        if (
          failure?.retryAt &&
          (!source.next_refresh_at || failure.retryAt > source.next_refresh_at)
        )
          source.next_refresh_at = failure.retryAt;
        source.articles = currentNewsArticles(
          source.articles,
          await this.news.clock(manager),
        );
        await this.news.save(manager, source);
      });
      this.logger.warn({
        event: 'news_refresh_failed',
        source: definition.key,
        code: failure?.code ?? 'publication_rejected',
      });
      if (failure) throw new ServiceUnavailableException(failure.message);
      throw error;
    }
  }
}
