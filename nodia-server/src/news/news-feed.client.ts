import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import ipaddr from 'ipaddr.js';
import {
  NEWS_MAX_BYTES,
  NewsFeedError,
  newsRetryAt,
  parseNewsFeed,
} from './news.policy.js';
import type { FeedResult } from './news.types.js';
import type { NewsSourceKey } from './news.types.js';
import { newsSource } from './news.sources.js';

export function assertNewsAddress(address: string): void {
  if (!ipaddr.isValid(address) || ipaddr.parse(address).range() !== 'unicast')
    throw new NewsFeedError('unsafe_destination');
}
const validator = (
  value: string | string[] | undefined | null,
): string | null =>
  typeof value === 'string' &&
  value.length <= 512 &&
  !Array.from(value).some(
    (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
  )
    ? value
    : null;

/** Vetted fixed endpoints only. No arbitrary URLs or redirects from caller input. */
@Injectable()
export class NewsFeedClient {
  async fetch(
    validators: {
      etag: string | null;
      lastModified: string | null;
    },
    sourceKey: NewsSourceKey = 'web-dev',
  ): Promise<FeedResult> {
    const source = newsSource(sourceKey);
    if (!source) throw new NewsFeedError('unsafe_destination');
    const deadline = Date.now() + 10_000;
    let lookupTimer: ReturnType<typeof setTimeout> | undefined;
    const addresses = await Promise.race([
      lookup(new URL(source.feed_url).hostname, { all: true, verbatim: true }),
      new Promise<never>((_resolve, reject) => {
        lookupTimer = setTimeout(
          () => reject(new NewsFeedError('source_timeout')),
          10_000,
        );
      }),
    ])
      .catch((error: unknown) => {
        throw error instanceof NewsFeedError
          ? error
          : new NewsFeedError('source_unavailable');
      })
      .finally(() => clearTimeout(lookupTimer));
    if (!addresses.length) throw new NewsFeedError('source_unavailable');
    addresses.forEach((item) => assertNewsAddress(item.address));
    const address = addresses[0];
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'Accept-Encoding': 'identity',
        'User-Agent': 'Nodia-News/1.0',
      };
      const etag = validator(validators.etag);
      const lastModified = validator(validators.lastModified);
      if (etag) headers['If-None-Match'] = etag;
      if (lastModified) headers['If-Modified-Since'] = lastModified;
      const req = request(
        source.feed_url,
        {
          method: 'GET',
          headers,
          agent: false,
          // Pin the vetted address; TLS SNI/certificate still validate the catalog host.
          lookup: (_hostname, options, callback) => {
            if (options.all) callback(null, [address]);
            else callback(null, address.address, address.family);
          },
        },
        (response) => {
          const status = response.statusCode ?? 0;
          const resultValidators = {
            etag: validator(response.headers.etag) ?? etag,
            lastModified:
              validator(response.headers['last-modified']) ?? lastModified,
          };
          if (status === 304) {
            response.destroy();
            resolve({
              status: 'not_modified',
              articles: [],
              ...resultValidators,
            });
            return;
          }
          if (status !== 200) {
            response.destroy();
            reject(
              new NewsFeedError(
                status === 429
                  ? 'source_rate_limited'
                  : status >= 300 && status < 400
                    ? 'unsafe_destination'
                    : 'source_unavailable',
                newsRetryAt(
                  typeof response.headers['retry-after'] === 'string'
                    ? response.headers['retry-after']
                    : undefined,
                  new Date(),
                ),
              ),
            );
            return;
          }
          const encoding = response.headers['content-encoding'];
          const type = response.headers['content-type'] ?? '';
          if (
            (encoding && encoding !== 'identity') ||
            !/^(?:application\/(?:rss\+xml|xml)|text\/xml)(?:;|$)/iu.test(type)
          ) {
            response.destroy();
            reject(new NewsFeedError('invalid_feed'));
            return;
          }
          const length = Number(response.headers['content-length']);
          if (Number.isFinite(length) && length > NEWS_MAX_BYTES) {
            response.destroy();
            reject(new NewsFeedError('response_too_large'));
            return;
          }
          const chunks: Buffer[] = [];
          let bytes = 0;
          response.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > NEWS_MAX_BYTES) {
              response.destroy();
              reject(new NewsFeedError('response_too_large'));
              return;
            }
            chunks.push(chunk);
          });
          response.on('error', () =>
            reject(new NewsFeedError('source_unavailable')),
          );
          response.on('end', () => {
            try {
              resolve({
                status: 'updated',
                articles: parseNewsFeed(
                  new TextDecoder('utf-8', { fatal: true }).decode(
                    Buffer.concat(chunks),
                  ),
                  new Date(),
                  source,
                ),
                ...resultValidators,
              });
            } catch (error) {
              reject(
                error instanceof NewsFeedError
                  ? error
                  : new NewsFeedError('invalid_feed'),
              );
            }
          });
        },
      );
      const timeout = setTimeout(
        () => req.destroy(new NewsFeedError('source_timeout')),
        Math.max(1, deadline - Date.now()),
      );
      req.on('error', (error) =>
        reject(
          error instanceof NewsFeedError
            ? error
            : new NewsFeedError('source_unavailable'),
        ),
      );
      req.on('close', () => clearTimeout(timeout));
      req.end();
    });
  }
}
