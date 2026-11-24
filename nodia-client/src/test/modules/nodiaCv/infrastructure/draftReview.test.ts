import { describe, expect, it } from "vitest";
import { rebaseCvReviewFields } from "../../../../modules/nodiaCv/infrastructure/draftReview";
import {
  clearCvReceipt,
  cvRecoveryKey,
  discardOtherCvReceipt,
  rememberCvReceipt,
} from "../../../../modules/nodiaCv/infrastructure/receiptStorage";

describe("Nodia CV draft review and receipt recovery", () => {
  it("preserves concurrent evidence and per-fact edits when a conflict is reconciled", () => {
    const baseline = { source: "Original project", detail: "Original fact", included: ["e1"] };
    const edited = { ...baseline, included: ["e2"] };
    const latest = { source: "Concurrent project", detail: "Current fact", included: ["e1", "e3"] };
    expect(rebaseCvReviewFields(baseline, edited, latest)).toEqual({
      source: "Concurrent project",
      detail: "Current fact",
      included: ["e3", "e2"],
    });
    expect(rebaseCvReviewFields(baseline, { ...edited, source: "My correction" }, latest)).toMatchObject({
      source: "My correction",
      detail: "Current fact",
    });
    expect(rebaseCvReviewFields(baseline, { ...edited, detail: "My correction" }, latest)).toMatchObject({
      source: "Concurrent project",
      detail: "My correction",
    });
  });

  it("stores just one opaque receipt per tab and never restores another actor's reference", () => {
    const key = "ebf95073-9ac2-42c0-8593-b248f3c3dc2a";
    rememberCvReceipt("123", key);
    expect(JSON.parse(sessionStorage.getItem("nodia-cv-recovery") ?? "{}")).toEqual({
      owner: "123",
      requestKey: key,
    });
    expect(cvRecoveryKey("123")).toBe(key);
    expect(cvRecoveryKey("456")).toBeNull();
    discardOtherCvReceipt("456");
    expect(cvRecoveryKey("123")).toBeNull();
    clearCvReceipt(key);
  });
});
