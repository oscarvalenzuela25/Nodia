import { describe, expect, it } from 'vitest';
import { CreateNodiaAiConversationDto } from '../dto/create-nodia-ai-conversation.dto.js';
import { ValidateNodiaAiConversationInputUseCase } from './validate-nodia-ai-conversation-input.use-case.js';
const client_request_id = '15f71e5b-1a66-4a9d-8d79-dc64358adac7';
const selected = {
  connection_id: '9223372036854775807',
  mode: 'token_plan_web',
  model_id: 'synthetic-configured-model',
};
const subject = new ValidateNodiaAiConversationInputUseCase();
describe('ValidateNodiaAiConversationInputUseCase', () => {
  it('revalidates a concrete DTO instance supplied by a future HTTP pipe', () => {
    const dto = Object.assign(new CreateNodiaAiConversationDto(), {
      client_request_id,
    });
    expect(subject.execute(dto).client_request_id).toBe(client_request_id);
    expect(() =>
      subject.execute(Object.assign(dto, { owner_id: '2' })),
    ).toThrow('nodia_ai:invalid_input');
  });
  it('canonicalizes optional state without inventing a selected model or routing', () => {
    expect(
      subject.execute({ client_request_id: client_request_id.toUpperCase() }),
    ).toEqual({ client_request_id, title: null, selection: null });
    expect(
      subject.execute({ client_request_id, selection: selected }).selection,
    ).toEqual({ ...selected, effort_id: null });
  });
  it('preserves dynamic models, exact identity and effort from configuration', () => {
    expect(
      subject.execute({
        client_request_id,
        selection: {
          ...selected,
          model_id: 'new-provider-release',
          effort_id: 'configured-effort',
        },
      }).selection,
    ).toEqual({
      ...selected,
      model_id: 'new-provider-release',
      effort_id: 'configured-effort',
    });
  });
  it.each([
    null,
    [],
    'chat',
    { client_request_id, owner_id: '2' },
    { client_request_id, routing_enabled: true },
    { client_request_id, title: null },
    { client_request_id, title: '' },
    { client_request_id, title: '   ' },
    { client_request_id, selection: null },
    { client_request_id, selection: { ...selected, secret: 'synthetic' } },
    {
      client_request_id,
      selection: { ...selected, connection_id: '9223372036854775808' },
    },
    { client_request_id, selection: { ...selected, connection_id: 123 } },
    { client_request_id, selection: { ...selected, connection_id: '01' } },
    { client_request_id, selection: { ...selected, model_id: '' } },
    { client_request_id, selection: { ...selected, mode: 'automatic' } },
    { client_request_id, selection: { ...selected, effort_id: 0 } },
    { client_request_id: '15f71e5b-1a66-1a9d-8d79-dc64358adac7' },
  ])('rejects untrusted/unknown or coercible values (%j)', (input) => {
    expect(() => subject.execute(input)).toThrow('nodia_ai:invalid_input');
  });
  it.each(['constructor', '__proto__', 'prototype'])(
    'rejects prototype-sensitive keys before transformation (%s)',
    (key) => {
      const top = JSON.parse(
        JSON.stringify({ client_request_id }).slice(0, -1) +
          ',"' +
          key +
          '":{}}',
      );
      expect(() => subject.execute(top)).toThrow('nodia_ai:invalid_input');
      const nested = JSON.parse(
        JSON.stringify({
          client_request_id,
          selection: { ...selected, [key]: {} },
        }),
      );
      expect(() => subject.execute(nested)).toThrow('nodia_ai:invalid_input');
    },
  );
  it('counts UTF-8 title bytes including multibyte characters', () => {
    expect(
      subject.execute({ client_request_id, title: '😀'.repeat(64) }).title,
    ).toHaveLength(128);
    expect(() =>
      subject.execute({ client_request_id, title: '😀'.repeat(65) }),
    ).toThrow('nodia_ai:invalid_input');
  });
});
