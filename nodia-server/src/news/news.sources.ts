import type { NewsSourceKey, NewsTopic } from './news.types.js';

export interface NewsSourceDefinition {
  readonly key: NewsSourceKey;
  readonly name: string;
  readonly home_url: string;
  readonly feed_url: string;
  readonly license_url: string;
  readonly format: 'rss' | 'atom';
  readonly topic: NewsTopic;
  readonly max_feed_bytes: number;
  readonly max_feed_items: number;
}

const MIB = 1024 * 1024;
export const NEWS_PUBLIC_CATALOG = 2;

/** Only reviewed public feeds; neither the browser nor a POST can supply a URL. */
export const NEWS_SOURCES: readonly NewsSourceDefinition[] = Object.freeze([
  Object.freeze({
    key: 'go-blog',
    name: 'Go Blog',
    home_url: 'https://go.dev/blog/',
    feed_url: 'https://go.dev/blog/feed.atom',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    format: 'atom',
    topic: 'programming',
    max_feed_bytes: MIB,
    max_feed_items: 50,
  }),
  Object.freeze({
    key: 'rust-blog',
    name: 'Rust Blog',
    home_url: 'https://blog.rust-lang.org/',
    feed_url: 'https://blog.rust-lang.org/feed.xml',
    license_url:
      'https://github.com/rust-lang/blog.rust-lang.org/blob/5b42e9f522217dd60b9f2258b10c98f6601b7cc2/LICENSE-MIT',
    format: 'atom',
    topic: 'programming',
    max_feed_bytes: MIB,
    max_feed_items: 50,
  }),
  Object.freeze({
    key: 'kubernetes-blog',
    name: 'Kubernetes Blog',
    home_url: 'https://kubernetes.io/blog/',
    feed_url: 'https://kubernetes.io/feed.xml',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    format: 'rss',
    topic: 'technology',
    max_feed_bytes: 2 * MIB,
    max_feed_items: 150,
  }),
]);

export const NEWS_SOURCE_KEYS = NEWS_SOURCES.map((source) => source.key);
export function newsSource(key: string): NewsSourceDefinition | undefined {
  return NEWS_SOURCES.find((source) => source.key === key);
}
