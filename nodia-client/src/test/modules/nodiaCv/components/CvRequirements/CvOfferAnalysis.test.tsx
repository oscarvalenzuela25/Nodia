import { useRef } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CvDraftDocument from "../../../../../modules/nodiaCv/components/CvGeneration/CvDraftDocument";
import { cvPreviewCoverage, cvPreviewPresentation } from "../../../../../modules/nodiaCv/components/CvGeneration/previewPresentation";
import { useCvEvidenceHighlight } from "../../../../../modules/nodiaCv/components/CvGeneration/useCvEvidenceHighlight";
import CvOfferAnalysis from "../../../../../modules/nodiaCv/components/CvRequirements/CvOfferAnalysis";
import type { CvDraftFact, CvGenerationInput, CvRequirement } from "../../../../../modules/nodiaCv/infrastructure/generationSchema";
import { emptyProfile, profileRecordSchema } from "../../../../../modules/nodiaCv/infrastructure/profileSchema";
import type { CvGenerationView } from "../../../../../modules/nodiaCv/infrastructure/useCvGenerationWorkflow";
import i18n from "../../../../../translate";

const facts: CvDraftFact[] = [
  { id: "e1", groupId: "g1", section: "project", field: "technologies", text: "PostgreSQL" },
  { id: "e2", groupId: "g2", section: "skills", field: "skills", text: "PostgreSQL" },
  { id: "e3", groupId: "g3", section: "experience", field: "start_month", text: "2021-04" },
  { id: "e4", groupId: "g3", section: "experience", field: "end_month", text: "2024-09" },
  { id: "e5", groupId: "g4", section: "profile", field: "main_stack", text: "Docker" },
  { id: "e6", groupId: "g4", section: "profile", field: "professional_title", text: "Fixture title" },
];
const requirements: CvRequirement[] = [
  { id: "r3", quote: "Containers", kind: "preferred", coverage: "gap", evidenceIds: [] },
  { id: "r1", quote: "Database deployments", kind: "required", coverage: "supported", evidenceIds: ["e1"] },
  { id: "r2", quote: "Three years of commercial work", kind: "required", coverage: "confirm", evidenceIds: ["e4"] },
  { id: "r4", quote: "Broad ownership", kind: "uncertain", coverage: "omitted", evidenceIds: ["e6"] },
];
const profile = profileRecordSchema.parse({
  ...emptyProfile, id: "5631301f-18da-4b68-a4ef-702a84e5ec62", schema_version: 1, revision: 1,
  profile_name: "Synthetic profile", full_name: "Synthetic candidate", professional_title: "Fixture title",
  created_at: "2026-11-24T12:00:00.000Z", updated_at: "2026-11-24T12:00:00.000Z",
});
const intent: CvGenerationInput = {
  request_key: "eafc86c5-7f13-4936-9421-55a1c9c06e80", profile_id: profile.id, profile_revision: profile.revision,
  language: "en", vacancy_title: "Fixture vacancy", vacancy_company: "", offer_text: "Synthetic posting",
  selection: { connection_id: "13", mode: "agentic", model_id: "synthetic", effort_id: "high" },
};
const view: CvGenerationView = { intent, profile, receipt: {
  id: "65f80709-2f27-4ee7-af45-a79843d92d3e", state: "ready",
  profile_id: profile.id, profile_revision: 1, language: "en", selection: intent.selection,
  vacancy_title: intent.vacancy_title, vacancy_company: null, error_code: null,
  created_at: "2026-11-24T12:00:00.000Z", expires_at: "2026-11-25T12:00:00.000Z",
  draft: { locale: "en", schemaVersion: 1, selectedFacts: facts, remainingFacts: [], requirements },
  review: { revision: 1, included_fact_ids: facts.map(({ id }) => id), evidence: [] },
} };
const t = (key: string) => i18n.t(`nodiaCv:${key}`);
const presentation = cvPreviewPresentation(view, i18n.getFixedT("en", "nodiaCv"))!;
const highlight = "[data-cv-evidence-highlighted]";

