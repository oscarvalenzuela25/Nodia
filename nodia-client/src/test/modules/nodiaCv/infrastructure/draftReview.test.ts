import { describe, expect, it } from "vitest";
import { rebaseCvReviewFields } from "../../../../modules/nodiaCv/infrastructure/draftReview";
import {
  clearCvReceipt,
  cvRecoveryKeys,
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

  it("reads a legacy marker and keeps independent opaque keys isolated by owner", () => {
    const oldKey = "ebf95073-9ac2-42c0-8593-b248f3c3dc2a";
    const currentKey = "a578c247-581f-4251-b1bf-50a6a4ebf95a";
    sessionStorage.setItem("nodia-cv-recovery", JSON.stringify({ owner: "123", requestKey: oldKey }));
    expect(cvRecoveryKeys("123")).toEqual([oldKey]);
    rememberCvReceipt("123", currentKey);
    expect(cvRecoveryKeys("123")).toEqual([currentKey, oldKey]);
    expect(cvRecoveryKeys("456")).toEqual([]);
    clearCvReceipt("456", oldKey);
    expect(cvRecoveryKeys("123")).toEqual([currentKey, oldKey]);
    clearCvReceipt("123", currentKey);
    expect(cvRecoveryKeys("123")).toEqual([oldKey]);
    discardOtherCvReceipt("456");
    expect(cvRecoveryKeys("123")).toEqual([]);
  });
});
