import { File as NodeFile } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import {
  applicationLetterDrafts, isApplicationDocumentText, isRecommendationPdf, recommendationPdfLimit,
} from "../../../../modules/nodiaCv/infrastructure/applicationDocuments";

const source: Parameters<typeof applicationLetterDrafts>[0] = {
  profile: { full_name: "Test applicant" },
  receipt: {
    language: "en",
    vacancy_title: "Platform Engineer",
    vacancy_company: "Example",
    draft: {
      schemaVersion: 1,
      locale: "en",
      requirements: [{ id: "r1", kind: "required", coverage: "gap", quote: "Requires AWS", evidenceIds: [] }],
      selectedFacts: [
        { id: "e1", groupId: "g1", section: "experience", field: "highlights", text: "Maintained a C++ toolchain." },
        { id: "e2", groupId: "g1", section: "skills", field: "skills", text: "Excluded service" },
      ],
      remainingFacts: [
        { id: "e3", groupId: "g1", section: "project", field: "contributions", text: "Wrote integration tests." },
        { id: "e4", groupId: "g1", section: "profile", field: "summary", text: "Omitted summary" },
      ],
    },
    review: {
      revision: 2,
      included_fact_ids: ["e1", "e3"],
      evidence: [{ requirement_id: "r1", source: "A project", detail: "Ran local build tests." }],
    },
  },
};

describe("Nodia CV application documents", () => {
  it("builds editable copies from current review and leaves the referee's assessment unsigned", () => {
    const { cover, recommendation } = applicationLetterDrafts(source);
    expect(cover).toContain("Platform Engineer role at Example");
    for (const letter of [cover, recommendation]) {
      expect(letter).toContain("Test applicant");
      expect(letter).toContain("Maintained a C++ toolchain.");
      expect(letter).toContain("Wrote integration tests.");
      expect(letter).toContain("Ran local build tests.");
      expect(letter).not.toMatch(/AWS|Excluded service|Omitted summary/);
    }
    expect(recommendation).toContain("[Add your own assessment");
    expect(recommendation).not.toContain("I recommend");
  });

  it("uses the CV language and omits unknown company and role identifiers", () => {
    const { cover, recommendation } = applicationLetterDrafts({
      ...source,
      receipt: { ...source.receipt, language: "es", vacancy_title: null, vacancy_company: null },
    });
    expect(cover).toContain("Me interesa presentar mi candidatura a esta oferta.");
    expect(recommendation).toContain("Borrador de recomendación para Test applicant.");
    expect(cover).not.toMatch(/Platform Engineer|Example|undefined|null/);
  });

  it("uses the current technology review when a legacy included list contains excluded skills", () => {
    const { cover, recommendation } = applicationLetterDrafts({
      ...source,
      receipt: {
        ...source.receipt,
        review: {
          revision: 3,
          included_fact_ids: ["e2"],
          evidence: [],
          technologies: {
            included: ["TypeScript"],
            additions: [
              { name: "TypeScript", status: "confirmed", source: "Repository", detail: "Maintained TypeScript packages" },
              { name: "Docker", status: "confirmed", source: "Project", detail: "Built Docker images" },
              { name: "AWS", status: "study" },
            ],
          },
        },
      },
    });
    for (const letter of [cover, recommendation]) {
      expect(letter).toContain("Maintained TypeScript packages");
      expect(letter).not.toMatch(/Excluded service|Docker|AWS/);
    }
  });

  it("bounds letter text and rejects controls and empty drafts", () => {
    expect(isApplicationDocumentText("  Experiencia\r\nConfirmada  ")).toBe(true);
    expect(isApplicationDocumentText("á".repeat(3000))).toBe(true);
    for (const text of [" ", "Á\u0000", "Á\u202e", "á".repeat(3001), "A\n".repeat(29)]) {
      expect(isApplicationDocumentText(text)).toBe(false);
    }
  });

  it("checks recommendation PDF size and byte markers even when MIME is missing", async () => {
    // jsdom's Blob currently lacks the browser File.text() implementation.
    vi.stubGlobal("File", NodeFile);
    const pdf = "%PDF-1.7\nfixture\n%%EOF\n";
    try {
      await expect(isRecommendationPdf(new File([pdf], "received.PDF"))).resolves.toBe(true);
      await expect(isRecommendationPdf(new File([pdf], "received.pdf", { type: "text/html" }))).resolves.toBe(false);
      await expect(isRecommendationPdf(new File([pdf], "received.txt"))).resolves.toBe(false);
      await expect(isRecommendationPdf(new File(["fake\n%%EOF"], "received.pdf"))).resolves.toBe(false);
      await expect(isRecommendationPdf(new File(["%PDF-1.7 partial file"], "received.pdf"))).resolves.toBe(false);
      const oversized = new File([new Uint8Array(recommendationPdfLimit + 1)], "received.pdf");
      await expect(isRecommendationPdf(oversized)).resolves.toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
