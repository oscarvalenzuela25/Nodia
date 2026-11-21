import { describe, expect, it } from 'vitest';
import type { ContactSchedule } from '../../provider-contact/types/provider-contact.types.js';
import { planVisitOccurrences } from './provider-visit-occurrence.js';

const visitDate = '2026-11-18';
const asOf = new Date(`${visitDate}T10:00:00Z`);

describe('provider visit reminder timing', () => {
  it.each([
    ['08:45', 'provider_alarm', '11:45', '12:15'],
    [null, 'visit_start', '13:00', '13:30'],
    ['10:30', 'late_alarm_fallback', '13:00', '13:30'],
    ['11:30', 'late_alarm_fallback', '13:00', '13:30'],
    ['10:20', 'provider_alarm', '13:20', '13:30'],
  ])(
    'uses %s for a timed visit with a bounded delivery window',
    (alarm, alarmBasis, send, expiry) => {
      const schedule = { wednesday: [{ from: '10:30', to: '12:00' }] };
      const occurrence = planVisitOccurrences(schedule, alarm, asOf)[0];
      expect(occurrence).toEqual({
        visitDate,
        visitStartsAt: new Date(`${visitDate}T13:30:00Z`),
        sendAt: new Date(`${visitDate}T${send}:00Z`),
        expiresAt: new Date(`${visitDate}T${expiry}:00Z`),
        alarmBasis,
      });
    },
  );

  it.each([
    [null, 'default_hour', '12:00'],
    ['08:45', 'provider_alarm', '11:45'],
  ])(
    'keeps the start unknown for a visit with a day and alarm %s',
    (alarm, alarmBasis, send) => {
      const schedule = { wednesday: [{ from: null, to: null }] };
      expect(planVisitOccurrences(schedule, alarm, asOf)[0]).toMatchObject({
        visitDate,
        visitStartsAt: null,
        sendAt: new Date(`${visitDate}T${send}:00Z`),
        alarmBasis,
      });
    },
  );

  it('includes a reminder due the civil day before an early visit', () => {
    const schedule = { thursday: [{ from: '00:15', to: '01:00' }] };
    const now = new Date('2026-11-19T02:55:00Z');
    expect(planVisitOccurrences(schedule, null, now)[0]).toMatchObject({
      visitDate: '2026-11-19',
      sendAt: new Date('2026-11-19T02:45:00Z'),
      expiresAt: new Date('2026-11-19T03:15:00Z'),
    });
  });

  it('recovers yesterday only while its notification window is still open', () => {
    const schedule = { wednesday: [{ from: null, to: null }] };
    const now = new Date('2026-11-19T03:10:00Z');
    expect(planVisitOccurrences(schedule, '23:50', now)[0]).toMatchObject({
      visitDate,
      sendAt: new Date('2026-11-19T02:50:00Z'),
      expiresAt: new Date('2026-11-19T03:20:00Z'),
    });
    const expired = new Date('2026-11-19T03:20:00Z');
    expect(planVisitOccurrences(schedule, '23:50', expired)[0].visitDate).toBe(
      '2026-11-25',
    );
  });

  it('uses the first instant in a Chilean clock fold', () => {
    const schedule = { saturday: [{ from: '23:50', to: '23:59' }] };
    const now = new Date('2026-04-04T14:00:00Z');
    expect(planVisitOccurrences(schedule, null, now)[0]).toMatchObject({
      visitDate: '2026-04-04',
      visitStartsAt: new Date('2026-04-05T02:50:00Z'),
      sendAt: new Date('2026-04-05T02:20:00Z'),
    });
  });

  it('moves a Chilean clock-gap time forward and compares actual instants', () => {
    const schedule = { sunday: [{ from: '00:15', to: '02:00' }] };
    const now = new Date('2026-09-05T15:00:00Z');
    expect(planVisitOccurrences(schedule, '01:00', now)[0]).toMatchObject({
      visitDate: '2026-09-06',
      visitStartsAt: new Date('2026-09-06T04:15:00Z'),
      sendAt: new Date('2026-09-06T04:00:00Z'),
      expiresAt: new Date('2026-09-06T04:15:00Z'),
      alarmBasis: 'provider_alarm',
    });
  });

  it('skips empty and invalid historical daily entries without inventing visits', () => {
    const schedule = {
      wednesday: [],
      thursday: [{ from: '09:00' }],
    } as ContactSchedule;
    expect(planVisitOccurrences(schedule, null, asOf)).toEqual([]);
  });
});
