import type { Outline } from "./schemas";

export const ASSESSMENT_COUNT_SCOPES = ["practice_counts", "final_counts", "diagnostic_counts"] as const;
export const ASSESSMENT_FORMATS = ["single_choice", "completion", "short_text"] as const;
type Scope = typeof ASSESSMENT_COUNT_SCOPES[number];
type Format = typeof ASSESSMENT_FORMATS[number];
export type AssessmentPolicy = Outline["assessment_policy"];
export type AssessmentCountFields = Record<Scope, Record<Format, string>>;
export function assessmentCountFields(policy: AssessmentPolicy): AssessmentCountFields {
  return Object.fromEntries(ASSESSMENT_COUNT_SCOPES.map(scope => [scope, Object.fromEntries(ASSESSMENT_FORMATS.map(format => [format, String(policy[scope][format])]))])) as AssessmentCountFields;
}
export function parseAssessmentCountFields(fields: AssessmentCountFields, policy: AssessmentPolicy, maximumSectionObjectives: number): { valid: true; policy: AssessmentPolicy } | { valid: false } {
  const next = { ...policy };
  for (const scope of ASSESSMENT_COUNT_SCOPES) {
    const counts = { ...policy[scope] };
    for (const format of ASSESSMENT_FORMATS) {
      const raw = fields[scope][format];
      if (!/^\d+$/.test(raw)) return { valid: false };
      const value = Number(raw);
      if (!Number.isSafeInteger(value) || value < 1 || value > (format === "short_text" ? 8 : 24)) return { valid: false };
      counts[format] = value;
    }
    const total = counts.single_choice + counts.completion + counts.short_text;
    if (scope === "final_counts" ? total < 10 || total > 24 || total < maximumSectionObjectives * policy.coverage_per_objective : total < 3 || total > 12) return { valid: false };
    next[scope] = counts;
  }
  return { valid: true, policy: next };
}
