import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTeacherUpgradeRealArgs as parse} from '../scripts/teacher-upgrade-real-args.mjs';
test('real QA cannot run without explicit opt-in or with a model/credential override',()=>{
  for(const args of [['--stage=init'],['--real-provider','--stage=init','--model=other'],['--real-provider=false','--stage=init'],['--real-provider','--stage=init','--real-provider']]) assert.throws(()=>parse(args));
});
test('case identity is complete and cannot silently apply to cleanup or export',()=>{
  assert.deepEqual(parse(['--real-provider','--stage=case','--topic=sql','--signal=none']),{'real-provider':true,stage:'case',topic:'sql',signal:'none'});
  for(const args of [['--stage=case'],['--stage=case','--topic=sql'],['--stage=cleanup','--topic=sql','--signal=error'],['--stage=export','--signal=success']]) assert.throws(()=>parse(['--real-provider',...args]));
});
test('campaign budget changes are bounded, explicit and unavailable to reconciliation',()=>{
  assert.equal(parse(['--real-provider','--stage=repair','--post-limit=20'])['post-limit'],'20');
  for(const args of [['--stage=grade','--post-limit=20'],['--stage=extra','--post-limit=999'],['--stage=restore','--post-limit=20']]) assert.throws(()=>parse(['--real-provider',...args]));
});
