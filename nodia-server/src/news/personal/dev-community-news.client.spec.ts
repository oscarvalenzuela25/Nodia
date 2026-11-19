import { afterEach, describe, expect, it, vi } from 'vitest';
import { DevCommunityNewsClient } from './dev-community-news.client.js';

const secret = 'synthetic-dev-pat';
const json = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => vi.unstubAllGlobals());

describe('DEV Community Personal News adapter', () => {
  it('builds one bounded public selection from followed tags and retains only link metadata', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        json([
          { name: 'Rust' },
          { name: 'rust' },
          { name: 'go' },
          { name: secret },
          { name: 'typescript' },
          { name: 'postgres' },
          { name: 'ignored' },
        ]),
      )
      .mockResolvedValueOnce(
        json([
          {
            title: '<b>Fixture &amp; original</b>',
            canonical_url: 'https://example.invalid/post#content',
            url: 'https://dev.to/fixture/post',
            description: 'not public output',
            body_markdown: 'strip me',
            cover_image: 'https://example.invalid/image',
            user: { username: 'other' },
            published_timestamp: '2026-11-18T18:30:00Z',
          },
          { title: 'Duplicate article', url: 'https://example.invalid/post' },
          { title: 'Invalid navigation', url: 'javascript:console.log(1)' },
        ]),
      );
    vi.stubGlobal('fetch', fetch);
    const client = new DevCommunityNewsClient();
    const result = await client.refresh(secret);
    expect(result).toEqual({
      hasFollowedTags: true,
      articles: [
        {
          id: expect.stringMatching(/^[a-f0-9]{64}$/u),
          provider: 'dev-community',
          title: 'Fixture & original',
          url: 'https://example.invalid/post',
          published_at: '2026-11-18T18:30:00.000Z',
        },
      ],
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    const [tags, articles] = fetch.mock.calls as [URL, RequestInit][];
    expect(tags[0].href).toBe('https://dev.to/api/follows/tags');
    expect(new Headers(tags[1].headers).get('api-key')).toBe(secret);
    expect(articles[0].pathname).toBe('/api/articles');
    expect(Object.fromEntries(articles[0].searchParams)).toEqual({
      tags: 'rust,go,typescript,postgres',
      page: '1',
      per_page: '24',
    });
    expect(new Headers(articles[1].headers).has('api-key')).toBe(false);
    expect(articles[1].signal).toBe(tags[1].signal);
    expect(articles[1].redirect).toBe('error');
  });

  it('retains the publisher cover only for the verified HTTPS CDN and never requests an image', async () => {
    const cover =
      'https://media2.dev.to/dynamic/image/width=1000,fit=cover/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Farticles%2Ffixture.png';
    const rejectedCovers = [
      null,
      'http://media2.dev.to/fixture.png',
      'https://media2.dev.to.example.invalid/fixture.png',
      'https://assets.media2.dev.to/fixture.png',
      'https://media.dev.to/fixture.png',
      'https://media2.dev.to:8443/fixture.png',
      'https://username:password@media2.dev.to/fixture.png',
      `https://media2.dev.to/${secret}/fixture.png`,
      `https://media2.dev.to/fixture.png?credential=${secret}`,
      `https://media2.dev.to/fixture.png#${secret}`,
      `https://media2.dev.to/fixture.png?credential=${secret.replace('-', '%252D')}`,
      'https://media2.dev.to/fixture%ZZ.png',
    ];
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json([{ name: 'go' }]))
      .mockResolvedValueOnce(
        json(
          [`${cover}#section`, ...rejectedCovers].map((image, index) => ({
            title: `Article ${index}`,
            url: `https://dev.to/news/fixture-${index}`,
            cover_image: image,
            social_image: cover,
          })),
        ),
      );
    vi.stubGlobal('fetch', fetch);

    const { articles } = await new DevCommunityNewsClient().refresh(secret);

    expect(articles).toHaveLength(rejectedCovers.length + 1);
    expect(
      articles.filter((item) => Object.hasOwn(item, 'cover_image_url')),
    ).toEqual([
      expect.objectContaining({ title: 'Article 0', cover_image_url: cover }),
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retains bounded article topic slugs from Forem metadata and excludes credential echoes', async () => {
    const longTag = 'x'.repeat(64);
    const examples = [
      {
        tag_list: [
          ' TypeScript ',
          'typescript',
          `${secret.toUpperCase()}-echo`,
          'full stack',
          'https://example.invalid/tag',
          `${longTag}x`,
          { name: 'invalid' },
          'Web_Dev',
          'Web-Dev',
          'Aplicación',
          'beginner',
          'python',
          'postgres',
          'testing',
          'over-capacity',
        ],
        tags: 'ignored-when-an-array-is-present',
      },
      { tags: `Go, ${longTag},go, ${secret}, template literal,` },
      { tag_list: 'malformed', tags: 'Docker,Containers' },
      { tag_list: [], tags: 'ignored-when-the-array-is-empty' },
      { tag_list: [null, '/', secret] },
      { tags: `docker,${'x'.repeat(4096)}` },
      {},
    ];
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json([{ name: 'followed-topic' }]))
      .mockResolvedValueOnce(
        json(
          examples.map((example, index) => ({
            ...example,
            title: `News about robotics ${index}`,
            url: `https://dev.to/news/topics-${index}`,
          })),
        ),
      );
    vi.stubGlobal('fetch', fetch);

    const { articles } = await new DevCommunityNewsClient().refresh(secret);

    expect(articles).toHaveLength(examples.length);
    expect(
      Object.fromEntries(
        articles
          .filter((article) => Object.hasOwn(article, 'tags'))
          .map((article) => [article.title, article.tags]),
      ),
    ).toEqual({
      'News about robotics 0': [
        'typescript',
        'web_dev',
        'web-dev',
        'aplicación',
        'beginner',
        'python',
        'postgres',
        'testing',
      ],
      'News about robotics 1': ['go', longTag],
      'News about robotics 2': ['docker', 'containers'],
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('distinguishes no followed tags from an invalid response and makes no article call', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json({ status: 'wrong' }));
    vi.stubGlobal('fetch', fetch);
    const client = new DevCommunityNewsClient();
    await expect(client.refresh(secret)).resolves.toEqual({
      articles: [],
      hasFollowedTags: false,
    });
    await expect(client.refresh(secret)).rejects.toMatchObject({
      code: 'news:provider_invalid_response',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      fetch.mock.calls.every(
        ([url]) => (url as URL).pathname === '/api/follows/tags',
      ),
    ).toBe(true);
  });

  it('classifies revoked credentials and honors Retry-After without exposing upstream content', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(secret, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(secret, {
          status: 429,
          headers: { 'Retry-After': '120' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(secret, {
          status: 503,
          headers: { 'Retry-After': '45' },
        }),
      );
    vi.stubGlobal('fetch', fetch);
    const client = new DevCommunityNewsClient();
    await expect(client.test(secret)).rejects.toMatchObject({
      code: 'news:provider_credentials_invalid',
      message: 'news:provider_credentials_invalid',
    });
    await expect(client.test(secret)).rejects.toMatchObject({
      code: 'news:provider_rate_limited',
      retryAt: expect.any(Date),
      message: 'news:provider_rate_limited',
    });
    await expect(client.test(secret)).rejects.toMatchObject({
      code: 'news:provider_unavailable',
      retryAt: expect.any(Date),
      message: 'news:provider_unavailable',
    });
    expect(
      fetch.mock.calls.every(
        ([url]) => (url as URL).href === 'https://dev.to/api/users/me',
      ),
    ).toBe(true);
  });

  it('rejects a streamed JSON payload over the byte limit', async () => {
    const body = json({ username: 'a'.repeat(1024 * 1024) });
    expect(body.headers.get('Content-Length')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(body),
    );
    await expect(
      new DevCommunityNewsClient().test(secret),
    ).rejects.toMatchObject({
      code: 'news:provider_invalid_response',
    });
  });
});
