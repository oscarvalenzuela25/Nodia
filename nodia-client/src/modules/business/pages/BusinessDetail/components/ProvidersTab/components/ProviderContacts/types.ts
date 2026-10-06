import { z } from "zod";
export const CONTACT_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type ContactDay = (typeof CONTACT_DAYS)[number];
const rangeSchema = z
  .object({
    from: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    to: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    description: z.string().max(255).optional(),
  })
  .strict()
  .refine((range) => range.from < range.to);
export const contactScheduleSchema = z.partialRecord(
  z.enum(CONTACT_DAYS),
  z.array(rangeSchema).max(1),
);
export const contactValuesSchema = z.object({
  name: z.string().trim().min(1).max(255),
  phone: z
    .array(z.object({ number: z.string().regex(/^\+[1-9]\d{6,14}$/) }).strict())
    .max(10),
  email: z.email().max(254).nullable(),
  schedule: contactScheduleSchema,
  description: z.string().max(2000).nullable(),
  is_active: z.boolean(),
});
export const contactSchema = contactValuesSchema.extend({
  id: z.string().regex(/^[1-9]\d*$/),
  provider_id: z.string().regex(/^[1-9]\d*$/),
  version: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const contactListSchema = z.object({
  data: z.array(contactSchema),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total_items: z.number().int().nonnegative(),
    total_pages: z.number().int().nonnegative(),
  }),
});
export type ProviderContact = z.infer<typeof contactSchema>;
export type ContactValues = z.infer<typeof contactValuesSchema>;
export type ContactSchedule = ContactValues["schedule"];
export type ContactListParams = { page: number; limit: number; search: string };
export type CreateContact = ContactValues & { request_key: string };
export type UpdateContact = ContactValues & { version: number };
