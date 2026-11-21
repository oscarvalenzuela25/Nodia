import { CONTACT_DAYS } from '../../provider-contact/types/provider-contact.types.js';
import type { ContactSchedule } from '../../provider-contact/types/provider-contact.types.js';

const minute = 60_000;
const civilDay = 24 * 60 * minute;
const leadTime = 30 * minute;
const localTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const santiago = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
  timeZone: 'America/Santiago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const wallParts = ['year', 'month', 'day', 'hour', 'minute'];

function wallTime(instant: number): number {
  const parts = santiago.formatToParts(instant);
  const [year, month, day, hour, minutes] = wallParts.map((key) =>
    Number(parts.find((part) => part.type === key)?.value),
  );
  return Date.UTC(year, month - 1, day, hour, minutes);
}

/** Earlier instant for a fold, and move forward by the offset change for a gap. */
function resolveLocalTime(visitDate: string, time: string): number {
  const desired = Date.parse(`${visitDate}T${time}:00Z`);
  const offsets = new Set(
    [-36, 36].map((hours) => {
      const sample = desired + hours * 60 * minute;
      return wallTime(sample) - sample;
    }),
  );
  const candidates = [...offsets]
    .map((offset) => {
      const instant = desired - offset;
      return { instant, wall: wallTime(instant) };
    })
    .filter((candidate) => candidate.wall >= desired)
    .sort((a, b) => a.wall - b.wall || a.instant - b.instant);
  if (!candidates.length) throw new Error('visit_local_time_unresolved');
  return candidates[0].instant;
}

type AlarmBasis =
  'provider_alarm' | 'visit_start' | 'late_alarm_fallback' | 'default_hour';

interface VisitOccurrence {
  visitDate: string;
  visitStartsAt: Date | null;
  sendAt: Date;
  expiresAt: Date;
  alarmBasis: AlarmBasis;
}

function calculateOccurrence(
  visitDate: string,
  visitStart: string | null,
  alarm: string | null,
): VisitOccurrence {
  const startsAt =
    visitStart === null ? null : resolveLocalTime(visitDate, visitStart);
  const fixed = alarm === null ? null : resolveLocalTime(visitDate, alarm);
  let sendAt: number;
  let alarmBasis: AlarmBasis;
  if (fixed !== null && (startsAt === null || fixed < startsAt)) {
    sendAt = fixed;
    alarmBasis = 'provider_alarm';
  } else if (startsAt !== null) {
    sendAt = startsAt - leadTime;
    alarmBasis = fixed === null ? 'visit_start' : 'late_alarm_fallback';
  } else {
    sendAt = resolveLocalTime(visitDate, '09:00');
    alarmBasis = 'default_hour';
  }
  return {
    visitDate,
    visitStartsAt: startsAt === null ? null : new Date(startsAt),
    sendAt: new Date(sendAt),
    expiresAt: new Date(Math.min(sendAt + leadTime, startsAt ?? Infinity)),
    alarmBasis,
  };
}

export function planVisitOccurrences(
  schedule: ContactSchedule,
  alarm: string | null,
  asOf: Date,
): VisitOccurrence[] {
  if (alarm !== null && !localTime.test(alarm))
    throw new Error('visit_alarm_time_invalid');
  const now = asOf.getTime();
  const today = Date.parse(
    `${new Date(wallTime(now)).toISOString().slice(0, 10)}T00:00:00Z`,
  );
  const planned: VisitOccurrence[] = [];
  // Yesterday can still be in its window. Tomorrow's early visits can be due today.
  for (let offset = -1; offset <= 7; offset++) {
    const day = new Date(today + offset * civilDay);
    const ranges = schedule[CONTACT_DAYS[(day.getUTCDay() + 6) % 7]];
    if (!Array.isArray(ranges) || ranges.length !== 1 || !ranges[0]) continue;
    const { from, to } = ranges[0];
    const pending = from === null && to === null;
    const timed =
      typeof from === 'string' &&
      typeof to === 'string' &&
      localTime.test(from) &&
      localTime.test(to) &&
      from < to;
    if (!pending && !timed) continue;
    const occurrence = calculateOccurrence(
      day.toISOString().slice(0, 10),
      from,
      alarm,
    );
    if (occurrence.expiresAt.getTime() > now) planned.push(occurrence);
  }
  return planned;
}
