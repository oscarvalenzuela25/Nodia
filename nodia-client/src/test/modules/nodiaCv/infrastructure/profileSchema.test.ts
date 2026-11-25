import { describe, expect, it } from "vitest";
import { emptyProfile, profileEditorSchema, profileEditorValues, profileRecordSchema } from "../../../../modules/nodiaCv/infrastructure/profileSchema";

const entryId = "030db9b9-a17e-4b2b-9201-32362a19cad4";
const profileId = "c6305319-c41b-4604-906d-e95b0429a01d";
const data = {
  ...emptyProfile, profile_name: "Fictional profile", full_name: "Alex Example", main_stack: ["PostgreSQL"],
  experiences: [{ id: entryId, company: "Example Studio", position: "Engineer", start_month: "2025-02", highlights: [], technologies: [] }],
  projects: [{ id: entryId, name: "Example app", contributions: [], technologies: [] }],
  skill_areas: [{ id: entryId, name: "Development", skills: [] }],
  education: [{ id: entryId, title: "Example program", institution: "Example School" }],
  certifications: [{ id: entryId, name: "Example course" }],
  languages: [{ id: entryId, language: "English" }],
  additional_sections: [{ id: entryId, title: "Volunteering", lines: [] }],
};
const recordData = {
  ...data, id: profileId, revision: 4, schema_version: 1,
  created_at: "2026-11-24T16:00:00.000Z", updated_at: "2026-11-24T16:00:00.000Z",
};

describe("CV profile form and transport", () => {
  it("preserves date precision and availability and normalizes lines without filling optional fields", () => {
    const value = profileEditorSchema.parse({
      ...data, summary: "   ", main_stack: " TypeScript \n \n PostgreSQL ",
      experiences: [{ ...data.experiences[0], status: "current", end_month: "" }],
      education: [{ ...data.education[0], end_year: "2025" }],
    });
    expect(value.experiences[0]).toMatchObject({ start_month: "2025-02", status: "current", id: entryId });
    expect(value.experiences[0].end_month).toBeUndefined();
    expect(value.education[0].end_year).toBe("2025");
    expect(value.summary).toBeUndefined();
    expect(value.main_stack).toEqual(["TypeScript", "PostgreSQL"]);
  });

  it("reports impossible precision, current end dates and reversed dates on the actual field", () => {
    for (const [start_month, end_month, status, field] of [
      ["0000-01", "2025-02", "finished", "start_month"],
      ["2025-01", "2025-02-01", "finished", "end_month"],
      ["2025-01", "2025-02", "current", "end_month"],
      ["2025-02", "2025-01", "finished", "end_month"],
    ] as const) {
      const result = profileEditorSchema.safeParse({
        ...data, experiences: [{ ...data.experiences[0], start_month, end_month, status }],
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0].path).toEqual(["experiences", 0, field]);
    }
  });

  it("gives copies new identity and preserves every nested entry identity while editing", () => {
    const record = profileRecordSchema.parse(recordData);
    const edit = profileEditorSchema.parse(profileEditorValues(record));
    const copy = profileEditorSchema.parse(profileEditorValues(record, "Fictional profile (copy)"));
    expect(copy.profile_name).toBe("Fictional profile (copy)");
    const arrays = ["experiences", "projects", "skill_areas", "education", "certifications", "languages", "additional_sections"] as const;
    for (const key of arrays) {
      expect(edit[key][0].id).toBe(entryId);
      expect(copy[key][0]).not.toHaveProperty("id");
      expect(record[key][0].id).toBe(entryId);
    }
    expect(copy).not.toHaveProperty("id");
    expect(copy).not.toHaveProperty("revision");
  });

  it("rejects malformed detail identity and does not accept links with credentials", () => {
    expect(profileRecordSchema.safeParse({ ...recordData, schema_version: 2 }).success).toBe(false);
    expect(profileRecordSchema.safeParse({ ...recordData, experiences: [{ ...data.experiences[0], id: undefined }] }).success).toBe(false);
    expect(profileEditorSchema.safeParse({
      ...data, contact: { linkedin_url: "https://name:password@example.com" },
    }).success).toBe(false);
  });
});
