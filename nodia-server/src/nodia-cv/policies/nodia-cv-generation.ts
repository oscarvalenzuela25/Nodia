import { createHash } from 'node:crypto';
import type { StartNodiaCvAiEditDto } from '../dto/nodia-cv-draft.dto.js';
import {
  CV_MAX_OFFER_BYTES,
  type StartNodiaCvGenerationDto,
} from '../dto/nodia-cv-generation.dto.js';
import {
  CV_EDIT_MAX_INSTRUCTIONS_BYTES,
  CV_EDIT_PURPOSE,
  type CvTailoringDraft,
  type PreparedCvTailoring,
} from '../engine/index.js';
import { cvGenerationError } from './nodia-cv-generation-errors.js';

export const CV_PROBE_OFFER = 'Required: TypeScript. Preferred: Kubernetes.';
export const CV_PROBE_CANDIDATE = 'CV Synthetic Candidate';

const digest = (text: string) =>
  createHash('sha256').update(text).digest('hex');

function wellFormed(text: string) {
  return !text.includes('\0') && Buffer.from(text).toString('utf8') === text;
}

export function cvGenerationIntent(input: StartNodiaCvGenerationDto): string {
  const {
    selection,
    offer_text,
    profile_id,
    profile_revision,
    language,
    vacancy_title,
    vacancy_company,
  } = input;
  if (
    ![
      offer_text,
      vacancy_title ?? '',
      vacancy_company ?? '',
      selection.model_id,
      selection.effort_id ?? '',
    ].every(wellFormed) ||
    Buffer.byteLength(offer_text, 'utf8') > CV_MAX_OFFER_BYTES
  )
    cvGenerationError('generation_input_too_large', 400);
  return digest(
    JSON.stringify({
      profile_id: profile_id.toLowerCase(),
      profile_revision,
      language,
      offer_text,
      vacancy_title: vacancy_title || null,
      vacancy_company: vacancy_company || null,
      selection: {
        connection_id: selection.connection_id,
        mode: selection.mode,
        model_id: selection.model_id,
        effort_id: selection.effort_id,
      },
    }),
  );
}

export function cvEditIntent(
  baseId: string,
  input: StartNodiaCvAiEditDto,
): string {
  const { instructions, revision, selection } = input;
  if (
    Buffer.byteLength(instructions, 'utf8') > CV_EDIT_MAX_INSTRUCTIONS_BYTES ||
    !/^(?:[^\p{Cc}\p{Cs}\p{Bidi_Control}]|\n)+$/u.test(instructions) ||
    ![selection.model_id, selection.effort_id ?? ''].every(wellFormed)
  )
    cvGenerationError('generation_invalid_input', 400);
  return digest(
    JSON.stringify({
      purpose: CV_EDIT_PURPOSE,
      base_generation_id: baseId.toLowerCase(),
      base_revision: revision,
      instructions,
      selection: {
        connection_id: selection.connection_id,
        mode: selection.mode,
        model_id: selection.model_id,
        effort_id: selection.effort_id,
      },
    }),
  );
}

export function cvGenerationPrompt(prepared: PreparedCvTailoring): string {
  return prepared.systemPrompt + '\n\n' + prepared.userPrompt;
}

export function cvExecutionHash(
  inputHash: string,
  scopeHash: string,
  prompt: string,
): string {
  return digest(
    JSON.stringify({ purpose: 'cv_tailoring', inputHash, scopeHash, prompt }),
  );
}

export function validCvProbeDraft(draft: CvTailoringDraft): boolean {
  const expectedSupported = draft.requirements.find(
    (r) =>
      r.kind === 'required' &&
      r.coverage === 'supported' &&
      /\btypescript\b/i.test(r.quote),
  );
  const gap = draft.requirements.find(
    (r) =>
      r.kind === 'preferred' &&
      r.coverage === 'gap' &&
      /\bkubernetes\b/i.test(r.quote),
  );
  return Boolean(
    expectedSupported &&
    gap &&
    draft.selectedFacts.some((f) => /\btypescript\b/i.test(f.text)),
  );
}

export const cvResponseHash = digest;
