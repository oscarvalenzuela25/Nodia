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
} from './personal-news-payload.js';
import {
  DAILY_DEV,
  DAILY_DEV_PAT_PATTERN,
  PersonalNewsProviderError,
  type PersonalNewsArticle,
} from './personal-news.types.js';

const BASE_URL = 'https://api.daily.dev/public/v1/';
const ARTICLE_LIMIT = 10;
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_RATE_ERROR_BYTES = 4096;
const REQUEST_TIMEOUT_MS = 10_000;
type DailyDevPath = 'profile/' | `feeds/foryou?limit=${typeof ARTICLE_LIMIT}`;

async function rateLimitTime(
  response: Response,
  now: Date,
): Promise<Date | null> {
  const header = newsRetryAt(
    response.headers.get('retry-after') ?? undefined,
    now,
  );
  if (header) {
    await response.body?.cancel().catch(() => undefined);
    return header;
  }
  const body = await jsonBody(response, MAX_RATE_ERROR_BYTES).catch(() => null);
  const seconds = record(body)?.retryAfter;
  return typeof seconds === 'number' &&
    Number.isSafeInteger(seconds) &&
    seconds > 0
    ? newsRetryAt(String(seconds), now)
    : null;
}

function safeProfileLabel(value: unknown, apiKey: string): string | null {
  return typeof value === 'string' &&
    /^[a-z0-9_.-]{1,80}$/iu.test(value) &&
    !value.toLowerCase().includes(apiKey.toLowerCase())
    ? value
    : null;
}

function articlesFromFeed(
  value: unknown,
  apiKey: string,
): PersonalNewsArticle[] {
  const data = record(value)?.data;
  if (!Array.isArray(data) || data.length > ARTICLE_LIMIT)
    throw invalidResponse();
  const articles = new Map<string, PersonalNewsArticle>();
  for (const entry of data) {
    const post = record(entry);
    const title = newsPlainText(post?.title, 500);
    const url = safeNewsUrl(post?.url);
    if (
      !post ||
      !title ||
      !url?.startsWith('https://') ||
      title.includes(apiKey) ||
      !credentialFreeUrl(url, apiKey) ||
      articles.has(url)
    )
      continue;

    const tags = Array.isArray(post.tags)
      ? normalizeArticleTags(post.tags, apiKey)
      : [];
    articles.set(url, {
      id: createHash('sha256').update(`${DAILY_DEV}\0${url}`).digest('hex'),
      provider: DAILY_DEV,
      title,
      url,
      published_at: publication(post.publishedAt),
      ...(tags.length ? { tags } : {}),
    });
  }
  if (data.length && !articles.size) throw invalidResponse();
  return [...articles.values()];
}

@Injectable()
export class DailyDevNewsClient {
  private async get(path: DailyDevPath, apiKey: string): Promise<unknown> {
    if (!DAILY_DEV_PAT_PATTERN.test(apiKey))
      throw new PersonalNewsProviderError('news:provider_credentials_invalid');
    try {
      const response = await fetch(new URL(path, BASE_URL), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'Nodia Personal News',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return await jsonBody(response, MAX_RESPONSE_BYTES);

      const now = new Date();
      if (response.status === 429)
        throw new PersonalNewsProviderError(
          'news:provider_rate_limited',
          await rateLimitTime(response, now),
        );
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 401 || response.status === 403)
        throw new PersonalNewsProviderError(
          'news:provider_credentials_invalid',
        );
      throw new PersonalNewsProviderError(
        'news:provider_unavailable',
        response.status >= 500
          ? newsRetryAt(response.headers.get('retry-after') ?? undefined, now)
          : null,
      );
    } catch (error) {
      if (error instanceof PersonalNewsProviderError) throw error;
      throw new PersonalNewsProviderError('news:provider_unavailable');
    }
  }

  async test(apiKey: string): Promise<{ account_name: string }> {
    const profile = record(await this.get('profile/', apiKey));
    const id = safeProfileLabel(profile?.id, apiKey);
    if (!id) throw invalidResponse();
    return { account_name: safeProfileLabel(profile?.username, apiKey) ?? id };
  }

  async refresh(apiKey: string): Promise<{ articles: PersonalNewsArticle[] }> {
    const feed = await this.get(`feeds/foryou?limit=${ARTICLE_LIMIT}`, apiKey);
    return { articles: articlesFromFeed(feed, apiKey) };
  }
}
