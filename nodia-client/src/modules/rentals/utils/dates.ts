const DAY = 86400000;
export function isCivilDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1900-01-01"
  )
    return false;
  const instant = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(instant) &&
    new Date(instant).toISOString().slice(0, 10) === value
  );
}
export function isLocalTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function isTimezone(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 64 ||
    /^[+-]/.test(value)
  )
    return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}
export function addCivilDays(day: string, days: number): string {
  if (!isCivilDate(day) || !Number.isInteger(days))
    throw new Error("rental:invalid_interval");
  const result = new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
  if (!isCivilDate(result)) throw new Error("rental:invalid_interval");
  return result;
}
export function countNights(start: string, end: string): number {
  if (!isCivilDate(start) || !isCivilDate(end))
    throw new Error("rental:invalid_interval");
  const nights =
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY;
  if (nights < 1 || nights > 366) throw new Error("rental:invalid_interval");
  return nights;
}
function partsAt(instant: number, zone: string): string {
  if (!isTimezone(zone)) throw new Error("rental:invalid_local_time");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function todayInZone(zone: string, now = new Date()): string {
  return partsAt(now.getTime(), zone).slice(0, 10);
}
export function toLocalDateTime(instant: string, zone: string): string {
  if (
    !/T.+(?:Z|[+-]\d{2}:\d{2})$/.test(instant) ||
    !Number.isFinite(Date.parse(instant))
  )
    throw new Error("rental:invalid_local_time");
  return partsAt(Date.parse(instant), zone);
}
/** Resolve only a unique real civil minute. Probe timezone offsets around transitions. */
export function localDateTimeToInstant(local: string, zone: string): string {
  const [day, time] = local.split("T");
  if (!isCivilDate(day) || !isLocalTime(time) || !isTimezone(zone))
    throw new Error("rental:invalid_local_time");
  const anchor = Date.parse(`${local}:00Z`);
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const probe = anchor + hours * 3600000;
    offsets.add(Date.parse(`${partsAt(probe, zone)}:00Z`) - probe);
  }
  const candidates = [...offsets]
    .map((offset) => anchor - offset)
    .filter((value) => partsAt(value, zone) === local);
  if (candidates.length !== 1) throw new Error("rental:invalid_local_time");
  return new Date(candidates[0]).toISOString();
}
export function formatRentalInstant(
  instant: string,
  zone: string,
  language = "es",
): string {
  toLocalDateTime(instant, zone);
  return new Intl.DateTimeFormat(
    language.startsWith("es") ? "es-CL" : "en-US",
    { timeZone: zone, dateStyle: "medium", timeStyle: "short" },
  ).format(new Date(instant));
}
