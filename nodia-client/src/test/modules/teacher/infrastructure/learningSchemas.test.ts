import { describe, expect, it } from "vitest";
import { parseDeclaredConfidence, learningSchema } from "../../../../modules/teacher/infrastructure/learningSchemas";

describe("declared confidence boundary", () => {
  it("distinguishes omission and an explicit zero without manufacturing a default", () => {
    expect(parseDeclaredConfidence("")).toBeNull();
    expect(parseDeclaredConfidence("  ")).toBeNull();
    expect(parseDeclaredConfidence("0")).toBe(0);
    expect(parseDeclaredConfidence("100")).toBe(100);
  });
  it("rejects fractional, negative, non-finite and out-of-range declarations", () => {
    for (const value of ["50.5", "-1", "101", "Infinity", "NaN", "50%", "1e2"]) expect(parseDeclaredConfidence(value)).toBeUndefined();
  });
  it("does not present invalid or missing evidence as a valid empty result", () => {
    expect(learningSchema.safeParse({}).success).toBe(false);
    expect(learningSchema.safeParse({ schema_version: 1, observations: null }).success).toBe(false);
  });
});
