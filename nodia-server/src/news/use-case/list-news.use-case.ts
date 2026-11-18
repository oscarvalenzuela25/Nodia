import { Injectable } from '@nestjs/common';
import { NewsService } from '../news.service.js';
import {
  currentNewsArticles,
  groupPublicNewsArticles,
  normalizeNewsQuery,
  type NewsQuery,
} from '../news.policy.js';
import type { NewsListResponse } from '../news.types.js';
import { NEWS_PUBLIC_CATALOG, NEWS_SOURCES } from '../news.sources.js';

@Injectable()
export class ListNewsUseCase {
  constructor(private readonly news: NewsService) {}
  async execute(input: NewsQuery): Promise<NewsListResponse> {
    const query = normalizeNewsQuery(input);
    // Previously published clients validate closed source enums.
    if (query.catalog !== NEWS_PUBLIC_CATALOG)
      return {
        items: [],
        sources: [],
        pagination: {
          page: query.page,
          limit: query.limit,
          total: 0,
          total_pages: 0,
        },
      };
    const snapshots = await this.news.snapshots();
    const now = new Date();
    const items = groupPublicNewsArticles(
      snapshots.flatMap((snapshot) =>
        currentNewsArticles(snapshot.articles, now),
      ),
      query.source_key,
      query.topic,
    ).sort((a, b) => {
      const dateA =
        query.order === 'received'
          ? a.received_at
          : (a.published_at ?? a.received_at);
      const dateB =
        query.order === 'received'
          ? b.received_at
          : (b.published_at ?? b.received_at);
      return dateB.localeCompare(dateA) || a.id.localeCompare(b.id);
    });
    return {
      items: items.slice(
        (query.page - 1) * query.limit,
        query.page * query.limit,
      ),
      sources: NEWS_SOURCES.map((source) => {
        const snapshot = snapshots.find(
          (snapshot) => snapshot.source_key === source.key,
        );
        return {
          key: source.key,
          name: source.name,
          home_url: source.home_url,
          license_url: source.license_url,
          last_attempt_at: snapshot?.last_attempt_at?.toISOString() ?? null,
          last_success_at: snapshot?.last_success_at?.toISOString() ?? null,
          next_refresh_at: snapshot?.next_refresh_at?.toISOString() ?? null,
          last_error_code: snapshot?.last_error_code ?? null,
        };
      }),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: items.length,
        total_pages: Math.ceil(items.length / query.limit),
      },
    };
  }
}
