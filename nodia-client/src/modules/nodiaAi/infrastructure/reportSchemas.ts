import { z } from "zod";

const key = z.string().min(1).max(1024);
const decimal = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/).max(256);
const count = z.string().regex(/^(?:0|[1-9]\d*)$/).max(256);
const instant = z.iso.datetime({ offset: true });
const bigintId = z.string().regex(/^[1-9]\d{0,18}$/).refine(value => BigInt(value) <= 9223372036854775807n);
const scope = z.object({ subject_user_id: bigintId.optional(), business_id: z.uuid().optional(), property_id: bigintId.optional(), provider_id: bigintId.optional() }).strict();
const period = z.object({ kind: z.enum(["civil_date", "instant"]), dimension_key: key, from: key, to_exclusive: key, timezone: key }).strict().superRefine((value, context) => {
  const schema = value.kind === "instant" ? instant : z.iso.date();
  if (!schema.safeParse(value.from).success || !schema.safeParse(value.to_exclusive).success) context.addIssue({ code: "custom", message: "nodia_ai:invalid_response" });
  try { new Intl.DateTimeFormat("en", { timeZone: value.timezone }); }
  catch { context.addIssue({ code: "custom", message: "nodia_ai:invalid_response" }); }
});
const scalar = z.union([z.string().max(65536), z.number().finite(), z.boolean(), z.null()]);
const column = z.object({ key, label_key: key, value_type: z.enum(["text", "decimal", "number", "boolean", "date", "instant"]), unit: key.nullable(), scale: z.number().int().min(0).max(100).nullable(), source_aliases: z.array(key).min(1).max(16) }).strict();
const source = z.object({
  status: z.enum(["ok", "empty"]), report_id: z.uuid(), catalog_version: key, source_key: key, source_alias: key,
  scope, columns: z.array(column).min(1).max(64), rows: z.array(z.array(scalar).max(64)).max(1000),
  totals: z.record(key, decimal), matched_records: count, period: period.nullable(), basis_key: key, observed_at: instant,
  group_page_complete: z.boolean(), next_cursor: z.string().min(1).max(65536).nullable(),
}).strict();
const provenance = z.object({ source_alias: key, source_key: key, observed_at: instant, scope, measure_keys: z.array(key).max(64), period: period.nullable(), basis_key: key, matched_records: count.nullable() }).strict();
const error = z.object({ code: key, message_key: key, safe_message: z.string().max(65536).optional(), field_errors: z.array(z.object({ field_key: key, code: key, message_key: key }).strict()).max(100), retry_action: z.enum(["none", "recover_status", "manual_after_review"]), correlation_id: z.uuid() }).strict();
function validCell(cell: z.infer<typeof scalar>, type: z.infer<typeof column>["value_type"] | undefined): boolean {
  if (cell === null) return true;
  switch (type) {
    case "decimal": return decimal.safeParse(cell).success;
    case "number": return typeof cell === "number" && Number.isSafeInteger(cell);
    case "boolean": return typeof cell === "boolean";
    case "text": return typeof cell === "string";
    case "date": return z.iso.date().safeParse(cell).success;
    case "instant": return instant.safeParse(cell).success;
    default: return false;
  }
}

export const nodiaAiReportSchema = z.object({
  status: z.enum(["ok", "empty", "partial", "needs_clarification"]), report_id: z.uuid(), catalog_version: key,
  combine: z.enum(["separate", "compare_compatible"]), snapshot_consistency: z.literal("independent_source_snapshots"),
  columns: z.array(column).max(256), rows: z.array(z.array(scalar).max(256)).max(1000), provenance: z.array(provenance).max(16),
  source_results: z.array(source).max(16), source_errors: z.array(z.object({ source_alias: key, error }).strict()).max(16),
  group_page_complete: z.boolean(), next_cursor: z.string().min(1).max(65536).nullable(), clarification_keys: z.array(key).max(100),
}).strict().superRefine((value, context) => {
  const fail = () => context.addIssue({ code: "custom", message: "nodia_ai:invalid_response" });
  const aliases = value.source_results.map(item => item.source_alias);
  const failures = value.source_errors.map(item => item.source_alias);
  if (new Set([...aliases, ...failures]).size !== aliases.length + failures.length
    || new Set(value.columns.map(item => item.key)).size !== value.columns.length
    || value.columns.some(item => item.source_aliases.some(alias => !aliases.includes(alias)))
    || value.rows.some(row => row.length !== value.columns.length)
    || value.rows.some(row => row.some((cell, index) => !validCell(cell, value.columns[index]?.value_type)))
    || new Set(value.provenance.map(item => item.source_alias)).size !== value.source_results.length
    || value.provenance.length !== value.source_results.length
    || value.group_page_complete !== (value.next_cursor === null)
    || value.status === "partial" && !failures.length
    || ["ok", "empty"].includes(value.status) && failures.length > 0
    || value.status === "empty" && value.source_results.some(item => item.status !== "empty")
    || !value.source_results.length && !failures.length && !value.clarification_keys.length) fail();
  for (const item of value.source_results) {
    const keys = item.columns.map(entry => entry.key);
    const origin = value.provenance.find(entry => entry.source_alias === item.source_alias);
    if (new Set(keys).size !== keys.length || item.catalog_version !== value.catalog_version
      || item.columns.some(entry => entry.source_aliases.length !== 1 || entry.source_aliases[0] !== item.source_alias)
      || !Object.keys(item.totals).length
      || item.rows.some(row => row.length !== keys.length)
      || item.group_page_complete !== (item.next_cursor === null)
      || (item.status === "empty") !== (item.matched_records === "0")
      || Object.keys(item.totals).some(name => !keys.includes(name))
      || !origin || origin.source_key !== item.source_key || origin.observed_at !== item.observed_at
      || origin.matched_records !== item.matched_records || origin.basis_key !== item.basis_key
      || JSON.stringify(origin.period) !== JSON.stringify(item.period)
      || Object.entries(item.scope).some(([name, id]) => origin.scope[name as keyof typeof origin.scope] !== id)
      || Object.keys(origin.scope).length !== Object.keys(item.scope).length) fail();
    if (item.rows.some(row => row.some((cell, index) => !validCell(cell, item.columns[index]?.value_type)))) fail();
  }
});

export type NodiaAiReport = z.infer<typeof nodiaAiReportSchema>;
export type NodiaAiReportSource = NodiaAiReport["source_results"][number];

/** Locale grouping on BigInt and textual fractional digits preserves exact monetary precision. */
export function formatReportDecimal(value: string, locale: string): string {
  const [integer, fraction] = value.split(".");
  const negative = integer.startsWith("-");
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(integer));
  const sign = negative && BigInt(integer) === 0n ? new Intl.NumberFormat(locale).formatToParts(-1).find(part => part.type === "minusSign")?.value ?? "-" : "";
  if (fraction === undefined) return `${sign}${whole}`;
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === "decimal")?.value ?? ".";
  return `${sign}${whole}${separator}${fraction}`;
}
