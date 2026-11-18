import { Temporal } from "temporal-polyfill";

export const CASH_TIME_ZONE = "America/Santiago";
export const CASH_AMOUNT_PATTERN = /^[1-9][0-9]{0,12}$/;

export const trimCashText = (value: string): string =>
  value.replace(/^[\p{White_Space}\uFEFF]+|[\p{White_Space}\uFEFF]+$/gu, "");

export const isCashCivilDate = (value: string): boolean => {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith("0000")) return false;
  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
};

export const cashToday = (now = Date.now()): string =>
  Temporal.Instant.fromEpochMilliseconds(now)
    .toZonedDateTimeISO(CASH_TIME_ZONE)
    .toPlainDate()
    .toString();

export const isCashCivilMonth = (from: string, to: string): boolean =>
  isCashCivilDate(from) &&
  isCashCivilDate(to) &&
  from.slice(0, 7) === to.slice(0, 7) &&
  from.endsWith("-01") &&
  Number(to.slice(8)) === Temporal.PlainDate.from(from).daysInMonth;

const amountFormatters = new Map<string, Intl.NumberFormat>();

export function formatCashAmount(amount: string, locale: string): string {
  const isEnglish = locale.toLowerCase().startsWith("en");
  const formatLocale = isEnglish ? "en-US" : "es-CL";
  let formatter = amountFormatters.get(formatLocale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(formatLocale, {
      style: "currency",
      currency: "CLP",
      currencyDisplay: "code",
      maximumFractionDigits: 0,
    });
    amountFormatters.set(formatLocale, formatter);
  }
  return formatter.format(BigInt(amount));
}
