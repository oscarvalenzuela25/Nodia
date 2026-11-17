import type { CashMonthlySummary } from '../types/cash.types.js';

export const CASH_TIME_ZONE = 'America/Santiago';

const monthFormatter = new Intl.DateTimeFormat('en-CA', {
  calendar: 'iso8601',
  numberingSystem: 'latn',
  timeZone: CASH_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
});
const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year: number, month: number): number {
  if (month === 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))
    return 29;
  return monthLengths[month - 1];
}

export function isCashMovementDate(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length !== 10 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  )
    return false;

  const [year, month, day] = value.split('-').map(Number);
  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

export function cashMonthlyPeriod(instant: Date): CashMonthlySummary['period'] {
  const parts = monthFormatter.formatToParts(instant);
  const year = parts
    .find((part) => part.type === 'year')!
    .value.padStart(4, '0');
  const month = parts.find((part) => part.type === 'month')!.value;
  const lastDay = daysInMonth(Number(year), Number(month));
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${lastDay}`,
    time_zone: CASH_TIME_ZONE,
  };
}
