import type { NewsSourceKey } from './news.types.js';

export interface NewsSourceDefinition {
  readonly key: NewsSourceKey;
  readonly name: string;
  readonly home_url: string;
  readonly feed_url: string;
  readonly license_url: string;
  readonly max_feed_items: number;
  readonly include_excerpt: boolean;
  readonly include_author: boolean;
}

/** Only reviewed public feeds; neither the browser nor a POST can supply a URL. */
export const NEWS_SOURCES: readonly NewsSourceDefinition[] = Object.freeze([
  Object.freeze({
    key: 'web-dev',
    name: 'web.dev',
    home_url: 'https://web.dev/',
    feed_url: 'https://web.dev/static/blog/feed.xml',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    max_feed_items: 500,
    include_excerpt: true,
    include_author: true,
  }),
  Object.freeze({
    key: 'node-js',
    name: 'Node.js',
    home_url: 'https://nodejs.org/',
    feed_url: 'https://nodejs.org/en/feed/blog.xml',
    license_url: 'https://github.com/nodejs/nodejs.org/blob/main/LICENSE',
    max_feed_items: 2000,
    include_excerpt: false,
    include_author: false,
  }),
]);

export const NEWS_SOURCE_KEYS = NEWS_SOURCES.map((source) => source.key);
export function newsSource(key: string): NewsSourceDefinition | undefined {
  return NEWS_SOURCES.find((source) => source.key === key);
}
