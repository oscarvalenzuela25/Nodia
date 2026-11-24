export const CV_TAILORING_PURPOSE = 'cv_tailoring';
export const CV_TAILORING_PROMPT_VERSION = 'cv-tailoring/1';
export const CV_TAILORING_SCHEMA_VERSION = 1;
export const CV_TAILORING_MAX_OFFER_BYTES = 64 * 1024;
export const CV_TAILORING_MAX_PROMPT_BYTES = 160 * 1024;
export const CV_TAILORING_MAX_RESPONSE_BYTES = 128 * 1024;

export type CvTailoringLocale = 'es' | 'en';

export type CvEvidenceSection =
  | 'profile'
  | 'experience'
  | 'project'
  | 'skills'
  | 'education'
  | 'certification'
  | 'language'
  | 'additional';

export interface CvEvidenceFact {
  readonly id: string;
  readonly section: CvEvidenceSection;
  readonly groupId: string;
  readonly field: string;
  readonly text: string;
}

export interface PreparedCvTailoring {
  readonly locale: CvTailoringLocale;
  readonly promptVersion: typeof CV_TAILORING_PROMPT_VERSION;
  readonly schemaVersion: typeof CV_TAILORING_SCHEMA_VERSION;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  /** Server-only sources. Pass only the two prompt strings to the transport. */
  readonly normalizedOffer: string;
  readonly providedOffer: string;
  readonly evidence: readonly CvEvidenceFact[];
}

export type CvRequirementKind = 'required' | 'preferred' | 'uncertain';
export type CvRequirementCoverage = 'supported' | 'confirm' | 'omitted' | 'gap';

export interface CvDraftRequirement {
  id: string;
  quote: string;
  kind: CvRequirementKind;
  coverage: CvRequirementCoverage;
  evidenceIds: string[];
}

export interface CvTailoringDraft {
  schemaVersion: typeof CV_TAILORING_SCHEMA_VERSION;
  locale: CvTailoringLocale;
  requirements: CvDraftRequirement[];
  selectedFacts: CvEvidenceFact[];
  remainingFacts: CvEvidenceFact[];
}

export type CvTailoringErrorCode =
  | 'invalid_offer'
  | 'input_too_large'
  | 'no_profile_evidence'
  | 'invalid_model_output'
  | 'invalid_citation'
  | 'invalid_evidence';

export class CvTailoringError extends Error {
  constructor(readonly code: CvTailoringErrorCode) {
    super(code);
    this.name = 'CvTailoringError';
  }
}
