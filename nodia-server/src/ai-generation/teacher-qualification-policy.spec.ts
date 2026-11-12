import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { hash } from '../teacher/policies/teacher-validation.js';
import { TeacherGenerationRuntimeService } from './teacher-generation-runtime.service.js';
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
describe('Teacher application-policy qualification', () => {
  it('binds prompt contracts and budgets separately from the historical text transport', () => {
    const legacy = hash({
      contract: 'teacher-text/1',
      selection,
      configuration: config.configurationGeneration,
      session: config.sessionGeneration,
    });
    expect(teacherApiQualificationScope(selection, config)).not.toBe(legacy);
    expect(
      TEACHER_GENERATION_POLICY.purposes.contextual_reply.qualification_mode,
    ).toBe('purpose_probe_required');
    expect(
      TEACHER_GENERATION_POLICY.purposes.contextual_reply.maximum_execution_ms,
    ).toBe(120000);
  });
  it('does not promote a historical canary or an altered setup template to current policy', () => {
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
  it('API verification rejects old scope and admits only the exact new scope', async () => {
    // SQL/configuration/authority are boundaries; the actual runtime verification
    // and application-policy scope calculation remain under test.
    const runtime = Object.create(
      TeacherGenerationRuntimeService.prototype,
    ) as TeacherGenerationRuntimeService;
    const boundary = runtime as unknown as {
      authority: () => Promise<void>;
      configuration: () => Promise<typeof config>;
    };
    vi.spyOn(boundary, 'authority').mockResolvedValue(undefined);
    vi.spyOn(boundary, 'configuration').mockResolvedValue(config);
    let saved = hash({
      contract: 'teacher-text/1',
      selection,
      configuration: config.configurationGeneration,
      session: null,
    });
    let purposeScope: string | null = null;
    const manager = {
      query: async (sql: string, args: unknown[]) => {
        const stored = sql.includes('teacher_purpose_qualifications') ? purposeScope : saved;
        return args[0] === stored ? [{ scope_hash: stored }] : [];
      },
    } as unknown as EntityManager;
    const actor = {
      userId: '1',
      sessionId: '10000000-0000-4000-8000-000000000001',
    };
    await expect(
      runtime.verifySelection(manager, actor, selection, 'learning_packet'),
    ).rejects.toThrow('adapter_unqualified');
    saved = teacherApiQualificationScope(selection, config);
    expect(
      await runtime.verifySelection(
        manager,
        actor,
        selection,
        'learning_packet',
      ),
    ).toEqual({
      configuration_generation: config.configurationGeneration,
      session_generation: null,
    });
    await expect(
      runtime.verifySelection(manager, actor, selection, 'contextual_reply'),
    ).rejects.toThrow('adapter_unqualified');
    purposeScope = teacherPurposeQualificationScope(saved);
    await expect(runtime.verifySelection(manager, actor, selection, 'contextual_reply')).resolves.toEqual({
      configuration_generation: config.configurationGeneration, session_generation: null,
    });
    purposeScope = teacherPurposeQualificationScope('b'.repeat(64));
    await expect(runtime.verifySelection(manager, actor, selection, 'contextual_reply')).rejects.toThrow('adapter_unqualified');
  });
  it('requires a distinct helper proof after setup transport qualification', () => {
    expect(teacherPurposeRequiresQualification('setup_reply')).toBe(false);
    expect(teacherPurposeRequiresQualification('contextual_reply')).toBe(true);
    const transportScope = teacherApiQualificationScope(selection, config);
    expect(teacherPurposeQualificationScope(transportScope)).not.toBe(transportScope);
  });
});
