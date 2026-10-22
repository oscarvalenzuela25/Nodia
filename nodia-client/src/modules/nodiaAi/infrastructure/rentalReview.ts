import { isCivilDate, isLocalTime, isTimezone } from "../../../utils/civilDates";
import { nodiaAiRentalTool } from "./rentalPresentation";
import type { NodiaAiEditableField, NodiaAiPublicProposal } from "./types";

/** Native DTO temporal semantics apply only to registered rental commands and text metadata. */
export function rentalTemporalKind(proposal: NodiaAiPublicProposal, field: NodiaAiEditableField): "date" | "time" | "instant" | null {
  const step = proposal.steps.find(step => step.step_id === field.step_id);
  if (!step || !nodiaAiRentalTool(step.tool_name) || field.kind !== "text") return null;
  if (["check_in_on", "check_out_on", "occurred_on", "incurred_on", "paid_on"].includes(field.field_key)) return "date";
  if (["check_in_time", "check_out_time"].includes(field.field_key)) return "time";
  if (["deposit_due_at", "balance_due_at", "cancelled_at", "starts_at", "ends_at", "planned_ready_at", "ready_at"].includes(field.field_key)) return "instant";
  return null;
}

export function rentalReviewTimezone(proposal: NodiaAiPublicProposal, field: NodiaAiEditableField): string | null {
  const change = proposal.steps.find(step => step.step_id === field.step_id)?.changes.find(change => change.field_key === "timezone");
  return change?.after_present && change.origin === "database" && isTimezone(change.after) ? change.after : null;
}

export function validRentalTemporalDraft(kind: "date" | "time" | "instant", value: string): boolean {
  if (kind === "date") return isCivilDate(value);
  if (kind === "time") return isLocalTime(value);
  return /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
    && isCivilDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}
