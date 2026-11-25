import { Temporal } from "temporal-polyfill";
import { z } from "zod";

const maxDays = 366;
const maxCategories = 12;
const maxRequestBytes = 256 * 1024;
const requestKeyForSize = "00000000-0000-0000-0000-000000000000";

const safeString = z.string().refine(
  (value) => !value.includes("\0") && !/[\uD800-\uDFFF]/u.test(value),
);
const text = (max: number, min = 1) => safeString.transform((value) => value.trim())
  .pipe(z.string().min(min).max(max));

function normalizeCategory(name: string) {
  return name.normalize("NFKC").replace(/[\p{White_Space}\uFEFF]+/gu, " ").trim();
}

function categoryKey(name: string) {
  return normalizeCategory(name).toLocaleLowerCase("es").normalize("NFKC");
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || value.startsWith("0000")) return false;

  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
}

function isHttpsReference(value: string) {
  if (!/^https:\/\//iu.test(value) || /[\p{White_Space}\\]/u.test(value)) return false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || (code >= 127 && code <= 159)) return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

const category = safeString.transform(normalizeCategory).pipe(z.string().min(1).max(120));
const civilDate = z.string().refine(isDate);
const activity = z.strictObject({
  text: text(512),
  source: z.strictObject({ label: text(180), url: text(2048).refine(isHttpsReference) }).optional(),
});
const dayFields = {
  title: text(120, 0).optional(),
  notes: text(4000, 0).optional(),
  minutes: z.number().int().min(1).max(1440).optional(),
  activities: z.array(activity).max(24).optional(),
};
const numberedDay = z.strictObject({ day: z.number().int().min(1).max(maxDays), ...dayFields });
const datedDay = z.strictObject({ date: civilDate, ...dayFields });
const planHeader = z.strictObject({
  version: z.literal(1),
  title: text(120),
  categories: z.array(category).max(maxCategories).optional(),
  schedule: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("numbered"), days: z.number().int().min(1).max(maxDays) }),
    z.strictObject({ kind: z.literal("dated"), start: civilDate, end: civilDate }),
  ]),
  days: z.array(z.unknown()).max(maxDays).optional(),
});

type ImportedDay = z.infer<typeof numberedDay> | z.infer<typeof datedDay>;
export type StudyCalendarImportPlan = Omit<z.infer<typeof planHeader>, "days"> & { days?: ImportedDay[] };

type ImportErrorCode =
  | "empty" | "invalid_json" | "payload_size" | "invalid_version" | "invalid_field"
  | "date_range" | "duplicate_category" | "duplicate_day" | "day_outside_schedule";

type ImportError = {
  code: ImportErrorCode;
  field?: string;
  dayIndex?: number;
  activityIndex?: number;
};

export type StudyCalendarImportResult =
  | { ok: true; plan: StudyCalendarImportPlan; dayCount: number }
  | { ok: false; issue: ImportError };

function bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export function fitsStudyCalendarImportRequest(plan: StudyCalendarImportPlan, newCategories: readonly string[]) {
  return bytes(JSON.stringify({ request_key: requestKeyForSize, plan, new_categories: newCategories })) <= maxRequestBytes;
}

function failed(code: ImportErrorCode, details: Omit<ImportError, "code"> = {}): StudyCalendarImportResult {
  return { ok: false, issue: { code, ...details } };
}

function invalidField(error: z.ZodError, dayIndex?: number): StudyCalendarImportResult {
  const [issue] = error.issues;
  const path = issue.path.map(String).map((key) => /^\d+$/u.test(key) ? String(Number(key) + 1) : key);
  if (issue.code === "unrecognized_keys") path.push(...issue.keys);
  if (dayIndex === undefined && path[0] === "version") return failed("invalid_version");

  return failed("invalid_field", {
    field: path.join(".") || "JSON",
    dayIndex,
    activityIndex: path[0] === "activities" && /^\d+$/u.test(path[1] ?? "") ? Number(path[1]) : undefined,
  });
}

export function parseStudyCalendarImport(input: string): StudyCalendarImportResult {
  if (bytes(input) > maxRequestBytes) return failed("payload_size");
  const value = input.trim();
  if (!value) return failed("empty");

  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return failed("invalid_json");
  }

  const parsed = planHeader.safeParse(raw);
  if (!parsed.success) return invalidField(parsed.error);

  const { days, ...header } = parsed.data;
  const names = header.categories ?? [];
  const keys = names.map(categoryKey);
  if (new Set(keys).size !== keys.length) return failed("duplicate_category");

  const { schedule } = header;
  let dayCount: number;
  if (schedule.kind === "numbered") {
    dayCount = schedule.days;
  } else {
    const start = Temporal.PlainDate.from(schedule.start);
    const end = Temporal.PlainDate.from(schedule.end);
    dayCount = start.until(end, { largestUnit: "day" }).days + 1;
    if (dayCount < 1 || dayCount > maxDays) return failed("date_range");
  }

  const imported: ImportedDay[] = [];
  const seen = new Set<number | string>();
  for (const [index, row] of (days ?? []).entries()) {
    const parsedDay = (schedule.kind === "numbered" ? numberedDay : datedDay).safeParse(row);
    const dayIndex = index + 1;
    if (!parsedDay.success) return invalidField(parsedDay.error, dayIndex);

    const day = parsedDay.data;
    const key = "day" in day ? day.day : day.date;
    const outside = schedule.kind === "numbered"
      ? typeof key !== "number" || key > dayCount
      : typeof key !== "string" || key < schedule.start || key > schedule.end;
    if (outside) return failed("day_outside_schedule", { dayIndex });
    if (seen.has(key)) return failed("duplicate_day", { dayIndex });

    seen.add(key);
    imported.push(day);
  }

  const plan = { ...header, ...(days === undefined ? {} : { days: imported }) };
  if (!fitsStudyCalendarImportRequest(plan, [])) return failed("payload_size");
  return { ok: true, plan, dayCount };
}

export function classifyStudyCalendarImportCategories(
  names: readonly string[],
  categories: readonly { name: string; active: boolean }[],
) {
  const existing = new Map(categories.map((category) => [categoryKey(category.name), category]));
  const result = { reused: [] as string[], newCategories: [] as string[], inactive: [] as string[] };
  for (const name of names) {
    const category = existing.get(categoryKey(name));
    if (!category) result.newCategories.push(name);
    else if (category.active) result.reused.push(category.name);
    else result.inactive.push(category.name);
  }
  return result;
}
