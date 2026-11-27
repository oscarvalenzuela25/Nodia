import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CvDraftDocument from "../../../../../modules/nodiaCv/components/CvGeneration/CvDraftDocument";
import { cvPreviewPresentation } from "../../../../../modules/nodiaCv/components/CvGeneration/previewPresentation";
import i18n from "../../../../../translate";
import { emptyProfile, profileRecordSchema } from "../../../../../modules/nodiaCv/infrastructure/profileSchema";
import type { CvGenerationView } from "../../../../../modules/nodiaCv/infrastructure/useCvGenerationWorkflow";

const date = "2026-11-26T12:00:00.000Z";
const profile = profileRecordSchema.parse({
  ...emptyProfile,
  id: "d7ae1840-e244-4f85-9cfd-b1f1275466b1",
  profile_name: "Test profile",
  full_name: "Test applicant",
  contact: { email: "qa@example.invalid" },
  revision: 1,
  schema_version: 1,
  created_at: date,
  updated_at: date,
});
const input = {
  request_key: "890dbed2-9253-44e9-9352-3ddbcff4f57e",
  profile_id: profile.id,
  profile_revision: profile.revision,
  language: "en",
  vacancy_title: "",
  vacancy_company: "",
  offer_text: "Synthetic offer",
  selection: { connection_id: "13", mode: "agentic", model_id: "synthetic", effort_id: null },
} satisfies CvGenerationView["intent"];
const review = { revision: 1, included_fact_ids: ["e1", "e2", "e3", "e4"], evidence: [] };
const view: CvGenerationView = {
  profile,
  intent: input,
  receipt: {
    id: "f22c86b6-3d2a-44e9-b8c5-bee4a7cfdf62",
    profile_id: input.profile_id,
    profile_revision: input.profile_revision,
    language: input.language,
    vacancy_title: null,
    vacancy_company: null,
    selection: input.selection,
    created_at: date,
    expires_at: date,
    error_code: null,
    state: "ready",
    draft: {
      schemaVersion: 1,
      locale: "en",
      requirements: [],
      selectedFacts: [
        { id: "e1", section: "profile", groupId: "g1", field: "summary", text: "Reviewed summary" },
        { id: "e2", section: "profile", groupId: "g1", field: "main_stack", text: "TypeScript" },
        { id: "e3", section: "experience", groupId: "g2", field: "company", text: "Test company" },
        { id: "e4", section: "education", groupId: "g3", field: "name", text: "Test school" },
      ],
      remainingFacts: [
        { id: "e5", section: "certification", groupId: "g4", field: "name", text: "Excluded certificate" },
      ],
    },
    review,
  },
};

function documentFor(view: CvGenerationView) {
  const presentation = cvPreviewPresentation(view, i18n.getFixedT(view.receipt.language, "nodiaCv"));
  if (!presentation) throw new Error("Expected fixture draft");
  return <CvDraftDocument view={view} presentation={presentation} activeRequirement={null} />;
}

const headings = () => screen.getAllByRole("heading", { level: 4 }).map(({ textContent }) => textContent);

describe("CV draft document", () => {
  it("shows the proposed order in the DOM and appends other visible sections in canonical order", () => {
    const { rerender } = render(documentFor(view));
    expect(headings()).toEqual(["Professional experience", "Skills", "Education"]);
    const experience = screen.getByRole("heading", { name: "Professional experience" });

    rerender(documentFor({
      ...view,
      receipt: {
        ...view.receipt,
        review: { ...review, revision: 2, section_order: ["certification", "skills", "profile"] },
      },
    }));

    expect(headings()).toEqual(["Skills", "Profile", "Professional experience", "Education"]);
    expect(screen.getByRole("heading", { name: "Professional experience" })).toBe(experience);
    expect(screen.getByText("TypeScript").closest("section")).toHaveTextContent("Skills");
    expect(screen.getByText("Reviewed summary").closest("section")).toHaveTextContent("Profile");
    expect(screen.getByText("qa@example.invalid").closest("header")).toHaveTextContent("Test applicant");
    expect(screen.queryByText("Excluded certificate")).not.toBeInTheDocument();
  });
});
