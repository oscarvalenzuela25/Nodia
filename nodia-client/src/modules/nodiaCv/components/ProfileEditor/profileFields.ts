import type { FieldArray, FieldArrayPath } from "react-hook-form";
import type { ProfileForm } from "../../infrastructure/profileSchema";

export type ProfileCollection = FieldArrayPath<ProfileForm>;
type FieldKind = "text" | "area" | "lines" | "month" | "year" | "email" | "tel" | "url" | "status";
export type ProfileField = { name: string; kind?: FieldKind; required?: boolean };

export const personalFields: ProfileField[] = [
  { name: "profile_name", required: true }, { name: "full_name", required: true },
  { name: "professional_title" }, { name: "second_title" },
  { name: "summary", kind: "area" }, { name: "main_stack", kind: "lines" },
];

export const contactFields: ProfileField[] = [
  { name: "location" }, { name: "email", kind: "email" }, { name: "phone", kind: "tel" },
  { name: "linkedin_url", kind: "url" }, { name: "github_url", kind: "url" }, { name: "portfolio_url", kind: "url" },
];

function collection<Name extends ProfileCollection>(name: Name, initial: FieldArray<ProfileForm, Name>,
  fields: (Omit<ProfileField, "name"> & { name: keyof FieldArray<ProfileForm, Name> & string })[]) {
  return { name, initial, fields };
}

export const collections = [
  collection("experiences", { company: "", position: "", highlights: [], technologies: [] }, [
    { name: "company", required: true }, { name: "position", required: true }, { name: "location" },
    { name: "status", kind: "status" }, { name: "start_month", kind: "month" }, { name: "end_month", kind: "month" },
    { name: "highlights", kind: "lines" }, { name: "technologies", kind: "lines" },
  ]),
  collection("projects", { name: "", contributions: [], technologies: [] }, [
    { name: "name", required: true }, { name: "role" }, { name: "status" },
    { name: "start_month", kind: "month" }, { name: "end_month", kind: "month" }, { name: "url", kind: "url" },
    { name: "validation_context", kind: "area" }, { name: "contributions", kind: "lines" }, { name: "technologies", kind: "lines" },
  ]),
  collection("skill_areas", { name: "", skills: [] }, [
    { name: "name", required: true }, { name: "skills", kind: "lines" },
  ]),
  collection("education", { title: "", institution: "" }, [
    { name: "title", required: true }, { name: "institution", required: true },
    { name: "start_year", kind: "year" }, { name: "end_year", kind: "year" }, { name: "details", kind: "area" },
  ]),
  collection("certifications", { name: "" }, [
    { name: "name", required: true }, { name: "issuer" }, { name: "year", kind: "year" },
    { name: "credential_id" }, { name: "verification_url", kind: "url" },
  ]),
  collection("languages", { language: "" }, [
    { name: "language", required: true }, { name: "level" }, { name: "usage", kind: "area" },
  ]),
  collection("additional_sections", { title: "", lines: [] }, [
    { name: "title", required: true }, { name: "lines", kind: "lines" },
  ]),
] as const;
