import { describe, expect, it } from 'vitest';
import { cashMonthlyPeriod, isCashMovementDate } from './cash-movement-date.js';

describe('Cash civil dates', () => {
  it.each(['0001-01-01', '2000-02-29', '2024-02-29', '9999-12-31'])(
    'accepts the Gregorian date %s',
    (date) => expect(isCashMovementDate(date)).toBe(true),
  );

  it.each([
    '0000-01-01',
    '0099-02-29',
    '1900-02-29',
    '2026-11-31',
    '2026-1-01',
    '2026-00-01',
    '2026-11-00',
    '2026-11-01\n',
    '2026-11-01T00:00:00Z',
    null,
  ])('rejects non-civil input %j', (date) => {
    expect(isCashMovementDate(date)).toBe(false);
  });

  it.each([
    ['2024-03-01T02:59:59.999Z', '2024-02-01', '2024-02-29'],
    ['2024-03-01T03:00:00.000Z', '2024-03-01', '2024-03-31'],
    ['2026-07-01T03:59:59.999Z', '2026-06-01', '2026-06-30'],
    ['2026-07-01T04:00:00.000Z', '2026-07-01', '2026-07-31'],
  ])('returns the Santiago month for instant %s', (instant, from, to) => {
    expect(cashMonthlyPeriod(new Date(instant))).toEqual({
      from,
      to,
      time_zone: 'America/Santiago',
    });
  });
});
