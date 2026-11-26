import type { UpdateNodiaCvDraftDto } from '../dto/nodia-cv-draft.dto.js';
import { isStructuralCvFact } from '../engine/evidence.js';
import type { CvTailoringDraft } from '../engine/index.js';
import type {
  CvDraftReviewContent,
  CvGenerationRow,
} from '../types/nodia-cv-generation.types.js';
import { cvGenerationError } from './nodia-cv-generation-errors.js';
import { requireLiveCvGeneration } from './nodia-cv-generation-status.js';

export function prepareCvDraftReview(
  draft: CvTailoringDraft,
  input: UpdateNodiaCvDraftDto,
  sectionOrder?: CvDraftReviewContent['section_order'],
): CvDraftReviewContent {
  const requirements = new Set(draft.requirements.map(({ id }) => id));
  for (const entry of input.evidence) {
    if (!requirements.delete(entry.requirement_id))
      cvGenerationError('invalid_draft_review', 400);
  }

  const facts = [...draft.selectedFacts, ...draft.remainingFacts];
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  const included = new Set(input.included_fact_ids);
  if (included.size !== input.included_fact_ids.length)
    cvGenerationError('invalid_draft_review', 400);

  const anchorsByGroup = new Map<string, string[]>();
  for (const fact of facts) {
    if (!isStructuralCvFact(fact)) continue;
    const anchors = anchorsByGroup.get(fact.groupId) ?? [];
    anchors.push(fact.id);
    anchorsByGroup.set(fact.groupId, anchors);
  }

  const resolved = new Set<string>();
  for (const id of included) {
    const fact = byId.get(id);
    if (!fact) cvGenerationError('invalid_draft_review', 400);
    for (const anchor of anchorsByGroup.get(fact.groupId) ?? [])
      resolved.add(anchor);
    resolved.add(id);
  }

  return {
    included_fact_ids: [...resolved],
    evidence: input.evidence.map(({ requirement_id, source, detail }) => ({
      requirement_id,
      source,
      detail,
    })),
    ...(sectionOrder ? { section_order: sectionOrder } : {}),
  };
}

export function requireCvEditBase(
  row: CvGenerationRow | null,
  revision: number,
) {
  if (!row || row.qualification) cvGenerationError('generation_not_found', 404);
  const profileId = requireLiveCvGeneration(row);
  if (
    row.state !== 'ready' ||
    !row.profile_snapshot ||
    row.offer_text === null ||
    !row.draft ||
    !row.review
  )
    cvGenerationError('draft_not_ready');
  if (row.review_revision !== revision) cvGenerationError('stale_draft');
  return {
    ...row,
    profile_id: profileId,
    profile_snapshot: row.profile_snapshot,
    offer_text: row.offer_text,
    draft: row.draft,
    review: row.review,
  };
}
