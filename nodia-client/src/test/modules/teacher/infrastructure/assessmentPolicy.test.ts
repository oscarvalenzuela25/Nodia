import { describe, expect, it } from "vitest";
import { assessmentCountFields, parseAssessmentCountFields } from "../../../../modules/teacher/infrastructure/assessmentPolicy";
import { planFixture } from "../fixtures";

describe("Teacher assessment counts", () => {
  it("updates explicit counts without changing other policies or the accepted source snapshot", () => {
    const policy = planFixture.outline.assessment_policy;
    const fields = assessmentCountFields(policy);
    fields.practice_counts.single_choice = "4";
    const result = parseAssessmentCountFields(fields, policy, 1);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error("Expected a valid policy");
    expect(result.policy).toEqual({ ...policy, practice_counts: { single_choice: 4, completion: 1, short_text: 1 } });
    expect(policy.practice_counts.single_choice).toBe(3);
    expect(result.policy.final_threshold_percent).toBe(90);
  });
  it("rejects empty/fractional/oversized counts, missing formats and insufficient final coverage without silently correcting them", () => {
    const policy = planFixture.outline.assessment_policy;
    for (const raw of ["", "0", "-1", "1.5", "25"]) {
      const fields = assessmentCountFields(policy);
      fields.practice_counts.single_choice = raw;
      expect(parseAssessmentCountFields(fields, policy, 1).valid).toBe(false);
      expect(fields.practice_counts.single_choice).toBe(raw);
    }
    const tooManyBrief = assessmentCountFields(policy);
    tooManyBrief.final_counts.short_text = "9";
    expect(parseAssessmentCountFields(tooManyBrief, policy, 1).valid).toBe(false);
    expect(parseAssessmentCountFields(assessmentCountFields(policy), policy, 7).valid).toBe(false);
  });
});
