import { z } from "zod";
import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import type { NodiaAiSelection } from "../../nodiaAi/infrastructure/types";
import {
  cvGenerationSchema,
  receivedCvIntent,
  type CvDraftFact,
  type CvGeneration,
  type CvGenerationInput,
  type CvGenerationIntent,
} from "./generationSchema";

export const cvAiEditMaxBytes = 2048;
export const cvAiEditFormSchema = z.object({
  instructions: z.string().transform(value => value.normalize("NFC").replace(/\r\n?/g, "\n").trim())
    .refine(value => value.length > 0, "nodiaCv:validation.required")
    .refine(value => new TextEncoder().encode(value).byteLength <= cvAiEditMaxBytes, "nodiaCv:ai_edit.too_long")
    .refine(value => !/[\p{Cc}\p{Cs}\p{Bidi_Control}]/u.test(value.replace(/\n/g, "")), "nodiaCv:ai_edit.invalid_instructions"),
});

export type CvAiEditTarget = { baseId: string; revision: number };
export type CvAiEditRequest = {
  request_key: string;
  revision: number;
  instructions: string;
  selection: NodiaAiSelection;
};

export function matchesAiEdit(receipt: CvGeneration, target: CvAiEditTarget, intent: CvGenerationIntent) {
  return receipt.id !== target.baseId &&
    receipt.edit?.base_generation_id === target.baseId &&
    receipt.edit.base_revision === target.revision &&
    receivedCvIntent(receipt, intent);
}

export async function requestCvAiEdit(
  target: CvAiEditTarget,
  edit: CvAiEditRequest,
  intent: CvGenerationInput,
  sessionVersion: number,
) {
  const response = await mainInstance.post<unknown>(
    apiPath(`/nodia-cv/drafts/${target.baseId}/ai-edits`),
    edit,
    { expectedAuthSessionVersion: sessionVersion },
  );
  const receipt = cvGenerationSchema.parse(response.data);
  if (!matchesAiEdit(receipt, target, intent)) throw new Error("Unexpected Nodia CV edit identity");
  return receipt;
}

const sections = [
  "profile", "experience", "project", "skills", "education", "certification", "language", "additional",
] as const satisfies readonly CvDraftFact["section"][];

function sameSequence<T>(first: readonly T[], second: readonly T[]) {
  return first.length === second.length && first.every((item, index) => item === second[index]);
}

function documentSection(fact: CvDraftFact) {
  return fact.section === "profile" && fact.field === "main_stack" ? "skills" : fact.section;
}

export function cvAiEditChanges(base: CvGeneration, child: CvGeneration) {
  if (!base.draft || !base.review || !child.draft || !child.review) return null;
  const requirements = base.draft.requirements;
  if (child.draft.requirements.length !== requirements.length || child.draft.requirements.some((item, index) => {
    const original = requirements[index];
    return original.id !== item.id || original.quote !== item.quote || original.kind !== item.kind ||
      !sameSequence(original.evidenceIds, item.evidenceIds);
  })) return null;
  const evidence = base.review.evidence;
  if (child.review.evidence.length !== evidence.length || child.review.evidence.some((item, index) => {
    const original = evidence[index];
    return original.requirement_id !== item.requirement_id || original.source !== item.source ||
      original.detail !== item.detail;
  })) return null;
  const facts = new Map([...base.draft.selectedFacts, ...base.draft.remainingFacts].map(fact => [fact.id, fact]));
  const returned = [...child.draft.selectedFacts, ...child.draft.remainingFacts];
  if (returned.length !== facts.size || returned.some(fact => {
    const original = facts.get(fact.id);
    return !original || original.text !== fact.text || original.field !== fact.field ||
      original.section !== fact.section || original.groupId !== fact.groupId;
  })) return null;

  const previousIds = base.review.included_fact_ids;
  const nextIds = child.review.included_fact_ids;
  const oldItems = previousIds.map(id => facts.get(id)).filter((fact): fact is CvDraftFact => Boolean(fact));
  const newItems = nextIds.map(id => facts.get(id)).filter((fact): fact is CvDraftFact => Boolean(fact));
  if (oldItems.length !== previousIds.length || newItems.length !== nextIds.length) return null;

  const before = new Set(previousIds);
  const after = new Set(nextIds);
  const added = newItems.filter(fact => !before.has(fact.id));
  const omitted = oldItems.filter(fact => !after.has(fact.id));
  const priorCommon = previousIds.filter(id => after.has(id));
  const nextCommon = nextIds.filter(id => before.has(id));
  const reordered = sameSequence(priorCommon, nextCommon) ? [] : newItems.filter(fact => before.has(fact.id));

  const oldSections = new Set(oldItems.map(documentSection));
  const newSections = new Set(newItems.map(documentSection));
  const oldOrder = [...new Set([...(base.review.section_order ?? []), ...sections])]
    .filter(section => oldSections.has(section));
  const newOrder = [...new Set([...(child.review.section_order ?? []), ...sections])]
    .filter(section => newSections.has(section));
  const sectionsChanged = !sameSequence(
    oldOrder.filter(section => newSections.has(section)),
    newOrder.filter(section => oldSections.has(section)),
  );
  return {
    changed: added.length > 0 || omitted.length > 0 || reordered.length > 0 || sectionsChanged,
    added,
    omitted,
    reordered,
    sectionOrder: sectionsChanged ? newOrder : [],
  };
}
