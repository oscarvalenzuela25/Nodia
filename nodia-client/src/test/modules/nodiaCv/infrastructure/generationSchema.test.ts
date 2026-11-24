import { describe, expect, it } from "vitest";
import {
  cvGenerationSchema,
  cvInputIdentity,
  cvOfferMaxBytes,
  cvOfferSchema,
  cvPollInterval,
  receivedCvIntent,
  type CvGenerationInput,
} from "../../../../modules/nodiaCv/infrastructure/generationSchema";

const input: CvGenerationInput = {
  request_key: "ebf95073-9ac2-42c0-8593-b248f3c3dc2a",
  profile_id: "d0965fae-f55e-4d48-8fe6-49d0ae10f605",
  profile_revision: 1,
  language: "es",
  vacancy_title: "Desarrollo",
  vacancy_company: "",
  offer_text: "TypeScript y Kubernetes.",
  selection: { connection_id: "9", mode: "api_key", model_id: "synthetic", effort_id: "medium" },
};
const receipt = {
  id: "785f8c57-e2c8-4d57-ba88-4eb2fae752c2",
  state: "ready",
  profile_id: input.profile_id,
  profile_revision: input.profile_revision,
  language: input.language,
  vacancy_title: input.vacancy_title,
  vacancy_company: null,
  selection: input.selection,
  created_at: "2026-11-24T12:00:00.000Z",
  expires_at: "2026-11-25T12:00:00.000Z",
  error_code: null,
  draft: {
    schemaVersion: 1,
    locale: "es",
    selectedFacts: [{ id: "e1", groupId: "g1", section: "profile", field: "main_stack", text: "TypeScript" }],
    remainingFacts: [],
    requirements: [
      { id: "r1", quote: "TypeScript", kind: "required", coverage: "supported", evidenceIds: ["e1"] },
    ],
  },
  review: { revision: 1, included_fact_ids: ["e1"], evidence: [] },
};

describe("Nodia CV generation contract", () => {
  it("distinguishes edits of the offer, revision, and exact selection without comparing request keys", () => {
    const current = cvInputIdentity(input);
    const duplicate = { ...input, request_key: "different" };
    expect(cvInputIdentity(duplicate)).toBe(current);
    expect(cvInputIdentity({ ...input, offer_text: "Only TypeScript" })).not.toBe(current);
    expect(cvInputIdentity({ ...input, profile_revision: 2 })).not.toBe(current);
    expect(cvInputIdentity({ ...input, selection: { ...input.selection, effort_id: null } })).not.toBe(
      current,
    );
  });

  it("matches response identity to the actual submission and keeps manual evidence separate", () => {
    const reviewed = cvGenerationSchema.parse({
      ...receipt,
      review: {
        revision: 2,
        included_fact_ids: ["e1"],
        evidence: [
          { requirement_id: "r1", source: "Synthetic project", detail: "Added tests in TypeScript." },
        ],
      },
    });
    expect(receivedCvIntent(reviewed, input)).toBe(true);
    expect(receivedCvIntent(reviewed, { ...input, profile_revision: 2 })).toBe(false);
    expect(
      receivedCvIntent(reviewed, { ...input, selection: { ...input.selection, connection_id: "10" } }),
    ).toBe(false);
    expect(reviewed.draft?.selectedFacts[0].text).toBe("TypeScript");
    expect(reviewed.review?.evidence[0].source).toBe("Synthetic project");
  });

  it("rejects malformed or unrelated model and review output before displaying it", () => {
    expect(cvGenerationSchema.safeParse({ ...receipt, state: "unknown" }).success).toBe(false);
    expect(
      cvGenerationSchema.safeParse({ ...receipt, review: { ...receipt.review, included_fact_ids: ["e999"] } })
        .success,
    ).toBe(false);
    expect(
      cvGenerationSchema.safeParse({
        ...receipt,
        review: {
          ...receipt.review,
          evidence: [{ requirement_id: "r2", source: "Other", detail: "Another receipt." }],
        },
      }).success,
    ).toBe(false);
  });

  it("respects the offer byte limit for UTF-8 and trims only on submission", () => {
    const offer = "ñ".repeat(cvOfferMaxBytes / 2);
    expect(cvOfferSchema.parse({ ...input, offer_text: " " + offer + " " }).offer_text).toBe(offer);
    expect(cvOfferSchema.safeParse({ ...input, offer_text: offer + "x" }).success).toBe(false);
  });

  it("backs off while in progress and stops on an uncertain outcome or read failure", () => {
    expect(cvPollInterval("queued", 0, false)).toBe(1000);
    expect(cvPollInterval("running", 30, false)).toBe(8000);
    expect(cvPollInterval("running", 5, true)).toBe(false);
    expect(cvPollInterval("unknown", 5, false)).toBe(false);
    expect(cvPollInterval("ready", 5, false)).toBe(false);
  });
});
