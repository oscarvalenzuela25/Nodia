import { describe, expect, it } from "vitest";
import { jobErrorKey, jobExpectedResultKey } from "../../../../../modules/teacher/components/JobPanel/presentation";

describe("bounded Teacher job error messages", () => {
  it("maps exact known public codes and rejects arbitrary or inherited object names", () => {
    expect(jobErrorKey("teacher:invalid_generated_content")).toBe("teacher:invalid_generated_content");
    expect(jobErrorKey("queue_deadline")).toBe("teacher:queue_deadline");
    expect(jobErrorKey("native_dispatch_excluded", true)).toBe("teacher:job_error_native_excluded");
    expect(jobErrorKey("native_dispatch_excluded", false)).toBe("teacher:job_error_unrecognized");
    expect(jobErrorKey(null)).toBeNull();
    for (const code of ["__proto__", "toString", "internal details", "vendor:invalid_generated_content"]) expect(jobErrorKey(code)).toBe("teacher:job_error_unrecognized");
  });
});

describe("Teacher job expected result", () => {
  it("uses only recognized purposes for specific guidance and keeps historical purposes generic", () => {
    expect(jobExpectedResultKey("setup_reply")).toBe("teacher:job_reply_expected");
    expect(jobExpectedResultKey("plan_adjustment")).toBe("teacher:job_plan_expected");
    expect(jobExpectedResultKey("learning_packet")).toBe("teacher:job_material_expected");
    expect(jobExpectedResultKey("assessment_only")).toBe("teacher:job_assessment_expected");
    expect(jobExpectedResultKey("legacy-purpose")).toBe("teacher:job_result_expected");
    expect(jobExpectedResultKey("toString")).toBe("teacher:job_result_expected");
  });
});
