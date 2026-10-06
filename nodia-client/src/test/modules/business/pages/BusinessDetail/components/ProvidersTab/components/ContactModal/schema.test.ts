import { describe, expect, it } from "vitest";
import {
  contactFormSchema,
  contactPayload,
  defaultContactForm,
  normalizedPhone,
} from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ContactModal/schema";
import { contactSchema } from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderContacts/types";
describe("Contact form contract", () => {
  it("normalizes national, international and formatted phones consistently", () => {
    expect(normalizedPhone("CL", "9 8765 4321")).toBe("+56987654321");
    expect(normalizedPhone("CL", "+56 9 8765 4321")).toBe("+56987654321");
    expect(normalizedPhone("CL", "2 2345 6789")).toBe("+56223456789");
    expect(normalizedPhone("AR", "+56987654321")).toBeUndefined();
    expect(normalizedPhone("CL", "123")).toBeUndefined();
  });
  it("preserves optional absence and active false", () => {
    const form = { ...defaultContactForm(), name: "María", is_active: false };
    expect(contactPayload(form)).toMatchObject({
      email: null,
      phone: [],
      schedule: {},
      is_active: false,
    });
  });
  it("saves only configured days and retains the visit description", () => {
    const form = { ...defaultContactForm(), name: "María" };
    form.schedule.friday = {
      from: "10:00",
      to: "12:00",
      description: " Despacho ",
    };
    expect(contactPayload(form).schedule).toEqual({
      friday: [{ from: "10:00", to: "12:00", description: "Despacho" }],
    });
  });
  it.each([
    { from: "09:00", to: "", description: "" },
    { from: "23:00", to: "02:00", description: "" },
    { from: "", to: "", description: "Sin horas" },
    { from: "10:00", to: "10:00", description: "" },
  ])("rejects partial and reversed ranges %#", (range) => {
    const form = { ...defaultContactForm(), name: "María" };
    form.schedule.monday = range;
    expect(contactFormSchema.safeParse(form).success).toBe(false);
  });
  it("rejects an incompatible HTTP response instead of treating it as no contacts", () => {
    expect(
      contactSchema.safeParse({ id: 1, phone: { primary: "123" } }).success,
    ).toBe(false);
  });
});
