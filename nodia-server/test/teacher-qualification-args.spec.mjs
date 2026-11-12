import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTeacherQualificationArgs } from '../scripts/teacher-qualification-args.mjs';
const id='10000000-0000-4000-8000-000000000001';
const base=[`--session-id=${id}`,'--user-id=1',`--auth-session-public-id=${id}`];
test('explicit helper qualification requires an anchor; completion reuses only original job',()=>{
  assert.equal(parseTeacherQualificationArgs(base).purpose,'setup_reply');
  assert.equal(parseTeacherQualificationArgs([...base,'--purpose=contextual_reply',`--thread-id=${id}`]).threadId,id);
  assert.equal(parseTeacherQualificationArgs([...base,'--purpose=contextual_reply',`--complete-job-id=${id}`]).originalJobId,id);
  for(const extra of [
    ['--purpose=contextual_reply'],['--purpose=unknown'],['--purpose=contextual_reply','--thread-id=bad'],
    ['--purpose=contextual_reply',`--thread-id=${id}`,`--complete-job-id=${id}`],
    [`--thread-id=${id}`],['--unknown=value'],['--user-id=2'],['--purpose'],['--complete-job-id='],
  ]) assert.throws(()=>parseTeacherQualificationArgs([...base,...extra]));
});
