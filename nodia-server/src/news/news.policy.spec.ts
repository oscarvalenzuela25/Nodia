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
const go = newsSource('go-blog')!;
const rust = newsSource('rust-blog')!;
const kubernetes = newsSource('kubernetes-blog')!;
const item = (fields = '') =>
  `<item><title>Test &amp; title</title><link>https://source.example/blog/test?variant=a</link><guid>fixture-id</guid>${fields}</item>`;
const feed = (items: string) =>
  `<rss version="2.0"><channel>${items}</channel></rss>`;
const atomFeed = (entries: string) =>
  `<feed xmlns="http://www.w3.org/2005/Atom">${entries}</feed>`;
const atomItem = (fields = '') =>
  `<entry><title type="text">Atom &amp; title</title><id>tag:source.example,2026:fixture</id><link rel="self" href="https://source.example/feed.atom"/><link rel="alternate" href="https://source.example/blog/test?variant=a#fragment"/>${fields}</entry>`;
const parseRss = (xml: string, receivedAt = now) =>
  parseNewsFeed(xml, receivedAt, kubernetes);

describe('news normalization and retention', () => {
  it('keeps unknown publication and optional data absent, separates receipt, never invents an image', () => {
    const [article] = parseRss(feed(item()));
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
      parseRss(feed(item('<pubDate>invalid</pubDate>')))[0].published_at,
    ).toBeNull();
  });
  it('uses source identity before URL, preserves distinct unknown query parameters and stable first occurrence', () => {
    const data =
      item() +
      item().replace('variant=a', 'variant=b') +
      item().replace('fixture-id', 'other-id');
    expect(parseRss(feed(data))).toHaveLength(1);
    // An identity grouped into an earlier URL still consumes its first occurrence.
    const groupedIdentity = item().replace('fixture-id', 'other-id');
    expect(
      parseRss(
        feed(
          item() +
            groupedIdentity +
            groupedIdentity.replace('variant=a', 'variant=b'),
        ),
      ),
    ).toHaveLength(1);
    expect(
      parseRss(
        feed(
          item() +
            item()
              .replace('fixture-id', 'other-id')
              .replace('variant=a', 'variant=b'),
        ),
      ),
    ).toHaveLength(2);
    expect(
      safeNewsUrl('https://source.example:443/a?edition=two&x=1#fragment'),
    ).toBe('https://source.example/a?edition=two&x=1');
  });
  it.each([
    '<!DOCTYPE rss [<!ENTITY data SYSTEM "file:///etc/passwd">]><rss/>',
    '<rss><channel></rss>',
    '<html><body>Unavailable</body></html>',
    feed('<item><title>bad</title><link>javascript:alert(1)</link></item>'),
  ])(
    'rejects incompatible and unsafe feed as an error rather than empty success',
    (xml) => {
      expect(() => parseRss(xml)).toThrow('news:invalid_feed');
    },
  );
  it('accepts a genuinely empty RSS and rejects oversized or excessive nesting', () => {
    expect(parseRss(feed(''))).toEqual([]);
    expect(() => parseRss('x'.repeat(2 * 1024 * 1024 + 1))).toThrow(
      'news:response_too_large',
    );
    expect(() => parseRss(feed('<a>'.repeat(30) + '</a>'.repeat(30)))).toThrow(
      'news:invalid_feed',
    );
  });
  it('extracts plain text through a parser, drops active content and decodes entities', () => {
    expect(
      newsPlainText(
        '<p>Read &amp; learn</p><script>steal()</script><style>hidden</style><b>now</b>',
        500,
      ),
    ).toBe('Read & learn now');
    expect(
      parseRss(
        feed(
          item(
            '<description><![CDATA[<p>Read <a href="javascript:bad">here</a></p><script>bad()</script>]]></description>',
          ),
        ),
      )[0].excerpt,
    ).toBeNull();
    expect(safeNewsUrl('https://user:password@site.test/')).toBeNull();
  });
  it('preserves first receipt on merge, does not renew unseen entries and removes expired entries', () => {
    const [original] = parseRss(feed(item()));
    const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const [newer] = parseRss(feed(item()), later);
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
      catalog: undefined,
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
      { catalog: 1 },
      { catalog: 2, source_key: 'web-dev' },
      { catalog: 2, source_key: 'node-js' },
      { source_key: 'rust-blog' },
    ])
      expect(() => normalizeNewsQuery(query)).toThrow('news:invalid_input');
    expect(newsRetryAt(undefined, now)).toBeNull();
    expect(newsRetryAt('60', now)?.toISOString()).toBe(
      '2026-11-16T12:01:00.000Z',
    );
    expect(newsRetryAt('invalid', now)).toBeNull();
    expect(
      normalizeNewsQuery({ catalog: 2, source_key: 'rust-blog' }),
    ).toMatchObject({
      catalog: 2,
      source_key: 'rust-blog',
    });
  });
  it('bounds Kubernetes RSS entries and stores at most 100 metadata items', () => {
    const history = Array.from({ length: 125 }, (_, index) =>
      item(
        '<description>Do not redistribute</description><author>Do not infer</author>',
      )
        .replaceAll('fixture-id', `kubernetes-${index}`)
        .replace('variant=a', `variant=${index}`),
    ).join('');
    const articles = parseRss(feed(history));
    expect(articles).toHaveLength(100);
    expect(articles[0]).toMatchObject({
      source_key: 'kubernetes-blog',
      topic: 'technology',
      excerpt: null,
      author: null,
    });
    expect(() =>
      parseRss(feed('<item/>'.repeat(kubernetes.max_feed_items + 1))),
    ).toThrow('news:invalid_feed');
  });
  it('uses an Atom alternate link and actual published date with the original offset', () => {
    const [article] = parseNewsFeed(
      atomFeed(
        atomItem(
          '<published>2026-11-15T23:30:00-03:00</published><updated>2026-11-16T10:00:00Z</updated><summary>Omitted summary</summary><author><name>Omitted author</name></author>',
        ),
      ),
      now,
      go,
    );
    expect(article).toMatchObject({
      source_key: 'go-blog',
      title: 'Atom & title',
      url: 'https://source.example/blog/test?variant=a',
      topic: 'programming',
      published_at: '2026-11-16T02:30:00.000Z',
      excerpt: null,
      author: null,
    });
    const [updatedOnly] = parseNewsFeed(
      atomFeed(atomItem('<updated>2026-11-16T10:00:00Z</updated>')),
      now,
      rust,
    );
    expect(updatedOnly.published_at).toBeNull();
  });
  it('rejects Atom lookalikes, cross-format feeds and entries without a safe alternate link', () => {
    expect(parseNewsFeed(atomFeed(''), now, rust)).toEqual([]);
    for (const xml of [
      '<feed><entry><title>not Atom</title></entry></feed>',
      feed(item()),
      atomFeed(
        atomItem().replace(
          'https://source.example/blog/test?variant=a#fragment',
          'javascript:alert(1)',
        ),
      ),
    ])
      expect(() => parseNewsFeed(xml, now, rust)).toThrow('news:invalid_feed');
    expect(() =>
      parseNewsFeed(
        atomFeed('<entry/>'.repeat(rust.max_feed_items + 1)),
        now,
        rust,
      ),
    ).toThrow('news:invalid_feed');
  });
  it('groups equal URLs across sources without losing attribution or mixing primary metadata and counts', () => {
    const [kubeArticle] = parseRss(feed(item()));
    const [goArticle] = parseNewsFeed(atomFeed(atomItem()), now, go);
    const [rustArticle] = parseNewsFeed(atomFeed(atomItem()), now, rust);
    const all = groupPublicNewsArticles([kubeArticle, rustArticle, goArticle]);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(goArticle.id);
    expect(all[0].provenances.map((entry) => entry.source_key)).toEqual([
      'go-blog',
      'rust-blog',
      'kubernetes-blog',
    ]);
    const selected = groupPublicNewsArticles(
      [goArticle, rustArticle, kubeArticle],
      'rust-blog',
    );
    expect(selected[0]).toMatchObject({
      id: rustArticle.id,
      source_key: 'rust-blog',
      excerpt: null,
      author: null,
    });
    expect(selected[0].provenances).toEqual(all[0].provenances);
    const filtered = groupPublicNewsArticles(
      [goArticle, rustArticle, kubeArticle],
      undefined,
      'technology',
    );
    expect(filtered[0]).toMatchObject({
      id: kubeArticle.id,
      topic: 'technology',
    });
    expect(filtered[0].provenances).toEqual(all[0].provenances);
    expect(groupPublicNewsArticles([goArticle], 'rust-blog')).toEqual([]);
    const [distinct] = parseNewsFeed(
      atomFeed(atomItem().replace('variant=a', 'variant=b')),
      now,
      rust,
    );
    expect(groupPublicNewsArticles([goArticle, distinct])).toHaveLength(2);
    expect(publicNewsArticle(goArticle).provenances).toHaveLength(1);
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
