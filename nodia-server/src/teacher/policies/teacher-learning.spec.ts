import { describe, expect, it } from 'vitest';
import {
  learningMetadata,
  recommendLearning,
  stableOptions,
} from './teacher-learning.js';
import type {
  LearningObservation,
  LearningObjective,
} from '../types/teacher-learning.types.js';

const objective: LearningObjective = {
  objective_id: 'objective',
  description: 'Apply a join',
  plan_revision_id: 'current',
  section_id: 'section',
  unit_ids: ['unit'],
};
const observation = (
  patch: Partial<LearningObservation> = {},
): LearningObservation => ({
  id: 'evidence',
  objective_id: 'objective',
  description: 'Apply a join',
  plan_revision_id: 'current',
  answer_state: 'graded',
  earned_points: 2,
  max_points: 2,
  assisted: false,
  independent: true,
  self_explanation: null,
  confidence: null,
  observed_at: '2026-11-11T00:00:00Z',
  attempt_id: 'attempt',
  response_id: 'response',
  ...patch,
});

describe('learning evidence policy', () => {
  it('keeps missing declarations distinct from explicit zero and rejects invalid confidence', () => {
    expect(learningMetadata(undefined, undefined)).toEqual({
      self_explanation: null,
      confidence: null,
    });
    expect(learningMetadata('', 0)).toEqual({
      self_explanation: '',
      confidence: 0,
    });
    for (const invalid of [-1, 101, 0.5, '50', NaN])
      expect(() => learningMetadata(null, invalid)).toThrow();
  });
  it('uses current objective evidence, never declared confidence or historical revisions as mastery', () => {
    expect(
      recommendLearning(
        [objective],
        [observation({ plan_revision_id: 'obsolete', confidence: 100 })],
      )[0].reason,
    ).toBe('insufficient_evidence');
    expect(
      recommendLearning(
        [objective],
        [observation({ earned_points: 0, confidence: 100 })],
      )[0],
    ).toMatchObject({ reason: 'reinforce', activity_mode: 'discrimination' });
    expect(
      recommendLearning(
        [objective],
        [observation({ assisted: true, independent: false })],
      )[0].reason,
    ).toBe('independent_check');
    expect(
      recommendLearning(
        [objective],
        [observation({ answer_state: 'pending', earned_points: null })],
      )[0].reason,
    ).toBe('insufficient_evidence');
  });
  it('selects an independent retrieval task without granting a section verification', () => {
    expect(recommendLearning([objective], [observation()])[0]).toEqual({
      objective_id: 'objective',
      reason: 'retrieval',
      evidence_ids: ['evidence'],
      unit_id: 'unit',
      activity_mode: 'recall',
    });
  });
  it('restores the same option order by occurrence and preserves semantic positional references', () => {
    const options = [
      { id: 'a', label: 'Left join' },
      { id: 'b', label: 'Inner join' },
      { id: 'c', label: 'Cross join' },
    ];
    expect(stableOptions(options, 'attempt:item')).toEqual(
      stableOptions(options, 'attempt:item'),
    );
    expect(
      new Set(stableOptions(options, 'attempt:item').map((o) => o.id)),
    ).toEqual(new Set(['a', 'b', 'c']));
    expect(
      stableOptions(
        options,
        'attempt:item',
        'Which follows the previous step?',
      ),
    ).toEqual(options);
    expect(
      stableOptions(options, 'attempt:item', 'Combine A) with the stated rule'),
    ).toEqual(options);
    const numeric = [
      { id: 'a', label: '1999' },
      { id: 'b', label: '2004' },
    ];
    expect(stableOptions(numeric, 'attempt:item')).toEqual(numeric);
  });
});
