import {
  promptSnapshot,
  TEACHER_TEMPLATE_VERSION,
} from '../teacher/policies/teacher-prompts.js';
import { teacherGenerationDeadline } from '../teacher/policies/teacher-generation-deadline.js';
import { hash } from '../teacher/policies/teacher-validation.js';
import type {
  TeacherPurpose,
  TeacherSelection,
} from '../teacher/types/teacher.types.js';

const purposes: readonly TeacherPurpose[] = [
  'setup_reply',
  'plan_outline',
  'plan_adjustment',
  'learning_packet',
  'assessment_only',
  'written_feedback',
  'contextual_reply',
];
/** Application policy is separate from the stable, historical transport contracts. */
export const TEACHER_GENERATION_POLICY = Object.freeze({
  version: 'teacher-generation-policy/2',
  template_version: TEACHER_TEMPLATE_VERSION,
  maximum_prompt_bytes: 131072,
  maximum_result_bytes: 32768,
  tools: 'none',
  retries: 0,
  purposes: Object.freeze(
    Object.fromEntries(
      purposes.map((purpose) => [
        purpose,
        Object.freeze({
          template_hash: promptSnapshot(purpose, {}).template_hash,
          maximum_execution_ms: teacherGenerationDeadline(
            purpose,
            new Date('2100-01-01T00:00:00Z'),
            0,
          ),
          qualification_mode:
            purpose === 'contextual_reply'
              ? 'purpose_probe_required'
              : 'text_transport_probe',
        }),
      ]),
    ),
  ),
});
export const TEACHER_GENERATION_POLICY_HASH = hash(TEACHER_GENERATION_POLICY);
/** A setup canary does not qualify a new anchored helper protocol. */
export function teacherPurposeRequiresQualification(
  purpose: TeacherPurpose | undefined,
): boolean {
  return purpose === 'contextual_reply';
}
export function teacherPurposeQualificationScope(transportScope: string): string {
  return hash({ contract: 'teacher-purpose/1', policy_hash: TEACHER_GENERATION_POLICY_HASH,
    transport_scope: transportScope, purpose: 'contextual_reply' });
}
export function teacherApiQualificationScope(
  selection: TeacherSelection,
  config: { configurationGeneration: string; sessionGeneration: string | null },
): string {
  return hash({
    contract: 'teacher-text/1',
    policy_hash: TEACHER_GENERATION_POLICY_HASH,
    selection,
    configuration: config.configurationGeneration,
    session: config.sessionGeneration,
  });
}
export function currentTeacherQualificationProbe(
  probe: unknown,
  templateHash: unknown,
): boolean {
  if (!probe || typeof probe !== 'object' || Array.isArray(probe)) return false;
  const value = probe as Record<string, unknown>;
  return (
    value.teacher_policy_hash === TEACHER_GENERATION_POLICY_HASH &&
    templateHash ===
      TEACHER_GENERATION_POLICY.purposes.setup_reply.template_hash
  );
}
