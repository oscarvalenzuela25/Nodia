import type {
  NodiaCvVersionAnalysisDto,
  NodiaCvVersionSummaryDto,
} from '../dto/nodia-cv-pdf-version.dto.js';
import {
  CV_TAILORING_SCHEMA_VERSION,
  type CvTailoringDraft,
} from '../engine/index.js';
import type { CvPdfSourceSnapshot } from '../pdf/nodia-cv-pdf-source.js';
import type {
  CvDraftReviewContent,
  CvSourceVersion,
} from '../types/nodia-cv-generation.types.js';
import type { NodiaCvProfileDetail } from '../types/nodia-cv-profile.types.js';

export const CV_VERSION_COPY_PURPOSE = 'cv_saved_version_copy';

export type CvSavedDraftSource = NodiaCvVersionSummaryDto & {
  snapshot: CvPdfSourceSnapshot & {
    profile_id: string;
    profile_revision: number;
    review_revision: number;
    offer_sha256: string;
  };
  analysis: NodiaCvVersionAnalysisDto | null;
};

export function prepareCvVersionDraft(version: CvSavedDraftSource) {
  const { snapshot, analysis } = version;
  const included = new Set(snapshot.facts.map(({ id }) => id));
  // Keep the archived PDF's selections and order, with only saved analysis facts
  // available as further, verified evidence. Never restore from a mutable profile.
  const draft: CvTailoringDraft = {
    schemaVersion: CV_TAILORING_SCHEMA_VERSION,
    locale: version.language,
    requirements: analysis?.requirements ?? [],
    selectedFacts: snapshot.facts,
    remainingFacts: analysis?.facts.filter(({ id }) => !included.has(id)) ?? [],
    ...(analysis?.technology_options ? { technologyOptions: analysis.technology_options } : {}),
  };
  const review: CvDraftReviewContent = {
    included_fact_ids: [...included],
    evidence: snapshot.evidence,
    ...((analysis?.technologies ?? snapshot.technologies)
      ? { technologies: analysis?.technologies ?? snapshot.technologies }
      : {}),
    ...(snapshot.section_order
      ? { section_order: snapshot.section_order }
      : {}),
  };
  const profile: NodiaCvProfileDetail = {
    ...snapshot.profile,
    id: snapshot.profile_id,
    revision: snapshot.profile_revision,
    schema_version: 1,
    created_at: version.created_at,
    updated_at: version.created_at,
    profile_name: version.profile_name,
    main_stack: [],
    experiences: [],
    projects: [],
    skill_areas: [],
    education: [],
    certifications: [],
    languages: [],
    additional_sections: [],
  };
  const source: CvSourceVersion = {
    id: version.id,
    template: version.template,
    offer_sha256: snapshot.offer_sha256,
  };
  return { draft, review, profile, source };
}
