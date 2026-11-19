import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyDevNewsClient } from './daily-dev-news.client.js';

const token = 'dda_synthetic-daily-token';

function json(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('daily.dev Personal News adapter', () => {
  it('uses two fixed read-only endpoints and projects link metadata in feed order', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        json({ id: 'profile-123', username: 'fixture', bio: token }),
      )
      .mockResolvedValueOnce(
        json({
          data: [
            {
              id: 'upstream-first',
              title: '  <strong>First &amp; older</strong>  ',
              url: 'https://example.invalid/first?edition=2#section',
              tags: ['Go', ' go ', 'dev_ops', token, 'invalid tag'],
              publishedAt: '2026-11-18T20:00:00Z',
              image: 'https://example.invalid/image',
              summary: token,
              author: { username: 'another' },
            },
            {
              title: 'Duplicate',
              url: 'https://example.invalid/first?edition=2',
            },
            { title: 'Skip insecure URL', url: 'http://example.invalid/news' },
            {
              title: 'Skip URL with credentials',
              url: 'https://name:password@example.invalid/news',
            },
            {
              title: 'Skip credential echo',
              url: `https://example.invalid/?credential=${token.replace('_', '%255F')}`,
            },
            {
              title: `Bad title with ${token}`,
              url: 'https://example.invalid/title-echo',
            },
            {
              title: 'Second',
              url: 'https://example.invalid/second',
              createdAt: '2026-11-19T20:00:00Z',
              commentsPermalink: 'https://app.daily.dev/posts/second',
            },
          ],
          pagination: { hasNextPage: true, cursor: token },
        }),
      );
    vi.stubGlobal('fetch', fetch);
    const client = new DailyDevNewsClient();

    await expect(client.test(token)).resolves.toEqual({
      account_name: 'fixture',
    });
    await expect(client.refresh(token)).resolves.toEqual({
      articles: [
        {
          id: expect.stringMatching(/^[a-f0-9]{64}$/u),
          provider: 'daily-dev',
          title: 'First & older',
          url: 'https://example.invalid/first?edition=2',
          tags: ['go', 'dev_ops'],
          published_at: '2026-11-18T20:00:00.000Z',
        },
        {
          id: expect.stringMatching(/^[a-f0-9]{64}$/u),
          provider: 'daily-dev',
          title: 'Second',
          url: 'https://example.invalid/second',
          published_at: null,
        },
      ],
    });
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.daily.dev/public/v1/profile/',
      'https://api.daily.dev/public/v1/feeds/foryou?limit=10',
    ]);
    for (const [, init] of fetch.mock.calls) {
      expect(init).toMatchObject({
        method: 'GET',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      });
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe(`Bearer ${token}`);
      expect(headers.has('api-key')).toBe(false);
    }
  });

  it('requires a PAT before using the network and a safe identity in the direct profile response', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ id: 'profile-123', username: null }))
      .mockResolvedValueOnce(json({ id: token, username: 'fixture' }));
    vi.stubGlobal('fetch', fetch);
    const client = new DailyDevNewsClient();

    await expect(client.test('oauth-token')).rejects.toMatchObject({
      code: 'news:provider_credentials_invalid',
    });
    expect(fetch).not.toHaveBeenCalled();
    await expect(client.test(token)).resolves.toEqual({
      account_name: 'profile-123',
    });
    await expect(client.test(token)).rejects.toMatchObject({
      code: 'news:provider_invalid_response',
    });
  });

  it('distinguishes a true empty feed from a malformed, oversized or invalid selection', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ data: null }))
      .mockResolvedValueOnce(json({ data: [null] }))
      .mockResolvedValueOnce(
        json({
          data: Array.from({ length: 11 }, () => ({
            title: 'Valid',
            url: 'https://example.invalid',
          })),
        }),
      )
      .mockResolvedValueOnce(
        json({ data: [], ignored: 'x'.repeat(512 * 1024) }),
      );
    vi.stubGlobal('fetch', fetch);
    const client = new DailyDevNewsClient();

    await expect(client.refresh(token)).resolves.toEqual({ articles: [] });
    for (let index = 0; index < 4; index++) {
      await expect(client.refresh(token)).rejects.toMatchObject({
        code: 'news:provider_invalid_response',
      });
    }
  });

  it('maps provider revocation, retry timing and unavailable transport to safe errors', async () => {
    const now = new Date('2026-11-18T20:00:00Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ message: token }, { status: 401 }))
      .mockResolvedValueOnce(json({ message: token }, { status: 403 }))
      .mockResolvedValueOnce(
        json(
          { message: token },
          { status: 429, headers: { 'Retry-After': '120' } },
        ),
      )
      .mockResolvedValueOnce(
        json({ message: token, retryAfter: 75 }, { status: 429 }),
      )
      .mockResolvedValueOnce(
        json({ message: token, retryAfter: 'invalid' }, { status: 429 }),
      )
      .mockRejectedValueOnce(new Error(token));
    vi.stubGlobal('fetch', fetch);
    const client = new DailyDevNewsClient();

    for (let index = 0; index < 2; index++) {
      await expect(client.refresh(token)).rejects.toMatchObject({
        code: 'news:provider_credentials_invalid',
        message: 'news:provider_credentials_invalid',
      });
    }
    for (const milliseconds of [120_000, 75_000, null]) {
      await expect(client.refresh(token)).rejects.toMatchObject({
        code: 'news:provider_rate_limited',
        message: 'news:provider_rate_limited',
        retryAt:
          milliseconds === null ? null : new Date(now.getTime() + milliseconds),
      });
    }
    await expect(client.refresh(token)).rejects.toMatchObject({
      code: 'news:provider_unavailable',
      message: 'news:provider_unavailable',
    });
  });
});
