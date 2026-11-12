import { describe, expect, it } from 'vitest';
import { hash } from '../teacher/policies/teacher-validation.js';
import { assertContextualQualificationJob, contextualQualificationReplyMatches } from './teacher-contextual-qualification-policy.js';
const jobId='10000000-0000-4000-8000-000000000001';
const threadId='10000000-0000-4000-8000-000000000002';
const nonce='10000000-0000-4000-8000-000000000003';
function fixture(selection='commit together',visible_context='Atomic writes commit together.') {
  const input={thread_id:threadId,visible_context,selection,
    anchor_hash:hash({block:visible_context,selection}),
    qualification_probe:{contract:'teacher-contextual-probe/1',purpose:'contextual_reply',nonce,teacher_policy_hash:'a'.repeat(64)}};
  return {purpose:'contextual_reply',input_snapshot:input,
    semantic_key:hash({jobId,nonce,purpose:'contextual_reply',threadId,anchorHash:input.anchor_hash})};
}
describe('original anchored operator probe',()=>{
  it('validates a real passage binding without promoting historical policy',()=>{
    expect(()=>assertContextualQualificationJob(fixture(),jobId)).not.toThrow();
    const old=fixture(); old.input_snapshot.qualification_probe.teacher_policy_hash='b'.repeat(64);
    expect(()=>assertContextualQualificationJob(old,jobId)).not.toThrow();
  });
  it.each(['thread_id','selection','anchor_hash','visible_context'] as const)('rejects substitution of %s',key=>{
    const job=fixture(); job.input_snapshot[key]='substituted';
    expect(()=>assertContextualQualificationJob(job,jobId)).toThrow('qualification_session_required');
  });
  it('rejects a different nonce, job identity or purpose',()=>{
    const job=fixture(); job.input_snapshot.qualification_probe.nonce=threadId;
    expect(()=>assertContextualQualificationJob(job,jobId)).toThrow();
    expect(()=>assertContextualQualificationJob(fixture(),threadId)).toThrow();
    expect(()=>assertContextualQualificationJob({...fixture(),purpose:'setup_reply'},jobId)).toThrow();
  });
  it('preserves the raw anchor binding even when publication removes boundary whitespace',()=>{
    const selected='commit together.\n\n';
    const job=fixture(selected,'Atomic writes commit together.\n\n');
    expect(()=>assertContextualQualificationJob(job,jobId)).not.toThrow();
    expect(contextualQualificationReplyMatches('commit together.',selected)).toBe(true);
    job.input_snapshot.selection=selected.trim();
    expect(()=>assertContextualQualificationJob(job,jobId)).toThrow('qualification_session_required');
  });
});

describe('contextual qualification published echo',()=>{
  it.each(['commit together','commit together\n\n',' \tcommit together\r\n'])(
    'compares against the publication boundary contract for %j',selection=>{
      expect(contextualQualificationReplyMatches('commit together',selection)).toBe(true);
    });
  it.each([
    ['commit together','commit  together\n\n'],
    ['commit\ntogether','commit together'],
    [' commit together','commit together'],
    ['commit together\n','commit together\n\n'],
    ['changed','commit together'],
    ['',' \t\n'],
    [null,'commit together'],
    ['commit together',null],
  ])('rejects altered, noncanonical or missing reply %j for selection %j',(reply,selection)=>{
    expect(contextualQualificationReplyMatches(reply,selection)).toBe(false);
  });
});
