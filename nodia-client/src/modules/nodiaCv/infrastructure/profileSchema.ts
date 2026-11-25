import { z } from "zod";

const required = "nodiaCv:validation.required";
const maxLength = "nodiaCv:validation.length";
const invalidDate = "nodiaCv:validation.date";
const invalidDates = "nodiaCv:invalid_profile_dates";
const invalidUrl = "nodiaCv:validation.url";
const limitRows = "nodiaCv:validation.rows";
const limitLines = "nodiaCv:validation.lines";
export const profileRowLimit = 25;
export const profilesPageSize = 10;

const lengthLimited = (schema: z.ZodString, max: number) =>
  schema.refine(value => Array.from(value).length <= max, maxLength);
const name = (max = 160) => lengthLimited(z.string().trim().min(1, required), max);
const optionalValue = <Value extends string>(schema: z.ZodType<Value, string>) => z.string().trim()
  .optional().transform(value => value || undefined).pipe(schema.optional());
const text = (max = 160) => optionalValue(lengthLimited(z.string(), max));
const month = optionalValue(z.string().regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/, invalidDate));
const year = optionalValue(z.string().regex(/^(?!0000)\d{4}$/, invalidDate));
const optionalEmail = optionalValue(z.email("nodiaCv:validation.email").max(254, maxLength));
const url = optionalValue(z.url({ protocol: /^https?$/, message: invalidUrl }).max(2048, maxLength)
  .refine(value => /^https?:\/\//i.test(value) && !/^https?:\/\/[^/?#]*@/i.test(value), invalidUrl));
const experienceStatus = z.union([z.literal(""), z.enum(["current", "finished"])]).optional().transform(value => value || undefined);
const linesSchema = (length: number) => z.array(name(length)).max(30, limitLines);
const editLinesSchema = (length: number) => {
  const lines = linesSchema(length);
  return z.union([z.array(z.string()), z.string()])
    .transform(value => Array.isArray(value) ? value : value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)).pipe(lines);
};

const collection = <Row extends z.ZodType>(row: Row) => z.array(row).max(profileRowLimit, limitRows);

function datesInOrder(start: string | undefined, end: string | undefined) {
  return !start || !end || start <= end;
}

function profileSchema<Lines extends z.ZodType<string[]>, Id extends z.ZodType<string | undefined>>(makeLines: (length: number) => Lines, id: Id) {
  const lines = makeLines(500);
  const skills = makeLines(100);
  const entry = { id };
  const experienceSchema = z.object({
    ...entry, company: name(), position: name(), location: text(),
    status: experienceStatus,
    start_month: month, end_month: month, highlights: lines, technologies: skills,
  }).superRefine((value, context) => {
    if (!datesInOrder(value.start_month, value.end_month) || (value.status === "current" && value.end_month)) {
      context.addIssue({ code: "custom", path: ["end_month"], message: invalidDates });
    }
  });
  const projectSchema = z.object({
    ...entry, name: name(), role: text(), status: text(120), validation_context: text(4000),
    start_month: month, end_month: month, contributions: lines, technologies: skills, url,
  }).refine(value => datesInOrder(value.start_month, value.end_month), { path: ["end_month"], message: invalidDates });
  const educationSchema = z.object({
    ...entry, title: name(200), institution: name(200), start_year: year, end_year: year, details: text(4000),
  }).refine(value => datesInOrder(value.start_year, value.end_year), { path: ["end_year"], message: invalidDates });
  return z.object({
    profile_name: name(120), full_name: name(), professional_title: text(), second_title: text(), summary: text(4000),
    main_stack: skills,
    contact: z.object({
      location: text(), email: optionalEmail, phone: text(60),
      linkedin_url: url, github_url: url, portfolio_url: url,
    }),
    experiences: collection(experienceSchema),
    projects: collection(projectSchema),
    skill_areas: collection(z.object({ ...entry, name: name(), skills })),
    education: collection(educationSchema),
    certifications: collection(z.object({ ...entry, name: name(200), issuer: text(200), year, credential_id: text(), verification_url: url })),
    languages: collection(z.object({ ...entry, language: name(100), level: text(120), usage: text(4000) })),
    additional_sections: collection(z.object({ ...entry, title: name(), lines })),
  });
}

export const profileEditorSchema = profileSchema(editLinesSchema, z.uuidv4().optional()).refine(
  value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 96 * 1024,
  { path: ["root"], message: "nodiaCv:profile_too_large" },
);

const profileRecordData = profileSchema(linesSchema, z.uuidv4());
export const profileRecordSchema = z.intersection(profileRecordData, z.object({
  id: z.uuidv4(), revision: z.int().positive(), schema_version: z.literal(1),
  created_at: z.string(), updated_at: z.string(),
}));

export const profileSummarySchema = z.object({
  id: z.uuidv4(), revision: z.int().positive(), profile_name: name(120), full_name: name(),
  professional_title: text(), updated_at: z.string().optional(),
});

export const profilePageSchema = z.object({
  items: z.array(profileSummarySchema), total: z.int().nonnegative(), page: z.int().positive(), page_size: z.int().positive(),
});

export type ProfileForm = z.input<typeof profileEditorSchema>;
export type ProfileInput = z.output<typeof profileEditorSchema>;
export type ProfileRecord = z.output<typeof profileRecordSchema>;
export type ProfileSummary = z.output<typeof profileSummarySchema>;

export const emptyProfile: ProfileForm = {
  profile_name: "", full_name: "", main_stack: [], contact: {},
  experiences: [], projects: [], skill_areas: [], education: [], certifications: [], languages: [], additional_sections: [],
};

const withoutIds = <T extends { id?: string }>(rows: T[]) => rows.map(row => {
  const copy = { ...row };
  delete copy.id;
  return copy;
});

export function profileEditorValues(record: ProfileRecord, copyName?: string): ProfileForm {
  const profile = profileRecordData.parse(record);
  if (copyName === undefined) return profile;
  return {
    ...profile, profile_name: copyName,
    experiences: withoutIds(profile.experiences), projects: withoutIds(profile.projects),
    skill_areas: withoutIds(profile.skill_areas), education: withoutIds(profile.education),
    certifications: withoutIds(profile.certifications), languages: withoutIds(profile.languages),
    additional_sections: withoutIds(profile.additional_sections),
  };
}
