import { describe, expect, it } from 'vitest';
import { assertNewsAddress } from './news-feed.client.js';
import {
  NEWS_RETENTION_MS,
  currentNewsArticles,
  groupPublicNewsArticles,
  mergeNewsArticles,
  newsPlainText,
  newsRetryAt,
  normalizeNewsQuery,
  parseNewsFeed,
  publicNewsArticle,
  safeNewsUrl,
} from './news.policy.js';
import { newsSource } from './news.sources.js';

const now = new Date('2026-11-16T12:00:00.000Z');
const item = (fields = '') =>
  `<item><title>Test &amp; title</title><link>https://web.dev/blog/test?variant=a</link><guid>fixture-id</guid>${fields}</item>`;
const feed = (items: string) =>
  `<rss version="2.0"><channel>${items}</channel></rss>`;

describe('news normalization and retention', () => {
  it('keeps unknown publication and optional data absent, separates receipt, never invents an image', () => {
    const [article] = parseNewsFeed(feed(item()), now);
    expect(article).toMatchObject({
      title: 'Test & title',
      author: null,
      excerpt: null,
      published_at: null,
      received_at: now.toISOString(),
      last_seen_at: now.toISOString(),
    });
    expect(publicNewsArticle(article)).not.toHaveProperty('last_seen_at');
    expect(publicNewsArticle(article)).not.toHaveProperty('image');
    expect(
      parseNewsFeed(feed(item('<pubDate>invalid</pubDate>')), now)[0]
        .published_at,
    ).toBeNull();
  });
  it('uses source identity before URL, preserves distinct unknown query parameters and stable first occurrence', () => {
    const data =
      item() +
      item().replace('variant=a', 'variant=b') +
      item().replace('fixture-id', 'other-id');
    expect(parseNewsFeed(feed(data), now)).toHaveLength(1);
    // An identity grouped into an earlier URL still consumes its first occurrence.
    const groupedIdentity = item().replace('fixture-id', 'other-id');
    expect(
      parseNewsFeed(
        feed(
          item() +
            groupedIdentity +
            groupedIdentity.replace('variant=a', 'variant=b'),
        ),
        now,
      ),
    ).toHaveLength(1);
    expect(
      parseNewsFeed(
        feed(
          item() +
            item()
              .replace('fixture-id', 'other-id')
              .replace('variant=a', 'variant=b'),
        ),
        now,
      ),
    ).toHaveLength(2);
    expect(safeNewsUrl('https://web.dev:443/a?edition=two&x=1#fragment')).toBe(
      'https://web.dev/a?edition=two&x=1',
    );
  });
  it.each([
    '<!DOCTYPE rss [<!ENTITY data SYSTEM "file:///etc/passwd">]><rss/>',
    '<rss><channel></rss>',
    '<html><body>Unavailable</body></html>',
    feed('<item><title>bad</title><link>javascript:alert(1)</link></item>'),
  ])(
    'rejects incompatible and unsafe feed as an error rather than empty success',
    (xml) => {
      expect(() => parseNewsFeed(xml, now)).toThrow('news:invalid_feed');
    },
  );
  it('accepts a genuinely empty RSS and rejects oversized or excessive nesting', () => {
    expect(parseNewsFeed(feed(''), now)).toEqual([]);
    expect(() => parseNewsFeed('x'.repeat(1024 * 1024 + 1), now)).toThrow(
      'news:response_too_large',
    );
    expect(() =>
      parseNewsFeed(feed('<a>'.repeat(30) + '</a>'.repeat(30)), now),
    ).toThrow('news:invalid_feed');
  });
  it('extracts plain text through a parser, drops active content and decodes entities', () => {
    expect(
      newsPlainText(
        '<p>Read &amp; learn</p><script>steal()</script><style>hidden</style><b>now</b>',
        500,
      ),
    ).toBe('Read & learn now');
    expect(
      parseNewsFeed(
        feed(
          item(
            '<description><![CDATA[<p>Read <a href="javascript:bad">here</a></p><script>bad()</script>]]></description>',
          ),
        ),
        now,
      )[0].excerpt,
    ).toBe('Read here');
    expect(safeNewsUrl('https://user:password@site.test/')).toBeNull();
  });
  it('preserves first receipt on merge, does not renew unseen entries and removes expired entries', () => {
    const [original] = parseNewsFeed(feed(item()), now);
    const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const [newer] = parseNewsFeed(feed(item()), later);
    const [merged] = mergeNewsArticles([original], [newer], later);
    expect(merged.received_at).toBe(now.toISOString());
    expect(merged.last_seen_at).toBe(later.toISOString());
    expect(mergeNewsArticles([original], [], later)[0].last_seen_at).toBe(
      now.toISOString(),
    );
    expect(
      currentNewsArticles(
        [original],
        new Date(now.getTime() + NEWS_RETENTION_MS),
      ),
    ).toEqual([]);
  });
  it('validates use case inputs beyond DTO metadata, defaults and provider retry date without inventing missing limits', () => {
    expect(normalizeNewsQuery({})).toEqual({
      page: 1,
      limit: 20,
      order: 'recent',
      topic: undefined,
      source_key: undefined,
    });
    for (const query of [
      { page: 0 },
      { page: 1.5 },
      { limit: 51 },
      { order: 'popular' },
      { source_key: 'daily-dev' },
    ])
      expect(() => normalizeNewsQuery(query)).toThrow('news:invalid_input');
    expect(newsRetryAt(undefined, now)).toBeNull();
    expect(newsRetryAt('60', now)?.toISOString()).toBe(
      '2026-11-16T12:01:00.000Z',
    );
    expect(newsRetryAt('invalid', now)).toBeNull();
  });
  it('accepts bounded full Node history while persisting only100 metadata items and omitting unapproved fields', () => {
    const node = newsSource('node-js')!;
    const history = Array.from({ length: 1074 }, (_, index) =>
      item(
        '<description>Do not redistribute</description><author>Do not infer</author>',
      )
        .replaceAll('fixture-id', `node-${index}`)
        .replace('variant=a', `variant=${index}`),
    ).join('');
    const articles = parseNewsFeed(feed(history), now, node);
    expect(articles).toHaveLength(100);
    expect(articles[0]).toMatchObject({
      source_key: 'node-js',
      source_name: 'Node.js',
      excerpt: null,
      author: null,
    });
    expect(() => parseNewsFeed(feed(history), now)).toThrow(
      'news:invalid_feed',
    );
    expect(() =>
      parseNewsFeed(feed('<item/>'.repeat(2001)), now, node),
    ).toThrow('news:invalid_feed');
    expect(normalizeNewsQuery({ source_key: 'node-js' }).source_key).toBe(
      'node-js',
    );
  });
  it('groups equal URLs across sources without losing attribution or mixing primary metadata and counts', () => {
    const [web] = parseNewsFeed(
      feed(item('<description>Web excerpt</description>')),
      now,
    );
    const [node] = parseNewsFeed(feed(item()), now, newsSource('node-js')!);
    const all = groupPublicNewsArticles([node, web]);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(web.id);
    expect(all[0].provenances.map((entry) => entry.source_key)).toEqual([
      'web-dev',
      'node-js',
    ]);
    expect(all[0].excerpt).toBe('Web excerpt');
    const selected = groupPublicNewsArticles([web, node], 'node-js');
    expect(selected[0]).toMatchObject({
      id: node.id,
      source_key: 'node-js',
      excerpt: null,
      author: null,
    });
    expect(selected[0].provenances).toEqual(all[0].provenances);
    expect(groupPublicNewsArticles([web], 'node-js')).toEqual([]);
    const [distinct] = parseNewsFeed(
      feed(item().replace('variant=a', 'variant=b')),
      now,
      newsSource('node-js')!,
    );
    expect(groupPublicNewsArticles([web, distinct])).toHaveLength(2);
    expect(publicNewsArticle(web).provenances).toHaveLength(1);
  });
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '192.168.1.1',
    '::1',
    'fc00::1',
    '::ffff:127.0.0.1',
  ])('blocks outbound private or mapped destination %s', (address) => {
    expect(() => assertNewsAddress(address)).toThrow('news:unsafe_destination');
  });
});
