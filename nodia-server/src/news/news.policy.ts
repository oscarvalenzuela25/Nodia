import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { Parser } from 'htmlparser2';
import type {
  NewsArticle,
  NewsSourceKey,
  NewsTopic,
  StoredNewsArticle,
} from './news.types.js';
import {
  NEWS_PUBLIC_CATALOG,
  NEWS_SOURCES,
  newsSource,
  type NewsSourceDefinition,
} from './news.sources.js';
export const NEWS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const NEWS_COOLDOWN_MS = 15 * 60 * 1000;
export const NEWS_LEASE_MS = 30_000;
export const NEWS_MAX_ITEMS = 100;

export class NewsFeedError extends Error {
  constructor(
    readonly code:
      | 'invalid_feed'
      | 'source_unavailable'
      | 'source_timeout'
      | 'source_rate_limited'
      | 'unsafe_destination'
      | 'response_too_large',
    readonly retryAt: Date | null = null,
  ) {
    super(`news:${code}`);
  }
}

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Plain text only. HTML is parsed, never returned for rendering. */
export function newsPlainText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  let text = '';
  let excluded = 0;
  const blocked = new Set(['script', 'style', 'iframe', 'object', 'template']);
  const parser = new Parser(
    {
      onopentag(name) {
        if (blocked.has(name)) excluded++;
        else if (!excluded) text += ' ';
      },
      onclosetag(name) {
        if (blocked.has(name)) excluded = Math.max(0, excluded - 1);
        else if (!excluded) text += ' ';
      },
      ontext(value) {
        if (!excluded) text += value;
      },
    },
    { decodeEntities: true },
  );
  parser.end(value.slice(0, 16_384));
  const normalized = text.replace(/\s+/gu, ' ').trim();
  return normalized ? normalized.slice(0, max) : null;
}

/** Keep unknown query parameters: they can identify a different article. */
export function safeNewsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

const ATOM_NAMESPACE = 'http://www.w3.org/2005/Atom';

