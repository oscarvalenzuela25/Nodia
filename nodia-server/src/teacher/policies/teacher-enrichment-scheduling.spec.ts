import { describe, expect, it } from 'vitest';
import {
  dueAtLocalNoon,
  rateReview,
  validTimezone,
} from './teacher-enrichment-scheduling.js';
import type { ReviewSchedule } from '../types/teacher-enrichment.types.js';

const schedule: ReviewSchedule = {
  due_at: '2026-01-01T00:00:00.000Z',
  timezone: 'America/Santiago',
  state: 'new',
  interval_days: 0,
  reviews: 0,
};
describe('Teacher calendar intervals', () => {
  it('keeps local noon across Chile fall-back rather than assuming 24 elapsed hours', () => {
    expect(
      dueAtLocalNoon(Date.parse('2026-04-04T15:00:00Z'), 1, 'America/Santiago'),
    ).toBe('2026-04-05T16:00:00.000Z');
  });
  it('keeps local noon across spring-forward', () => {
    expect(
      dueAtLocalNoon(Date.parse('2026-03-07T17:00:00Z'), 1, 'America/New_York'),
    ).toBe('2026-03-08T16:00:00.000Z');
  });
  it('uses actual elapsed minutes for a forgotten card without mutating its original', () => {
    const next = rateReview(schedule, 1, 0);
    expect(next).toMatchObject({
      due_at: '1970-01-01T00:10:00.000Z',
      state: 'learning',
      interval_days: 0,
      reviews: 1,
    });
    expect(schedule.reviews).toBe(0);
  });
  it('caps growth and retains the selected timezone and explicit history count', () => {
    expect(
      rateReview(
        { ...schedule, interval_days: 200, reviews: 20 },
        4,
        Date.parse('2026-11-11T15:00:00Z'),
      ),
    ).toMatchObject({
      interval_days: 365,
      reviews: 21,
      timezone: 'America/Santiago',
      state: 'review',
    });
  });
  it('uses the stored card zone at a civil-day boundary rather than a later user zone', () => {
    const instant = Date.parse('2026-11-11T03:30:00Z');
    const original = { ...schedule, timezone: 'America/Santiago' };
    const changedPreference = 'America/New_York';
    expect(rateReview(original, 2, instant).due_at).toBe('2026-11-12T15:00:00.000Z');
    expect(rateReview({ ...original, timezone: changedPreference }, 2, instant).due_at).toBe('2026-11-11T17:00:00.000Z');
    expect(original.timezone).toBe('America/Santiago');
    expect(dueAtLocalNoon(instant, 1, 'Asia/Kathmandu')).toBe('2026-11-12T06:15:00.000Z');
  });
  it('refuses unknown zones, invalid results and calendar days removed by a timezone change', () => {
    expect(() => validTimezone('not/a_zone')).toThrow();
    expect(() => rateReview(schedule, 0, 0)).toThrow();
    expect(() =>
      rateReview({ ...schedule, interval_days: -1 }, 3, 0),
    ).toThrow();
    expect(() =>
      dueAtLocalNoon(Date.parse('2011-12-29T22:00:00Z'), 1, 'Pacific/Apia'),
    ).toThrow();
  });
});
