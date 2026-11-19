import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { newsPlainText, newsRetryAt, safeNewsUrl } from '../news.policy.js';
import {
  credentialFreeUrl,
  invalidResponse,
  jsonBody,
  normalizeArticleTags,
  publication,
  record,
  TAG_SLUG,
} from './personal-news-payload.js';
import {
  DEV_COMMUNITY,
  PersonalNewsProviderError,
  type PersonalNewsArticle,
} from './personal-news.types.js';

const DEV_ORIGIN = 'https://dev.to';
const DEV_IMAGE_ORIGIN = 'https://media2.dev.to';
const MAX_BYTES = 1024 * 1024;
const OPERATION_TIMEOUT_MS = 10_000;
const MAX_FOLLOWED_TAGS = 4;
const MAX_ARTICLE_TAGS_FIELD = 4096;
const PER_PAGE = 24;

type DevApiPath = '/api/users/me' | '/api/follows/tags' | '/api/articles';

function followTags(value: unknown, apiKey: string): string[] {
  if (!Array.isArray(value)) throw invalidResponse();
  const tags = new Set<string>();
  for (const entry of value) {
    const name = record(entry)?.name;
    if (
      typeof name === 'string' &&
      TAG_SLUG.test(name) &&
      !name.includes(apiKey)
    )
      tags.add(name.toLowerCase());
    if (tags.size === MAX_FOLLOWED_TAGS) break;
  }
  if (value.length && !tags.size) throw invalidResponse();
  return [...tags];
}

function articleTags(item: Record<string, unknown>, apiKey: string): string[] {
  const { tag_list: tagList, tags: serializedTags } = item;
  const candidates: unknown[] = Array.isArray(tagList)
    ? tagList
    : typeof serializedTags === 'string' &&
        serializedTags.length <= MAX_ARTICLE_TAGS_FIELD
      ? serializedTags.split(',')
      : [];
  return normalizeArticleTags(candidates, apiKey);
}

function articleUrl(value: unknown): string | null {
  const url = safeNewsUrl(value);
  return url?.startsWith('https://') ? url : null;
}

function coverImageUrl(value: unknown, apiKey: string): string | null {
  if (typeof value !== 'string') return null;
  const url = safeNewsUrl(value);
  if (!url || new URL(url).origin !== DEV_IMAGE_ORIGIN) return null;

  return credentialFreeUrl(value, apiKey) ? url : null;
}

function selection(value: unknown, apiKey: string): PersonalNewsArticle[] {
  if (!Array.isArray(value) || value.length > PER_PAGE) throw invalidResponse();
  const articles = new Map<string, PersonalNewsArticle>();
  for (const entry of value) {
    const item = record(entry);
    const title = newsPlainText(item?.title, 500);
    const url = articleUrl(item?.canonical_url) ?? articleUrl(item?.url);
    if (
      !item ||
      !title ||
      !url ||
      title.includes(apiKey) ||
      url.includes(apiKey)
    )
      continue;
    if (articles.has(url)) continue;
    const cover = coverImageUrl(item.cover_image, apiKey);
    const tags = articleTags(item, apiKey);
    articles.set(url, {
      id: createHash('sha256').update(`${DEV_COMMUNITY}\0${url}`).digest('hex'),
      provider: DEV_COMMUNITY,
      title,
      url,
      ...(cover ? { cover_image_url: cover } : {}),
      ...(tags.length ? { tags } : {}),
      published_at:
        publication(item.published_timestamp) ?? publication(item.published_at),
    });
  }
  if (value.length && !articles.size) throw invalidResponse();
  return [...articles.values()].sort(
    (left, right) =>
      (right.published_at ?? '').localeCompare(left.published_at ?? '') ||
      left.id.localeCompare(right.id),
  );
}

/** Fixed destinations. Only the private identity and tags endpoints receive the PAT. */
@Injectable()
export class DevCommunityNewsClient {
  private async get(
    path: DevApiPath,
    signal: AbortSignal,
    apiKey: string | null,
    query?: URLSearchParams,
  ): Promise<unknown> {
    const url = new URL(path, DEV_ORIGIN);
    if (query) url.search = query.toString();
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.forem.api-v1+json',
        'User-Agent': 'Nodia Personal News',
      };
      if (apiKey) headers['api-key'] = apiKey;
      const response = await fetch(url, { headers, signal, redirect: 'error' });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        const retryAt = newsRetryAt(
          response.headers.get('retry-after') ?? undefined,
          new Date(),
        );
        if (response.status === 429)
          throw new PersonalNewsProviderError(
            'news:provider_rate_limited',
            retryAt,
          );
        if (apiKey && (response.status === 401 || response.status === 403))
          throw new PersonalNewsProviderError(
            'news:provider_credentials_invalid',
          );
        throw new PersonalNewsProviderError(
          'news:provider_unavailable',
          response.status >= 500 ? retryAt : null,
        );
      }
      return await jsonBody(response, MAX_BYTES);
    } catch (error) {
      if (error instanceof PersonalNewsProviderError) throw error;
      throw new PersonalNewsProviderError('news:provider_unavailable');
    }
  }

  async test(apiKey: string): Promise<{ account_name: string }> {
    const account = record(
      await this.get(
        '/api/users/me',
        AbortSignal.timeout(OPERATION_TIMEOUT_MS),
        apiKey,
      ),
    );
    const username = account?.username;
    if (
      typeof username !== 'string' ||
      !/^[a-z0-9_-]{1,80}$/iu.test(username) ||
      username.includes(apiKey)
    )
      throw invalidResponse();
    return { account_name: username };
  }

  async refresh(
    apiKey: string,
  ): Promise<{ articles: PersonalNewsArticle[]; hasFollowedTags: boolean }> {
    const signal = AbortSignal.timeout(OPERATION_TIMEOUT_MS);
    const tags = followTags(
      await this.get('/api/follows/tags', signal, apiKey),
      apiKey,
    );
    if (!tags.length) return { articles: [], hasFollowedTags: false };
    const query = new URLSearchParams({
      tags: tags.join(','),
      page: '1',
      per_page: String(PER_PAGE),
    });
    return {
      articles: selection(
        await this.get('/api/articles', signal, null, query),
        apiKey,
      ),
      hasFollowedTags: true,
    };
  }
}
