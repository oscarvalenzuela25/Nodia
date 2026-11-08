import { describe, expect, it } from 'vitest';
import { reportTeacherPublicationFailure, teacherPublicationDiagnostic } from './teacher-publication-diagnostic.js';
import { assessment } from './teacher-validation.js';

describe('Teacher publication failure diagnostics', () => {
  it('identifies the real validator callsite without copying private input or its exception', () => {
    let failure: unknown;
    try { assessment({ private_key: 'SECRET_ANSWER' }, [], { scope: 'section_final', plan_revision_id: null, section_id: null, unit_id: null }); }
    catch (error) { failure = error; }
    const value = teacherPublicationDiagnostic(failure);
    expect(value.code).toBe('publication_failure_located');
    expect(value.component).toBe('teacher-validation');
    expect(value.line).toBeGreaterThan(0);
    expect(value.column).toBeGreaterThan(0);
    expect(Object.keys(value).sort()).toEqual(['code', 'column', 'component', 'frames', 'line']);
    expect(value.frames.length).toBeGreaterThan(1);
    expect(value.frames.length).toBeLessThanOrEqual(4);
    expect(JSON.stringify(value)).not.toMatch(/SECRET|private_key|teacher:|\.ts|\.js|stack/);
  });

  it('rejects custom or unrelated file paths and arbitrary secret messages', () => {
    const error = new Error('SECRET_CREDENTIAL');
    error.stack = 'SECRET_CREDENTIAL\n    at assessment (/custom/teacher/policies/teacher-validation.ts:510:7)\n    at query (/db/driver.js:123:4)';
    expect(teacherPublicationDiagnostic(error)).toEqual({ code: 'publication_failure_unclassified', component: null, line: null, column: null, frames: [] });
    expect(teacherPublicationDiagnostic({ stack: error.stack, message: 'SECRET' }).component).toBeNull();
  });

  it('locates owned publisher frames for an SQL failure without calling it a validation failure', () => {
    const error = new Error('SECRET SQL CREDENTIAL');
    const path = new URL('../use-case/publish-teacher.use-case.ts', import.meta.url).href;
    error.stack = `SECRET SQL CREDENTIAL\n    at query (/custom/database-driver.js:1:1)\n${Array.from({ length: 8 }, (_, i) => `    at publish (${path}:${100 + i}:7)`).join('\n')}`;
    const value = teacherPublicationDiagnostic(error);
    expect(value.code).toBe('publication_failure_located');
    expect(value.component).toBe('publish-teacher');
    expect(value.frames).toHaveLength(4);
    expect(value.frames.map((frame) => frame.line)).toEqual([100, 101, 102, 103]);
    expect(JSON.stringify(value)).not.toMatch(/SECRET|SQL|CREDENTIAL|custom|database|\.ts|file:/);
  });

  it('bounds malformed errors and never invokes message or body accessors', () => {
    const error = new Error();
    Object.defineProperty(error, 'stack', { get() { throw Error('SECRET'); } });
    expect(teacherPublicationDiagnostic(error).code).toBe('publication_failure_unclassified');
    const oversized = new Error(); oversized.stack = 'x'.repeat(32769);
    expect(teacherPublicationDiagnostic(oversized).component).toBeNull();
    for (const value of [null, undefined, 42, 'SECRET', new TypeError('SECRET')]) {
      expect(JSON.stringify(teacherPublicationDiagnostic(value))).not.toContain('SECRET');
    }
  });

  it('emits only the sanitized event and never lets a failing logger interrupt closure', () => {
    const context = { job_id: 'job-id', operation_id: 'operation-id', purpose: 'assessment_only' as const };
    const extended = { ...context, private_error: 'SECRET_CONTEXT' };
    const events: string[] = [];
    reportTeacherPublicationFailure(extended, new Error('SECRET_BODY'), (event) => { events.push(event); });
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0])).toEqual({ event: 'teacher_publication_rejected', ...context, failure: teacherPublicationDiagnostic(null) });
    expect(events[0]).not.toContain('SECRET');
    expect(() => reportTeacherPublicationFailure(context, new Error('SECRET_BODY'), () => { throw Error('SECRET_SINK'); })).not.toThrow();
  });
});
