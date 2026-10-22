import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  ConfirmNodiaAiProposalDto,
  NodiaAiConfirmationChallengeDto,
} from '../dto/nodia-ai-confirmation.dto.js';
import { NodiaAiConfirmationAvailabilityUseCase } from './nodia-ai-confirmation-availability.use-case.js';
import { confirmationFixture } from './confirmation.fixture.js';
import { validateNodiaAiLocalReceipt } from '../../nodia-ai-proposal/types/local-operation.types.js';
describe('NodiaAI strict human-channel inputs and executor admission', () => {
  it.each(['create', 'update', 'delete'])(
    'projects the registered closed preference %s receipt through the human status validator',
    (operation) => {
      const f = confirmationFixture(),
        id = '11111111-1111-4111-8111-111111111111';
      const source = {
        tool_name: `nodia_preferences_prepare_${operation}`,
        command_template: {
          id,
          ...(operation === 'create' ? {} : { expected_revision: 1 }),
        },
        scope: { subject_user_id: '1' },
        preconditions: {},
      };
      const receipt = {
        schema_version: 1,
        resource_key: 'nodia_ai_preferences',
        operation,
        resource_id: id,
        owner_id: '1',
        revision: operation === 'create' ? 1 : 2,
      };
      const assert = (schema: string, value: unknown, persisted: boolean) =>
        f.validate.assert(schema, value, persisted);
      expect(validateNodiaAiLocalReceipt(source, receipt, assert)).toEqual({
        resource_key: 'nodia_ai_preferences',
        id,
      });
      for (const delta of [
        { owner_id: '2' },
        { revision: 0 },
        { value: 'forbidden' },
      ])
        expect(() =>
          validateNodiaAiLocalReceipt(source, { ...receipt, ...delta }, assert),
        ).toThrow('nodia_ai:invalid_persisted_state');
    },
  );
  it('accepts only exact DTO data classes produced by the HTTP boundary', () => {
    const f = confirmationFixture();
    expect(
      f.validate.input(
        Object.assign(new ConfirmNodiaAiProposalDto(), f.request),
        'confirm',
      ),
    ).toEqual(f.request);
    const request = { proposal_revision: 1, expected_hash: f.revision.hash };
    expect(
      f.validate.input(
        Object.assign(new NodiaAiConfirmationChallengeDto(), request),
        'challenge',
      ),
    ).toEqual(request);
  });
  it.each([
    null,
    {},
    [],
    { proposal_revision: '1', expected_hash: 'a'.repeat(64) },
    { proposal_revision: 0, expected_hash: 'a'.repeat(64) },
    { proposal_revision: 1, expected_hash: 'g'.repeat(64) },
    { proposal_revision: 1, expected_hash: 'a'.repeat(64), actor_id: '2' },
  ])('rejects malformed challenge data %#', (input) => {
    const f = confirmationFixture();
    expect(() => f.validate.input(input, 'challenge')).toThrow(
      'nodia_ai:invalid_input',
    );
  });
  it.each([
    'A'.repeat(42),
    'A'.repeat(44),
    'A'.repeat(42) + 'B',
    ' '.repeat(43),
    'A'.repeat(42) + '=',
  ])('rejects invalid/noncanonical nonce %#', (confirmation_token) => {
    const f = confirmationFixture();
    expect(() =>
      f.validate.input({ ...f.request, confirmation_token }, 'confirm'),
    ).toThrow('nodia_ai:invalid_input');
  });
  it('does not invoke getters or custom toJSON while validating DTOs', () => {
    const f = confirmationFixture();
    let executed = false;
    const input = Object.assign(new ConfirmNodiaAiProposalDto(), f.request);
    Object.defineProperty(input, 'confirmation_token', {
      enumerable: true,
      get() {
        executed = true;
        return f.token;
      },
    });
    expect(() => f.validate.input(input, 'confirm')).toThrow(
      'nodia_ai:invalid_input',
    );
    expect(executed).toBe(false);
    const custom = {
      ...f.request,
      toJSON() {
        executed = true;
        return f.request;
      },
    };
    expect(() => f.validate.input(custom, 'confirm')).toThrow(
      'nodia_ai:invalid_input',
    );
    expect(executed).toBe(false);
  });
  it('requires both exact contract and exact catalog from server-owned executor registration', () => {
    const f = confirmationFixture();
    expect(
      f.availability.describe([f.step], f.revision.catalog_version),
    ).toEqual({ can_confirm: true, reason: null });
    expect(f.availability.describe([f.step], 'unknown/1').can_confirm).toBe(
      false,
    );
    expect(
      f.availability.describe(
        [{ ...f.step, contract_hash: 'b'.repeat(64) }],
        f.revision.catalog_version,
      ).can_confirm,
    ).toBe(false);
    expect(
      f.availability.describe([], f.revision.catalog_version).can_confirm,
    ).toBe(false);
  });
  it('rejects ambiguous duplicate executor registrations at startup', () => {
    const f = confirmationFixture();
    const registration = {
      toolName: f.step.tool_name,
      contractHash: f.step.contract_hash,
      catalogVersion: f.revision.catalog_version,
    };
    expect(
      () =>
        new NodiaAiConfirmationAvailabilityUseCase([
          registration,
          registration,
        ]),
    ).toThrow('nodia_ai:invalid_execution_admission');
  });
});
