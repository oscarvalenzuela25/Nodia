import { describe, expect, it } from 'vitest';
import { hash } from '../teacher/policies/teacher-validation.js';
import type { TeacherPurpose } from '../teacher/types/teacher.types.js';
import {
  currentTeacherQualificationProbe,
  teacherApiQualificationScope,
  teacherPurposeRequiresQualification,
  teacherPurposeQualificationScope,
  TEACHER_GENERATION_POLICY,
  TEACHER_GENERATION_POLICY_HASH,
} from './teacher-qualification-policy.js';

const selection = {
  connection_id: '1',
  mode: 'api_key' as const,
  model_id: 'synthetic-model',
  effort_id: null,
};
const config = {
  configurationGeneration: 'a'.repeat(64),
  sessionGeneration: null,
};
describe('Teacher optional diagnostic policy', () => {
  it('binds prompt contracts and budgets separately from the historical text transport', () => {
    const legacy = hash({
      contract: 'teacher-text/1',
      selection,
      configuration: config.configurationGeneration,
      session: config.sessionGeneration,
    });
    expect(teacherApiQualificationScope(selection, config)).not.toBe(legacy);
    expect(TEACHER_GENERATION_POLICY.version).toBe('teacher-generation-policy/3');
    expect(TEACHER_GENERATION_POLICY.tools).toBe('none');
    expect(TEACHER_GENERATION_POLICY.retries).toBe(0);
    expect(
      TEACHER_GENERATION_POLICY.purposes.contextual_reply.maximum_execution_ms,
    ).toBe(120000);
  });
  it('does not promote a historical canary or an altered setup template to current policy', () => {
    const previousPolicy = {
      ...TEACHER_GENERATION_POLICY,
      version: 'teacher-generation-policy/2',
      purposes: Object.fromEntries(Object.entries(TEACHER_GENERATION_POLICY.purposes).map(([purpose, policy]) => [
        purpose, { ...policy, qualification_mode: purpose === 'contextual_reply' ? 'purpose_probe_required' : 'text_transport_probe' },
      ])),
    };
    const previousHash = hash(previousPolicy);
    expect(previousHash).not.toBe(TEACHER_GENERATION_POLICY_HASH);
    expect(currentTeacherQualificationProbe({ teacher_policy_hash: previousHash },
      TEACHER_GENERATION_POLICY.purposes.setup_reply.template_hash)).toBe(false);
    expect(
      currentTeacherQualificationProbe(
        { nonce: 'legacy' },
        TEACHER_GENERATION_POLICY.purposes.setup_reply.template_hash,
      ),
    ).toBe(false);
    expect(
      currentTeacherQualificationProbe(
        { teacher_policy_hash: TEACHER_GENERATION_POLICY_HASH },
        'b'.repeat(64),
      ),
    ).toBe(false);
    expect(
      currentTeacherQualificationProbe(
        { teacher_policy_hash: TEACHER_GENERATION_POLICY_HASH },
        TEACHER_GENERATION_POLICY.purposes.setup_reply.template_hash,
      ),
    ).toBe(true);
  });
  it('keeps optional diagnostics scoped to the exact selection, configuration and session', () => {
    const transportScope = teacherApiQualificationScope(selection, config);
    for (const changed of [
      { ...selection, connection_id: 'another-connection' },
      { ...selection, mode: 'agentic' as const },
      { ...selection, model_id: 'another-model' },
      { ...selection, effort_id: 'another-effort' },
    ]) expect(teacherApiQualificationScope(changed, config)).not.toBe(transportScope);
    expect(teacherApiQualificationScope(selection, { ...config, configurationGeneration: 'b'.repeat(64) })).not.toBe(transportScope);
    expect(teacherApiQualificationScope(selection, { ...config, sessionGeneration: 'session-generation' })).not.toBe(transportScope);
    expect(teacherPurposeQualificationScope(transportScope)).not.toBe(transportScope);
    expect(teacherPurposeQualificationScope(teacherApiQualificationScope({ ...selection, effort_id: 'another-effort' }, config)))
      .not.toBe(teacherPurposeQualificationScope(transportScope));
  });
  it.each([...Object.keys(TEACHER_GENERATION_POLICY.purposes), undefined])(
    'does not require a prior probe for selected purpose %s', purpose => {
      expect(teacherPurposeRequiresQualification(purpose as TeacherPurpose | undefined)).toBe(false);
      if (purpose) expect(TEACHER_GENERATION_POLICY.purposes[purpose].qualification_mode).toBe('optional_diagnostic');
    },
  );
  it('retains policy-scoped diagnostic compatibility without changing historical transport contracts', () => {
    const transportScope = teacherApiQualificationScope(selection, config);
    expect(teacherPurposeQualificationScope(transportScope)).toBe(hash({
      contract: 'teacher-purpose/1', policy_hash: TEACHER_GENERATION_POLICY_HASH,
      transport_scope: transportScope, purpose: 'contextual_reply',
    }));
  });
});
