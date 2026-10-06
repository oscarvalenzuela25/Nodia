const zone = "America/Santiago";
const calendar = new Intl.DateTimeFormat("en", {
  timeZone: zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function calendarDay(timestamp: number): string {
  const parts = calendar.formatToParts(new Date(timestamp));
  const part = (name: string) =>
    parts.find((value) => value.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validateDay(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error("finance:invalid_period");
  const parsed = Date.parse(`${day}T00:00:00Z`);
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== day
  )
    throw new Error("finance:invalid_period");
  return parsed;
}

/** Find the start of the actual local day, including Chilean midnight DST gaps. */
function startOfDay(day: string): string {
  const anchor = validateDay(day);
  let low = anchor - 86400000;
  let high = anchor + 2 * 86400000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (calendarDay(middle) < day) low = middle + 1;
    else high = middle;
  }
  if (calendarDay(low) !== day) throw new Error("finance:invalid_period");
  return new Date(low).toISOString();
}

export function financePeriod(
  start: string,
  end: string,
): { created_at_gteq?: string; created_at_lt?: string } {
  if (start) validateDay(start);
  if (end) validateDay(end);
  if (start && end && start > end) throw new Error("finance:invalid_period");
  return {
    ...(start ? { created_at_gteq: startOfDay(start) } : {}),
    ...(end
      ? {
          created_at_lt: startOfDay(
            new Date(validateDay(end) + 86400000).toISOString().slice(0, 10),
          ),
        }
      : {}),
  };
}

export function formatFinanceDate(value: string, language = "es"): string {
  return new Intl.DateTimeFormat(
    language.startsWith("es") ? "es-CL" : "en-US",
    {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}
