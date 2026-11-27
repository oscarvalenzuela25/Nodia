import type { CvGenerationRow } from '../types/nodia-cv-generation.types.js';
import { minimizeCvText } from '../engine/evidence.js';
import { analyzeCvTechnologies } from '../engine/technologies.js';
import { cvGenerationError } from './nodia-cv-generation-errors.js';

export function cvGenerationProfileId(row: CvGenerationRow) {
  return row.source_version ? row.profile_snapshot?.id : row.profile_id;
}

export function requireLiveCvGeneration(row: CvGenerationRow) {
  const profileId = cvGenerationProfileId(row);
  if (
    row.state === 'expired' ||
    !profileId ||
    row.expires_at.getTime() <= Date.now()
  )
    cvGenerationError('generation_expired', 410);
  return profileId;
}

export function visibleGeneration(row: CvGenerationRow) {
  const technologyOptions = row.draft && row.state === 'ready'
    ? row.draft.technologyOptions ?? analyzeCvTechnologies(
      row.draft, row.profile_snapshot ? minimizeCvText(row.profile_snapshot)(row.offer_text ?? '') : '',
    )
    : undefined;
  return {
    id: row.id,
    state: row.state,
    profile_id: requireLiveCvGeneration(row),
    profile_revision: row.profile_revision,
    language: row.language,
    selection: row.selection_snapshot,
    created_at: row.created_at,
    expires_at: row.expires_at,
    vacancy_title: row.vacancy_title,
    vacancy_company: row.vacancy_company,
    error_code: row.error_code,
    draft: row.draft,
    ...(technologyOptions ? { technology_options: technologyOptions } : {}),
    ...(row.source_version
      ? {
          source_version: {
            id: row.source_version.id,
            template: row.source_version.template,
          },
        }
      : {}),
    ...(row.edit_input
      ? {
          edit: {
            base_generation_id: row.edit_input.base_generation_id,
            base_revision: row.edit_input.base_revision,
          },
        }
      : {}),
    review:
      row.review && row.review_revision !== null
        ? {
            revision: row.review_revision,
            included_fact_ids: row.review.included_fact_ids,
            evidence: row.review.evidence,
            ...(row.review.technologies ? { technologies: row.review.technologies } : {}),
            ...(row.review.section_order
              ? { section_order: row.review.section_order }
              : {}),
          }
        : null,
  };
}

export function recoverableGeneration(row: CvGenerationRow) {
  const visible = visibleGeneration(row);
  if (row.offer_text === null || !row.profile_snapshot)
    cvGenerationError('request_failed', 500);
  return {
    ...visible,
    recovery: {
      offer_text: row.offer_text,
      profile: row.profile_snapshot,
    },
  };
}
