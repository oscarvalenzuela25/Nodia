import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSessionDto, PatchSetupDraftDto, PauseDto, ProposePlanDto, SetupMessageDto } from './teacher.dto.js';

const options = { whitelist: true, forbidNonWhitelisted: true };
const validateDto = <T extends object>(type: new () => T, body: object) => validate(plainToInstance(type, body), options);
const create = { topic: 'Synthetic topic', objective: 'Synthetic objective', explanation_language: 'es' };
const selected = { connection_id: '2', mode: 'agentic', model_id: 'synthetic-model', effort_id: null };

describe('Teacher create and setup draft HTTP contracts', () => {
  it('keeps the legacy create envelope unchanged when no generation was requested', async () => {
    const dto = plainToInstance(CreateSessionDto, create);
    expect(await validate(dto, options)).toHaveLength(0);
    expect(dto.start_plan).toBeUndefined();
    expect(dto.selection).toBeUndefined();
  });
  it('accepts explicit initial selection and denies invalid start flags or injected identity', async () => {
    expect(await validateDto(CreateSessionDto, { ...create, start_plan: true, selection: selected })).toHaveLength(0);
    for (const body of [
      { ...create, start_plan: 'true' }, { ...create, start_plan: null },
      { ...create, owner_user_id: '2' },
      { ...create, selection: { ...selected, token: 'synthetic-forbidden' } },
    ]) expect(await validateDto(CreateSessionDto, body)).not.toHaveLength(0);
  });
  it('requires independent draft revision and raw text, rejecting injected fields', async () => {
    expect(await validateDto(PatchSetupDraftDto, { expected_draft_revision: 0, text: '' })).toHaveLength(0);
    for (const body of [
      { expected_draft_revision: -1, text: '' }, { expected_draft_revision: 0, text: 'a'.repeat(4001) },
      { expected_draft_revision: 0, text: '', generate_reply: true },
    ]) expect(await validateDto(PatchSetupDraftDto, body)).not.toHaveLength(0);
  });
  it('keeps Teacher-suggested scheduling explicit for an existing draft proposal', async () => {
    expect(await validateDto(ProposePlanDto, { expected_session_revision: 1, organization: 'teacher_suggests', day_count: null })).toHaveLength(0);
    expect(await validateDto(ProposePlanDto, { expected_session_revision: 1, organization: 'weekly' })).not.toHaveLength(0);
  });
  it('accepts atomic pause draft and optional message snapshot without changing legacy send', async () => {
    const pause = { expected_session_revision: 1, expected_cursor_revision: 1, cursor: { phase: 'setup' } };
    expect(await validateDto(PauseDto, { ...pause, pending_setup_draft: { expected_draft_revision: 0, text: 'unsent' } })).toHaveLength(0);
    expect(await validateDto(PauseDto, { ...pause, pending_setup_draft: { text: 'unsent' } })).not.toHaveLength(0);
    expect(await validateDto(SetupMessageDto, { expected_session_revision: 1, text: 'hello' })).toHaveLength(0);
    expect(await validateDto(SetupMessageDto, { expected_session_revision: 1, expected_draft_revision: 0, text: 'hello' })).toHaveLength(0);
  });
});
