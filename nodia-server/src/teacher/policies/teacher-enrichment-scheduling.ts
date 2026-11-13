import { teacherError } from './teacher-validation.js';
import type { ReviewSchedule } from '../types/teacher-enrichment.types.js';

export function validTimezone(value: unknown): string {
  if (typeof value !== 'string' || value.length > 100)
    teacherError('invalid_input', 400);
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
  } catch {
    teacherError('invalid_input', 400);
  }
  return value;
}
function localParts(epoch: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(epoch);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: n('year'),
    month: n('month'),
    day: n('day'),
    hour: n('hour'),
    minute: n('minute'),
  };
}
/** Calendar intervals end at local noon; elapsed learning minutes remain UTC. */
export function dueAtLocalNoon(
  now: number,
  days: number,
  timezone: string,
): string {
  validTimezone(timezone);
  if (
    !Number.isFinite(now) ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  )
    teacherError('invalid_input', 400);
  const local = localParts(now, timezone);
  const target = new Date(
    Date.UTC(local.year, local.month - 1, local.day + days, 12),
  );
  const desired = target.getTime();
  let candidate = desired;
  for (let i = 0; i < 5; i++) {
    const p = localParts(candidate, timezone);
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    candidate += desired - represented;
    if (represented === desired) return new Date(candidate).toISOString();
  }
  // A civil day may not exist after a timezone/dateline rule change. Never guess.
  teacherError('calendar_date_unavailable', 409);
}
export function rateReview(
  schedule: ReviewSchedule,
  rating: number,
  now: number,
): ReviewSchedule {
  validTimezone(schedule.timezone);
  if (
    ![1, 2, 3, 4].includes(rating) ||
    !Number.isFinite(now) ||
    !Number.isSafeInteger(schedule.reviews) ||
    schedule.reviews < 0 ||
    !Number.isSafeInteger(schedule.interval_days) ||
    schedule.interval_days < 0 ||
    schedule.interval_days > 365
  )
    teacherError('invalid_input', 400);
  if (rating === 1)
    return {
      ...schedule,
      due_at: new Date(now + 600000).toISOString(),
      state: 'learning',
      interval_days: 0,
      reviews: schedule.reviews + 1,
    };
  const days =
    rating === 2
      ? 1
      : Math.min(
          365,
          Math.max(
            rating === 4 ? 4 : 2,
            schedule.interval_days * (rating === 4 ? 4 : 2),
          ),
        );
  return {
    ...schedule,
    due_at: dueAtLocalNoon(now, days, schedule.timezone),
    state: 'review',
    interval_days: days,
    reviews: schedule.reviews + 1,
  };
}
