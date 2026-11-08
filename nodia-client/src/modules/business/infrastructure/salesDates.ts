import { Temporal } from "temporal-polyfill";
export const salesPeriod = (from: string, through: string) => {
  const start = Temporal.PlainDate.from(from), end = Temporal.PlainDate.from(through);
  if (Temporal.PlainDate.compare(start, end) > 0) throw new Error("invalid_period");
  return { from: start.toZonedDateTime("America/Santiago").toInstant().toString(), to_exclusive: end.add({ days: 1 }).toZonedDateTime("America/Santiago").toInstant().toString() };
};
