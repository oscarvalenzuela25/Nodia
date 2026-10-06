import { z } from "zod";
import {
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";
import {
  CONTACT_DAYS,
  type ContactDay,
  type ContactValues,
  type ProviderContact,
} from "../ProviderContacts/types";
export function normalizedPhone(
  country: string,
  number: string,
): string | undefined {
  if (!isSupportedCountry(country)) return undefined;
  const parsed = parsePhoneNumberFromString(number, {
    defaultCountry: country as CountryCode,
    extract: false,
  });
  if (
    !parsed?.isValid() ||
    parsed.ext ||
    parsed.countryCallingCode !== getCountryCallingCode(country as CountryCode)
  )
    return undefined;
  return parsed.number;
}
const daySchema = z.object({
  from: z.string(),
  to: z.string(),
  description: z.string().max(255, "provider_contacts:too_long"),
});
export const contactFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "provider_contacts:required")
      .max(255, "provider_contacts:too_long"),
    phone: z
      .array(
        z.object({
          country: z.string(),
          number: z.string().max(40, "provider_contacts:invalid_phone"),
        }),
      )
      .max(10, "provider_contacts:phone_limit"),
    email: z
      .string()
      .trim()
      .max(254, "provider_contacts:too_long")
      .refine(
        (value) => !value || z.email().safeParse(value).success,
        "provider_contacts:invalid_email",
      ),
    schedule: z.record(z.enum(CONTACT_DAYS), daySchema),
    description: z.string().max(2000, "provider_contacts:too_long"),
    is_active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const seen = new Set<string>();
    values.phone.forEach((p, index) => {
      if (!p.number.trim()) return;
      const number = normalizedPhone(p.country, p.number);
      if (!number)
        ctx.addIssue({
          code: "custom",
          path: ["phone", index, "number"],
          message: "provider_contacts:invalid_phone",
        });
      else if (seen.has(number))
        ctx.addIssue({
          code: "custom",
          path: ["phone", index, "number"],
          message: "provider_contacts:duplicate_phone",
        });
      else seen.add(number);
    });
    for (const day of CONTACT_DAYS) {
      const range = values.schedule[day];
      if (!range.from && !range.to && !range.description.trim()) continue;
      const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
      if (!time.test(range.from))
        ctx.addIssue({
          code: "custom",
          path: ["schedule", day, "from"],
          message: "provider_contacts:invalid_time",
        });
      if (
        !time.test(range.to) ||
        (time.test(range.from) && range.from >= range.to)
      )
        ctx.addIssue({
          code: "custom",
          path: ["schedule", day, "to"],
          message: "provider_contacts:invalid_range",
        });
    }
  });
export type ContactForm = z.infer<typeof contactFormSchema>;
export function defaultContactForm(contact?: ProviderContact): ContactForm {
  return {
    name: contact?.name ?? "",
    email: contact?.email ?? "",
    description: contact?.description ?? "",
    is_active: contact?.is_active ?? true,
    phone: contact?.phone.length
      ? contact.phone.map((phone) => {
          const parsed = parsePhoneNumberFromString(phone.number);
          return {
            country: parsed?.country ?? "CL",
            number: parsed?.nationalNumber ?? phone.number,
          };
        })
      : [{ country: "CL", number: "" }],
    schedule: Object.fromEntries(
      CONTACT_DAYS.map((day) => [
        day,
        {
          from: contact?.schedule[day]?.[0]?.from ?? "",
          to: contact?.schedule[day]?.[0]?.to ?? "",
          description: contact?.schedule[day]?.[0]?.description ?? "",
        },
      ]),
    ) as Record<ContactDay, { from: string; to: string; description: string }>,
  };
}
export function contactPayload(form: ContactForm): ContactValues {
  const parsed = contactFormSchema.parse(form);
  return {
    name: parsed.name,
    email: parsed.email || null,
    description: parsed.description.trim() || null,
    is_active: parsed.is_active,
    phone: parsed.phone
      .filter((p) => p.number.trim())
      .map((p) => ({ number: normalizedPhone(p.country, p.number)! })),
    schedule: Object.fromEntries(
      CONTACT_DAYS.filter((day) => parsed.schedule[day].from).map((day) => {
        const range = parsed.schedule[day];
        return [
          day,
          [
            {
              from: range.from,
              to: range.to,
              ...(range.description.trim()
                ? { description: range.description.trim() }
                : {}),
            },
          ],
        ];
      }),
    ),
  };
}
