import { describe, expect, it } from 'vitest';
import { teacherJobActions } from './teacher-job-actions.js';
import { validateCursorPhase } from './teacher-cursor.js';
describe('Teacher continuity authority', () => {
  it('does not offer a new unknown generation until closure, ACK and duplicate fence agree', () => {
    const job = {
      state: 'unknown',
      purpose: 'learning_packet',
      dispatches_used: 1,
      blocks_duplicate: true,
      deadline_at: new Date(10000),
      created_at: new Date(0),
    };
    expect(
      teacherJobActions(
        job,
        'active',
        { localClosed: true, acknowledged: false, proof: true },
        0,
      ).request_new_generation.enabled,
    ).toBe(false);
    expect(
      teacherJobActions(
        job,
        'active',
        { localClosed: true, acknowledged: true, proof: true },
        0,
      ).request_new_generation.enabled,
    ).toBe(false);
    expect(
      teacherJobActions(
        { ...job, blocks_duplicate: false },
        'active',
        { localClosed: true, acknowledged: true, proof: true },
        0,
      ).request_new_generation.enabled,
    ).toBe(true);
    expect(
      teacherJobActions(
        { ...job, blocks_duplicate: false, purpose: 'written_feedback' },
        'active',
        { localClosed: true, acknowledged: true, proof: true },
        0,
      ).request_new_generation.enabled,
    ).toBe(false);
  });
  it('does not offer continuation while paused/archived or after the original deadline', () => {
    const job = {
        state: 'blocked_paused',
        purpose: 'learning_packet',
        dispatches_used: 0,
        blocks_duplicate: true,
        deadline_at: new Date(10000),
        created_at: new Date(0),
      },
      closure = { localClosed: null, acknowledged: false, proof: false };
    expect(
      teacherJobActions(job, 'paused', closure, 0).continue_before_dispatch
        .enabled,
    ).toBe(false);
    expect(
      teacherJobActions(
        { ...job, deadline_at: new Date(600000) },
        'active',
        closure,
        300000,
      ).continue_before_dispatch.enabled,
    ).toBe(false);
    expect(
      teacherJobActions(job, 'archived', closure, 0).continue_before_dispatch
        .enabled,
    ).toBe(false);
    expect(
      teacherJobActions(job, 'active', closure, 0).continue_before_dispatch
        .enabled,
    ).toBe(true);
    expect(
      teacherJobActions(job, 'active', closure, 10000).continue_before_dispatch
        .enabled,
    ).toBe(false);
  });
  it('persists a diagnostic question without a fabricated unit but rejects a practice attempt as final', () => {
    const anchors = {
      unit: null,
      content: null,
      attempt: 'attempt',
      item: 'item',
      block: null,
      attemptScope: 'diagnostic',
    };
    expect(() => validateCursorPhase('practice', anchors)).not.toThrow();
    expect(() => validateCursorPhase('final', anchors)).toThrow();
    expect(() =>
      validateCursorPhase('final', {
        ...anchors,
        attemptScope: 'unit_practice',
        unit: 'unit',
      }),
    ).toThrow();
    expect(() =>
      validateCursorPhase('final', {
        ...anchors,
        attemptScope: 'section_final',
      }),
    ).not.toThrow();
    expect(() =>
      validateCursorPhase('practice', { ...anchors, attemptScope: null }),
    ).toThrow();
  });
});
