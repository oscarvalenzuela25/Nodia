import { describe, expect, it } from 'vitest';
import { newsPlainText, newsRetryAt, safeNewsUrl } from './news.policy.js';

describe('Personal News provider metadata', () => {
  it('extracts text and drops active content', () => {
    expect(
      newsPlainText(
        '<p>Read &amp; learn</p><script>steal()</script><style>hidden</style><b>now</b>',
        500,
      ),
    ).toBe('Read & learn now');
  });

  it('rejects unsafe schemes and embedded credentials and keeps article queries', () => {
    expect(safeNewsUrl('javascript:void(0)')).toBeNull();
    expect(safeNewsUrl('https://user:password@site.test/')).toBeNull();
    expect(safeNewsUrl('https://site.test/article?id=1#discussion')).toBe(
      'https://site.test/article?id=1',
    );
  });

  it('honors a future Retry-After and leaves missing or expired values unknown', () => {
    const now = new Date('2026-11-16T12:00:00Z');
    expect(newsRetryAt(undefined, now)).toBeNull();
    expect(newsRetryAt('60', now)?.toISOString()).toBe(
      '2026-11-16T12:01:00.000Z',
    );
    expect(
      newsRetryAt('Mon, 16 Nov 2026 12:02:00 GMT', now)?.toISOString(),
    ).toBe('2026-11-16T12:02:00.000Z');
    expect(newsRetryAt('Mon, 16 Nov 2026 11:59:00 GMT', now)).toBeNull();
    expect(newsRetryAt('invalid', now)).toBeNull();
  });
});
