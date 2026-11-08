import { describe, expect, it } from 'vitest';
import { assessment } from './teacher-validation.js';

const target = { scope: 'section_final' as const, plan_revision_id: null, section_id: null, unit_id: null };
const slots = [{ ordinal: 1, objective_id: 'objective-1', kind: 'completion' as const, max_points: 2 as const }];
function candidate(alternative: string, hint: unknown) {
  return {
    schema_version: 1, ...target,
    items: [{
      local_ref: 'item-1', objective_id: 'objective-1', kind: 'completion',
      prompt: 'Indica el tipo de registro.',
      private_key: { kind: 'completion', alternatives: [alternative], case_sensitive: false },
      explanation: 'Explicación sintética del criterio.', hint,
    }],
  };
}

describe('Optional generated completion hints', () => {
  it.each([
    ['A', 'Consulta el contexto antes de responder.'],
    ['AAAA', 'El registro correcto es aaaa.'],
    ['café', 'La palabra es CAFE\u0301.'],
  ])('omits a conservatively suspected hint without changing the input or strict question/key', (alternative, hint) => {
    const input = candidate(alternative, hint), original = structuredClone(input);
    const parsed = assessment(input, slots, target);
    expect(parsed.items[0]).not.toHaveProperty('hint');
    expect(parsed.items[0].private_key).toEqual(input.items[0].private_key);
    expect(parsed.items[0].prompt).toBe(input.items[0].prompt);
    expect(input).toEqual(original);
  });

  it('preserves safe valid hints and permits absent optional hints', () => {
    const input = candidate('CNAME', 'Piensa en el propósito del alias.');
    expect(assessment(input, slots, target).items[0].hint).toBe(input.items[0].hint);
    const absent = candidate('CNAME', undefined);
    expect(assessment(absent, slots, target).items[0]).not.toHaveProperty('hint');
  });

  it.each([null, 42, {}, '', 'x'.repeat(1001)])('continues to reject malformed hints before considering omission', (hint) => {
    expect(() => assessment(candidate('A', hint), slots, target)).toThrow();
  });

  it('does not repair an invalid blueprint, target, key or question', () => {
    const input = candidate('A', 'Consulta el contexto antes de responder.');
    expect(() => assessment(input, [{ ...slots[0], kind: 'short_text' }], target)).toThrow();
    expect(() => assessment({ ...input, scope: 'unit_practice' }, slots, target)).toThrow();
    const key = structuredClone(input); key.items[0].private_key.alternatives = [];
    expect(() => assessment(key, slots, target)).toThrow();
    const question = structuredClone(input); question.items[0].prompt = '';
    expect(() => assessment(question, slots, target)).toThrow();
  });
});