function Workspace({ draftId = view.receipt.id, onReview }: {
  draftId?: string;
  onReview: (requirement: CvRequirement) => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const selection = useCvEvidenceHighlight(draftId, previewRef, requirements);
  return (
    <>
      <CvOfferAnalysis analysis={{ requirements, facts, evidence: [] }}
        interaction={{
          previewId: "fixture-preview", ...selection.target,
          coverage: (requirement) => cvPreviewCoverage(requirement, presentation),
        }}
        onReview={onReview} onChangeTab={selection.clear}
        technologies={<button type="button">Fixture technologies</button>} />
      <div id="fixture-preview" ref={previewRef} data-cv-preview-draft={draftId}
        data-cv-scroll-requirement={selection.scrollRequirementId}>
        <CvDraftDocument view={view} presentation={presentation} activeRequirement={selection.activeRequirement} />
      </div>
    </>
  );
}

describe("offer requirements and their evidence", () => {
  it("groups requirements and highlights the linked line by ID on hover and keyboard focus", async () => {
    const user = userEvent.setup();
    const review = vi.fn();
    render(<Workspace onReview={review} />);
    expect(screen.getAllByRole("heading").slice(1, 4).map(({ textContent }) => textContent)).toEqual(
      ["required", "preferred", "uncertain"].map((kind) => t(`requirement_group.${kind}`)),
    );
    const row = screen.getByRole("button", { name: /^Database deployments/ });
    const document = screen.getByRole("article");
    const duplicates = within(document).getAllByText("PostgreSQL");

    await user.hover(row);
    expect(Array.from(document.querySelectorAll(highlight))).toEqual([duplicates[0]]);
    await user.unhover(row);
    expect(document.querySelector(highlight)).toBeNull();

    await user.tab();
    await user.tab();
    expect(row).toHaveFocus();
    expect(duplicates[0]).toHaveAttribute("data-cv-evidence-highlighted");
    await user.keyboard("{Enter}");
    expect(row).toHaveAttribute("aria-pressed", "true");
    await user.tab();
    expect(duplicates[0]).toHaveAttribute("data-cv-evidence-highlighted");
    await user.keyboard("{Enter}");
    expect(review).toHaveBeenCalledExactlyOnceWith(requirements[1]);

    await user.click(screen.getByRole("tab", { name: t("analysis_technologies") }));
    expect(screen.getByRole("button", { name: "Fixture technologies" })).toBeVisible();
    expect(row).not.toBeVisible();
    expect(document.querySelector(highlight)).toBeNull();
  });

  it("pins on touch, scrolls to the linked line and drops the selection when the draft changes", async () => {
    const user = userEvent.setup();
    const review = vi.fn();
    const workspace = render(<Workspace onReview={review} />);
    const row = screen.getByRole("button", { name: /^Database deployments/ });
    const [linked] = within(screen.getByRole("article")).getAllByText("PostgreSQL");
    linked.scrollIntoView = vi.fn();

    await user.pointer([{ keys: "[TouchA>]", target: row }, { keys: "[/TouchA]", target: row }]);
    expect(row).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(linked.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "nearest" }));

    workspace.rerender(<Workspace draftId="other-fixture-draft" onReview={review} />);
    expect(row).toHaveAttribute("aria-pressed", "false");
    expect(linked).not.toHaveAttribute("data-cv-evidence-highlighted");
  });

  it("keeps inferred evidence unconfirmed, maps combined dates and includes only applied technologies", () => {
    const updated: CvGenerationView = { ...view, receipt: {
      ...view.receipt,
      technology_options: [
        { name: "Docker", kind: "preferred", in_profile: false, requirement_ids: ["r3"] },
        { name: "Kubernetes", kind: "preferred", in_profile: false, requirement_ids: [] },
      ],
      review: {
        revision: 2, included_fact_ids: facts.map(({ id }) => id).filter((id) => id !== "e1"), evidence: [],
        technologies: {
          included: ["Docker"],
          additions: [
            { name: "Docker", status: "confirmed", source: "Synthetic lab", detail: "Applied Docker" },
            { name: "Kubernetes", status: "study" },
          ],
        },
      },
    } };
    const presented = cvPreviewPresentation(updated, i18n.getFixedT("en", "nodiaCv"))!;
    expect(cvPreviewCoverage(requirements[1], presented)).toBe("omitted");
    expect(cvPreviewCoverage(requirements[2], presented)).toBe("confirm");
    expect(cvPreviewCoverage(requirements[0], presented)).toBe("supported");
    expect(cvPreviewCoverage(requirements[3], presented)).toBe("supported");

    const document = render(<CvDraftDocument view={updated} presentation={presented} activeRequirement={requirements[2]} />);
    expect(screen.getByText("04/2021 - 09/2024")).toHaveAttribute("data-cv-evidence-highlighted");
    document.rerender(<CvDraftDocument view={updated} presentation={presented} activeRequirement={requirements[0]} />);
    expect(screen.getAllByText("Docker")).toHaveLength(1);
    expect(screen.getByText("Docker").closest("li")).toHaveAttribute("data-cv-evidence-highlighted");
    expect(screen.getByText("Applied Docker").parentElement).toHaveAttribute("data-cv-evidence-highlighted");
    expect(screen.queryByText("Kubernetes")).not.toBeInTheDocument();
  });
});
