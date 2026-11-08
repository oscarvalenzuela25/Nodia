import { describe, expect, it } from "vitest";
import { jobErrorKey } from "../../../../../modules/teacher/components/JobPanel/presentation";

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
