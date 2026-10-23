// Operator-only live session/catalog observation; no inference, login, or credential export.
import { CodexRuntimeService } from '/opt/nodia/releases/nodia-server-ai40-r01/dist/common/ai/codex/codex-runtime.service.js';
const subject=new CodexRuntimeService();
try {
 const seen=await subject.observe('1',AbortSignal.timeout(30000));
 console.log(JSON.stringify({stage:'AI40',status:'session_observed',session:{available:seen.available,authenticated:seen.authenticated,reason:seen.reason,checked_at:seen.checkedAt},models:seen.models?.map(m=>({id:m.id,efforts:m.supportedReasoningEfforts})),generations:0,credential_values_emitted:false}));
} catch(e){console.log(JSON.stringify({stage:'AI40',status:'observation_failed',error_class:e?.constructor?.name,code:typeof e?.code==='string'&&/^codex_[a-z_]+$/.test(e.code)?e.code:null,generations:0,raw_details_emitted:false}));process.exitCode=1;}
finally{await subject.onModuleDestroy();}