function xmlEntries(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function atomArticleUrl(value: unknown): string | null {
  for (const raw of xmlEntries(value)) {
    const link = object(raw);
    if (!link || (link['@_rel'] !== undefined && link['@_rel'] !== 'alternate'))
      continue;
    const url = safeNewsUrl(link['@_href']);
    if (url) return url;
  }
  return null;
}

export function parseNewsFeed(
  xml: string,
  receivedAt: Date,
  source: NewsSourceDefinition,
): StoredNewsArticle[] {
  if (Buffer.byteLength(xml, 'utf8') > source.max_feed_bytes)
    throw new NewsFeedError('response_too_large');
  // Reject DTDs/custom entities before parser work; no external entity resolution.
  if (
    /<!\s*(?:DOCTYPE|ENTITY)\b/iu.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new NewsFeedError('invalid_feed');
  const atom = source.format === 'atom';
  let parsed: Record<string, unknown> | null;
  try {
    parsed = object(
      new XMLParser({
        ignoreAttributes: !atom,
        parseTagValue: false,
        trimValues: true,
        processEntities: true,
        maxNestedTags: 20,
      }).parse(xml),
    );
  } catch {
    throw new NewsFeedError('invalid_feed');
  }
  const rawChannel = atom ? parsed?.feed : object(parsed?.rss)?.channel;
  const channel = rawChannel === '' ? {} : object(rawChannel);
  if (!channel || (atom && channel['@_xmlns'] !== ATOM_NAMESPACE))
    throw new NewsFeedError('invalid_feed');
  const rawItems = xmlEntries(atom ? channel.entry : channel.item);
  if (rawItems.length > source.max_feed_items)
    throw new NewsFeedError('invalid_feed');
  const result: StoredNewsArticle[] = [];
  const urls = new Set<string>();
  const identities = new Set<string>();
  for (const raw of rawItems) {
    const item = object(raw);
    if (!item) continue;
    const title = newsPlainText(
      object(item.title)?.['#text'] ?? item.title,
      500,
    );
    const url = atom ? atomArticleUrl(item.link) : safeNewsUrl(item.link);
    if (!title || !url) continue;
    const identity = atom ? item.id : item.guid;
    const guid =
      typeof identity === 'string' && identity.length <= 4096 ? identity : url;
    if (identities.has(guid)) continue;
    identities.add(guid);
    if (urls.has(url)) continue;
    const date = atom ? item.published : item.pubDate;
    const published = typeof date === 'string' ? Date.parse(date) : Number.NaN;
    result.push({
      id: createHash('sha256').update(`${source.key}\0${guid}`).digest('hex'),
      source_key: source.key,
      source_name: source.name,
      title,
      url,
      excerpt: null,
      author: null,
      topic: source.topic,
      published_at: Number.isFinite(published)
        ? new Date(published).toISOString()
        : null,
      received_at: receivedAt.toISOString(),
      last_seen_at: receivedAt.toISOString(),
      license_url: source.license_url,
    });
    urls.add(url);
    if (result.length === NEWS_MAX_ITEMS) break;
  }
  if (rawItems.length && !result.length)
    throw new NewsFeedError('invalid_feed');
  return result;
}

export function currentNewsArticles(
  articles: readonly StoredNewsArticle[],
  now: Date,
): StoredNewsArticle[] {
  return articles
    .filter(
      (item) =>
        Date.parse(item.last_seen_at) > now.getTime() - NEWS_RETENTION_MS,
    )
    .slice(0, NEWS_MAX_ITEMS);
}

export function mergeNewsArticles(
  previous: readonly StoredNewsArticle[],
  incoming: readonly StoredNewsArticle[],
  now: Date,
): StoredNewsArticle[] {
  const old = currentNewsArticles(previous, now);
  const byId = new Map(old.map((item) => [item.id, item]));
  const byUrl = new Map(old.map((item) => [item.url, item]));
  const result = new Map<string, StoredNewsArticle>();
  for (const item of incoming) {
    const original = byId.get(item.id) ?? byUrl.get(item.url);
    result.set(item.url, {
      ...item,
      id: original?.id ?? item.id,
      received_at: original?.received_at ?? item.received_at,
    });
  }
  for (const item of old) if (!result.has(item.url)) result.set(item.url, item);
  return [...result.values()].slice(0, NEWS_MAX_ITEMS);
}

export function publicNewsArticle(item: StoredNewsArticle): NewsArticle {
  return {
    id: item.id,
    source_key: item.source_key,
    source_name: item.source_name,
    title: item.title,
    url: item.url,
    excerpt: item.excerpt,
    author: item.author,
    topic: item.topic,
    published_at: item.published_at,
    received_at: item.received_at,
    license_url: item.license_url,
    provenances: [
      {
        source_key: item.source_key,
        source_name: item.source_name,
        license_url: item.license_url,
      },
    ],
  };
}

/** Deduplicate only exact normalized URLs; never combine content from different editors. */
export function groupPublicNewsArticles(
  articles: readonly StoredNewsArticle[],
  selectedSource?: NewsSourceKey,
  selectedTopic?: NewsTopic,
): NewsArticle[] {
  const grouped = new Map<string, StoredNewsArticle[]>();
  for (const source of NEWS_SOURCES) {
    for (const article of articles) {
      if (article.source_key !== source.key) continue;
      const entries = grouped.get(article.url) ?? [];
      if (!entries.some((entry) => entry.source_key === article.source_key))
        entries.push(article);
      grouped.set(article.url, entries);
    }
  }
  const result: NewsArticle[] = [];
  for (const entries of grouped.values()) {
    const primary = entries.find(
      (entry) =>
        (!selectedSource || entry.source_key === selectedSource) &&
        (!selectedTopic || entry.topic === selectedTopic),
    );
    if (!primary) continue;
    result.push({
      ...publicNewsArticle(primary),
      provenances: entries.map((entry) => ({
        source_key: entry.source_key,
        source_name: entry.source_name,
        license_url: entry.license_url,
      })),
    });
  }
  return result;
}

export interface NewsQuery {
  catalog?: number;
  source_key?: string;
  topic?: string;
  order?: string;
  page?: number;
  limit?: number;
}
export function normalizeNewsQuery(value: NewsQuery) {
  const page = value.page ?? 1;
  const limit = value.limit ?? 20;
  const order = value.order ?? 'recent';
  if (
    (value.catalog !== undefined && value.catalog !== NEWS_PUBLIC_CATALOG) ||
    (value.source_key !== undefined &&
      (value.catalog !== NEWS_PUBLIC_CATALOG ||
        !newsSource(value.source_key))) ||
    (value.topic !== undefined &&
      !['technology', 'programming', 'ai'].includes(value.topic)) ||
    !['recent', 'received'].includes(order) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  )
    throw new BadRequestException('news:invalid_input');
  return {
    catalog: value.catalog,
    page,
    limit,
    order,
    topic: value.topic as NewsTopic | undefined,
    source_key: value.source_key as NewsSourceKey | undefined,
  };
}

export function newsRetryAt(value: string | undefined, now: Date): Date | null {
  if (!value || value.length > 100) return null;
  const milliseconds = /^\d+$/u.test(value)
    ? now.getTime() + Number(value) * 1000
    : Date.parse(value);
  if (!Number.isFinite(milliseconds) || milliseconds <= now.getTime())
    return null;
  return new Date(Math.min(milliseconds, 253402300799000));
}
