import { BadRequestException } from '@nestjs/common';

export function isCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split('-').map(Number);
  if (
    year < 1900 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
export function isLocalTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function isTimezone(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length > 64 ||
    !/^[A-Za-z_]+(?:\/[A-Za-z_+\-0-9]+)+$|^(?:UTC|GMT)$/.test(value)
  )
    return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export function isRentalInstant(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    ) ||
    !isCivilDate(value.slice(0, 10))
  )
    return false;
  return Number.isFinite(Date.parse(value));
}
function parts(date: Date, timezone: string): number[] {
  const values = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return ['year', 'month', 'day', 'hour', 'minute', 'second'].map((key) =>
    Number(values.find((part) => part.type === key)?.value),
  );
}
export function formatLocalOn(date: Date, timezone: string): string {
  const [year, month, day] = parts(date, timezone);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
/** Resolve exactly one local instant. Never choose an arbitrary DST offset. */
export function localInstant(on: string, time: string, timezone: string): Date {
  const minuteTime = /^\d{2}:\d{2}:00$/.test(time) ? time.slice(0, 5) : time;
  if (!isCivilDate(on) || !isLocalTime(minuteTime) || !isTimezone(timezone))
    throw new BadRequestException('rental:invalid_local_time');
  const [year, month, day] = on.split('-').map(Number),
    [hour, minute] = minuteTime.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute),
    offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = new Date(wall + hours * 3600000),
      [y, m, d, h, min, sec] = parts(sample, timezone);
    offsets.add(Date.UTC(y, m - 1, d, h, min, sec) - sample.getTime());
  }
  const matches = [...offsets]
    .map((offset) => new Date(wall - offset))
    .filter((date) => {
      const p = parts(date, timezone);
      return (
        p[0] === year &&
        p[1] === month &&
        p[2] === day &&
        p[3] === hour &&
        p[4] === minute &&
        p[5] === 0
      );
    });
  if (matches.length !== 1)
    throw new BadRequestException('rental:invalid_local_time');
  return matches[0];
}
export function civilDays(from: string, to: string): number {
  if (!isCivilDate(from) || !isCivilDate(to))
    throw new BadRequestException('rental:invalid_input');
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
  );
}
