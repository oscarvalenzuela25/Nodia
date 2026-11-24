import type { CvRequirement, CvReviewSave } from "./generationSchema";

export type CvReviewFields = { source: string; detail: string; included: string[] };

export function cvReviewFields(review: CvReviewSave, requirement: CvRequirement): CvReviewFields {
  const existing = review.evidence.find((item) => item.requirement_id === requirement.id);
  return {
    source: existing?.source ?? "",
    detail: existing?.detail ?? "",
    included: review.included_fact_ids.filter((id) => requirement.evidenceIds.includes(id)),
  };
}

/** Keep the user's decisions since opening the form; adopt concurrent changes to untouched fields. */
export function rebaseCvReviewFields(
  baseline: CvReviewFields,
  edited: CvReviewFields,
  latest: CvReviewFields,
): CvReviewFields {
  const before = new Set(baseline.included);
  const after = new Set(edited.included);
  const selected = new Set(latest.included);
  for (const id of before) if (!after.has(id)) selected.delete(id);
  for (const id of after) if (!before.has(id)) selected.add(id);
  return {
    source: edited.source.trim() === baseline.source ? latest.source : edited.source,
    detail: edited.detail.trim() === baseline.detail ? latest.detail : edited.detail,
    included: [...selected],
  };
}
