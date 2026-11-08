import { describe, expect, it } from 'vitest';
import {
  answer,
  blueprint,
  canonical,
  defaultPolicy,
  guide,
  hash,
  outline,
  packet,
  parseJsonOutput,
  selection,
  text,
} from './teacher-validation.js';
import {
  aggregateGrade,
  deterministicGrade,
  normalizeCompletion,
  validateWrittenFeedback,
} from './teacher-assessment.js';
import {
  outlineIds,
  sectionHashes,
} from '../use-case/teacher-plan-persistence.js';

export function planFixture() {
  return {
    schema_version: 1,
    title: 'Networks',
    topic: 'Networks',
    objective: 'Understand DNS',
    explanation_language: 'en',
    organization: 'topics',
    day_count: null,
    sections: [
      {
        id: 'section',
        title: 'DNS',
        required: true,
        prerequisite_section_ids: [] as string[],
        objectives: [{ id: 'objective', description: 'Explain DNS' }],
        units: [
          {
            id: 'unit',
            title: 'Resolution',
            objective_ids: ['objective'],
            day_start: null,
            day_end: null,
          },
        ],
      },
    ],
    assessment_policy: defaultPolicy(),
  };
}
describe('Teacher structural contracts', () => {
  it('normalizes new identities and preserves existing semantic identities without trusting foreign UUIDs', () => {
    const p = outline(planFixture());
    expect(p.sections[0].id).not.toBe('section');
    expect(p.sections[0].units[0].objective_ids).toEqual([
      p.sections[0].objectives[0].id,
    ]);
    const next = outline(p, outlineIds(p));
    expect(next).toEqual(p);
    const foreign = outline(p);
    expect(foreign.sections[0].id).not.toBe(p.sections[0].id);
  });
  it('rejects cycles and empty required sets, broken references and duplicated identities', () => {
    const p = planFixture();
    p.sections[0].required = false;
    expect(() => outline(p)).toThrow();
    const draft = outline(p, new Set(), false);
    expect(draft.sections.every((s) => !s.required)).toBe(true);
    expect(() => outline(draft, outlineIds(draft))).toThrow();
    const cyclic = planFixture();
    cyclic.sections[0].prerequisite_section_ids = ['section'];
    expect(() => outline(cyclic)).toThrow();
    const broken = planFixture();
    broken.sections[0].units[0].objective_ids = ['other'];
    expect(() => outline(broken)).toThrow();
    const duplicate = planFixture();
    duplicate.sections[0].units[0].id = 'objective';
    expect(() => outline(duplicate)).toThrow();
  });
  it('validates days without inventing a default and rejects additional properties', () => {
    const p = { ...planFixture(), organization: 'days', day_count: null };
    expect(() => outline(p)).toThrow();
    expect(() => outline({ ...planFixture(), owner_user_id: '1' })).toThrow();
    expect(() => answer({ kind: 'dont_know', points: 2 })).toThrow();
    expect(() =>
      guide({
        schema_version: 1,
        strategy: 'balanced',
        context_notes: '',
        examples_context: '',
        prerequisite_knowledge: [],
        preferred_formats: ['shell'],
      }),
    ).toThrow();
  });
  it('canonicalizes keys while preserving arrays, exact bigint/model and null/zero distinctions', () => {
    expect(hash({ b: 0, a: '9223372036854775807' })).toBe(
      hash({ a: '9223372036854775807', b: 0 }),
    );
    expect(hash([1, 2])).not.toBe(hash([2, 1]));
    expect(hash({ a: null })).not.toBe(hash({ a: 0 }));
    expect(canonical({ model: ' Some/Model ' })).toContain(' Some/Model ');
  });
  it('requires an exact dynamically supplied model and rejects oversized bytes', () => {
    expect(
      selection({
        connection_id: '9223372036854775807',
        mode: 'api_key',
        model_id: ' Any/Model ',
        effort_id: null,
      }).model_id,
    ).toBe(' Any/Model ');
    expect(() =>
      selection({
        connection_id: '9223372036854775808',
        mode: 'api_key',
        model_id: 'x',
        effort_id: null,
      }),
    ).toThrow();
    expect(() =>
      selection({
        connection_id: '1',
        mode: 'api_key',
        model_id: '',
        effort_id: null,
      }),
    ).toThrow();
    expect(() =>
      selection({
        connection_id: '1',
        mode: 'api_key',
        model_id: 'é'.repeat(600),
        effort_id: null,
      }),
    ).toThrow();
  });
  it('keeps semantic evidence across presentation changes, invalidates objective/policy changes', () => {
    const p = outline(planFixture()),
      s = p.sections[0].id;
    const renamed = structuredClone(p);
    renamed.title = 'New display';
    renamed.sections[0].title = 'New';
    expect(sectionHashes(renamed).get(s)).toBe(sectionHashes(p).get(s));
    renamed.sections[0].objectives[0].description = 'Different objective';
    expect(sectionHashes(renamed).get(s)).not.toBe(sectionHashes(p).get(s));
  });
  it('rejects malformed, oversized and deeply nested generated output', () => {
    expect(() => text('\uD800', 1, 240)).toThrow();
    expect(() => parseJsonOutput('```json\n{}\n```')).toThrow();
    expect(() =>
      parseJsonOutput('['.repeat(13) + '0' + ']'.repeat(13)),
    ).toThrow();
    expect(() => parseJsonOutput(JSON.stringify('x'.repeat(32769)))).toThrow();
  });
  it('builds complete final coverage with server points', () => {
    const objectives = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const p = defaultPolicy(7),
      b = blueprint(objectives, p.final_counts);
    expect(b).toHaveLength(14);
    for (const o of objectives)
      expect(b.filter((x) => x.objective_id === o)).toHaveLength(2);
    expect(
      b.every((x) => x.max_points === (x.kind === 'short_text' ? 6 : 2)),
    ).toBe(true);
  });
  it('rejects executable markup before material publication', () => {
    expect(() =>
      packet(
        {
          schema_version: 1,
          unit_id: 'u',
          plan_revision_id: 'p',
          blocks: [
            {
              id: 'b',
              kind: 'explanation',
              title: 'Unsafe',
              body_markdown: '<script>alert(1)</script>',
            },
          ],
          practice_assessment: {},
        },
        [],
        { unit_id: 'u', plan_revision_id: 'p', section_id: 's' },
      ),
    ).toThrow();
  });
});
describe('Teacher grading rules', () => {
  it('compares exact points: 90 passes, 89.6 fails, assistance never verifies', () => {
    const row = (points: number, max: number) => [
      { grade_state: 'graded', earned_points: points, max_points: max },
    ];
    expect(aggregateGrade('section_final', 40, row(36, 40), false).result).toBe(
      'passed',
    );
    expect(
      aggregateGrade('section_final', 1000, row(896, 1000), false).result,
    ).toBe('not_passed');
    expect(aggregateGrade('section_final', 40, row(40, 40), true).result).toBe(
      'not_independent',
    );
    expect(
      aggregateGrade('unit_practice', 40, row(36, 40), false).result,
    ).toBeNull();
  });
  it('pending/invalid correction never becomes zero or a final percentage', () => {
    expect(
      aggregateGrade(
        'section_final',
        40,
        [{ grade_state: 'needs_review', earned_points: null, max_points: 40 }],
        false,
      ),
    ).toMatchObject({
      result: 'pending',
      earned_points: null,
      percentage: null,
    });
    expect(() =>
      aggregateGrade(
        'section_final',
        40,
        [{ grade_state: 'graded', earned_points: 41, max_points: 40 }],
        false,
      ),
    ).toThrow();
    expect(() =>
      aggregateGrade(
        'section_final',
        40,
        [{ grade_state: 'graded', earned_points: 36, max_points: 39 }],
        false,
      ),
    ).toThrow();
  });
  it('normalizes completion only as declared, preserving accents/punctuation', () => {
    expect(normalizeCompletion('  cafe\u0301   DNS ', true)).toBe('café DNS');
    const key = {
      kind: 'completion' as const,
      alternatives: ['café DNS'],
      case_sensitive: true,
    };
    expect(
      deterministicGrade({ kind: 'completion', text: 'cafe DNS' }, key).points,
    ).toBe(0);
    expect(
      deterministicGrade({ kind: 'completion', text: 'cafe\u0301  DNS' }, key)
        .points,
    ).toBe(2);
    expect(
      deterministicGrade(
        { kind: 'completion', text: 'CAFÉ DNS' },
        { ...key, case_sensitive: false },
      ).points,
    ).toBe(2);
    expect(
      deterministicGrade(
        { kind: 'completion', text: 'café DNS' },
        { ...key, ambiguous: true },
      ),
    ).toEqual({ state: 'needs_review', points: null });
  });
  it('distinguishes explicit dont_know and an open response pending rubric evaluation', () => {
    const key = { kind: 'short_text' as const, criteria: [] };
    expect(deterministicGrade({ kind: 'dont_know' }, key)).toEqual({
      state: 'graded',
      points: 0,
    });
    expect(
      deterministicGrade({ kind: 'short_text', text: 'A DNS resolver' }, key),
    ).toEqual({ state: 'pending', points: null });
  });
  it('rejects forged feedback targets/criteria/points while uncertainty remains explicit', () => {
    const expected = [
      { response_id: 'r', criterion_ids: ['objective', 'accuracy', 'clarity'] },
    ];
    const value = {
      schema_version: 1,
      responses: [
        {
          response_id: 'r',
          criteria: expected[0].criterion_ids.map((criterion_id) => ({
            criterion_id,
            points: 2,
            comment: 'OK',
          })),
          uncertain: false,
          explanation: 'Correct',
        },
      ],
    };
    expect(validateWrittenFeedback(value, expected)[0].points).toBe(6);
    value.responses[0].criteria[0].points = 3;
    expect(() => validateWrittenFeedback(value, expected)).toThrow();
    value.responses[0].criteria[0].points = 2;
    value.responses[0].response_id = 'foreign';
    expect(() => validateWrittenFeedback(value, expected)).toThrow();
  });
});
