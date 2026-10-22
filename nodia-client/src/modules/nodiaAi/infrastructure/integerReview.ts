/** Registered native PostgreSQL int32 values remain numbers; bigint identifiers remain strings. */
export function parseNodiaAiInteger(value: unknown, minimum: string | null, maximum: string | null): number | null {
  if (typeof value !== "string" || !/^(?:0|-[1-9]\d*|[1-9]\d*)$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < -2147483648 || parsed > 2147483647
    || minimum !== null && BigInt(value) < BigInt(minimum) || maximum !== null && BigInt(value) > BigInt(maximum)) return null;
  return parsed;
}
export function isNodiaAiInteger(value: unknown, minimum: string | null, maximum: string | null): value is number {
  return typeof value === "number" && !Object.is(value, -0) && parseNodiaAiInteger(String(value), minimum, maximum) !== null;
}
