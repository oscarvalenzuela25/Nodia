import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({
  request: vi.fn<(...args: unknown[]) => unknown>(),
  lookup: vi.fn(),
  addresses: [{ address: '8.8.8.8', family: 4 }],
}));
vi.mock('node:https', () => ({
  request: (...args: unknown[]) => transport.request(...args),
}));
vi.mock('node:dns/promises', () => ({
  lookup: (...args: unknown[]) => {
    transport.lookup(...args);
    return Promise.resolve(transport.addresses);
  },
}));
import { NewsFeedClient } from './news-feed.client.js';

function responseFixture(
  statusCode: number,
  headers: Record<string, string> = {},
  chunks: Buffer[] = [],
) {
  const response = Object.assign(new EventEmitter(), {
    statusCode,
    headers,
    destroyed: false,
    destroy: vi.fn(() => {
      response.destroyed = true;
      req.emit('close');
    }),
  });
  const req = Object.assign(new EventEmitter(), {
    end: () =>
      queueMicrotask(() => {
        callback(response);
        for (const chunk of chunks)
          if (!response.destroyed) response.emit('data', chunk);
        if (!response.destroyed) response.emit('end');
        req.emit('close');
      }),
    destroy: (error: Error) => {
      req.emit('error', error);
      req.emit('close');
    },
  });
  type FixtureResponse = typeof response;
  let callback: (incoming: FixtureResponse) => void;
  let options: Record<string, unknown> | undefined;
  transport.request.mockImplementation(
    (_url, suppliedOptions, suppliedCallback) => {
      if (typeof suppliedCallback !== 'function')
        throw new Error('Expected response callback');
      options = suppliedOptions as Record<string, unknown>;
      callback = suppliedCallback as typeof callback;
      return req;
    },
  );
  return { response, req, options: () => options };
}

describe('News fixed-destination transport ownership', () => {
  beforeEach(() => {
    transport.request.mockReset();
    transport.lookup.mockReset();
    transport.addresses = [{ address: '8.8.8.8', family: 4 }];
  });
  afterEach(() => vi.useRealTimers());
  it('uses only the selected catalog destination and its hostname with independent conditional headers', async () => {
    const fixture = responseFixture(
      200,
      { 'content-type': 'application/rss+xml' },
      [
        Buffer.from(
          '<rss><channel><item><title>Node fixture</title><link>https://nodejs.org/en/blog/release/test</link><description>not included</description></item></channel></rss>',
        ),
      ],
    );
    const result = await new NewsFeedClient().fetch(
      { etag: '"node-validator"', lastModified: null },
      'node-js',
    );
    expect(result.articles[0]).toMatchObject({
      source_key: 'node-js',
      excerpt: null,
    });
    expect(transport.lookup).toHaveBeenCalledWith('nodejs.org', {
      all: true,
      verbatim: true,
    });
    expect(transport.request.mock.calls[0][0]).toBe(
      'https://nodejs.org/en/feed/blog.xml',
    );
    expect(fixture.options()?.headers).toMatchObject({
      'If-None-Match': '"node-validator"',
    });
    expect(fixture.options()).not.toHaveProperty('rejectUnauthorized');
    transport.request.mockReset();
    await expect(
      new NewsFeedClient().fetch(
        { etag: null, lastModified: null },
        'http://127.0.0.1/' as 'node-js',
      ),
    ).rejects.toThrow('news:unsafe_destination');
    expect(transport.request).not.toHaveBeenCalled();
  });
  it('closes an unneeded304 response without draining or reading its body', async () => {
    const fixture = responseFixture(304, { etag: '"same"' }, [
      Buffer.alloc(1024 * 1024 + 1),
    ]);
    expect(
      await new NewsFeedClient().fetch({ etag: '"same"', lastModified: null }),
    ).toMatchObject({ status: 'not_modified', articles: [] });
    expect(fixture.response.destroy).toHaveBeenCalledOnce();
    expect(transport.request).toHaveBeenCalledOnce();
  });
  it.each([
    [302, 'unsafe_destination'],
    [429, 'source_rate_limited'],
    [500, 'source_unavailable'],
  ] as const)(
    'closes status%d body and never follows or retries it',
    async (status, code) => {
      const fixture = responseFixture(
        status,
        { 'retry-after': '3600', location: 'http://127.0.0.1/' },
        [Buffer.alloc(1024 * 1024 + 1)],
      );
      await expect(
        new NewsFeedClient().fetch({ etag: null, lastModified: null }),
      ).rejects.toThrow(`news:${code}`);
      expect(fixture.response.destroy).toHaveBeenCalledOnce();
      expect(transport.request).toHaveBeenCalledOnce();
    },
  );
  it('bounds streaming bytes before parsing and closes the oversized response', async () => {
    const fixture = responseFixture(
      200,
      { 'content-type': 'application/xml' },
      [Buffer.alloc(1024 * 1024 + 1)],
    );
    await expect(
      new NewsFeedClient().fetch({ etag: null, lastModified: null }),
    ).rejects.toThrow('news:response_too_large');
    expect(fixture.response.destroy).toHaveBeenCalledOnce();
  });
  it('rejects bad encoding, unexpected content type and invalid UTF8', async () => {
    for (const [headers, chunks] of [
      [{ 'content-type': 'application/xml', 'content-encoding': 'gzip' }, []],
      [{ 'content-type': 'text/html' }, []],
      [{ 'content-type': 'application/xml' }, [Buffer.from([0xc3, 0x28])]],
    ] as const) {
      responseFixture(200, headers, [...chunks]);
      await expect(
        new NewsFeedClient().fetch({ etag: null, lastModified: null }),
      ).rejects.toThrow('news:invalid_feed');
    }
  });
  it('rejects a private DNS answer before dispatch and sends only safe conditional headers', async () => {
    transport.addresses = [{ address: '127.0.0.1', family: 4 }];
    await expect(
      new NewsFeedClient().fetch({ etag: null, lastModified: null }),
    ).rejects.toThrow('news:unsafe_destination');
    expect(transport.request).not.toHaveBeenCalled();
    transport.addresses = [{ address: '8.8.8.8', family: 4 }];
    const fixture = responseFixture(
      200,
      { 'content-type': 'application/xml' },
      [Buffer.from('<rss><channel/></rss>')],
    );
    await new NewsFeedClient().fetch({
      etag: 'bad\r\nheader',
      lastModified: null,
    });
    expect(fixture.options()?.headers).not.toHaveProperty('If-None-Match');
    expect(fixture.options()).not.toHaveProperty('rejectUnauthorized');
  });
});
