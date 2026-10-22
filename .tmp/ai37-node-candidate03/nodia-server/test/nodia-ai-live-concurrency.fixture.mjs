// Live diagnostic only: caller must already hold the chosen physical profile with a chat turn.
// These requests must be rejected before login, OCR or discovery can touch that profile.
import assert from 'node:assert/strict';

const diagnosticActor='999999';
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1cAAAAASUVORK5CYII=','base64');

export function createLiveProfileChecks({privateUrl,privateConfig,modeSelection,check}){
  const base=new URL(privateUrl);
  assert.ok(['127.0.0.1','localhost','::1','[::1]'].includes(base.hostname),'Concurrency checks require the private loopback adapter');
  assert.match(privateConfig.GEMINI_SERVICE_TOKEN??'',/^[a-f0-9]{64}$/i);
  const checked=new Set();
  const headers={'X-Nodia-Service-Token':privateConfig.GEMINI_SERVICE_TOKEN,'X-Nodia-Actor-Id':diagnosticActor};
  async function request(route,init={}){
    let response;
    try{
      response=await fetch(new URL(route,base),{...init,headers:{...headers,...init.headers},redirect:'error',signal:AbortSignal.timeout(10000)});
    }catch{throw Error('Private concurrency diagnostic request could not complete');}
    const text=await response.text();
    assert.ok(Buffer.byteLength(text)<=32768,'Private concurrency diagnostic response exceeded its closed envelope');
    let body;
    try{body=JSON.parse(text);}catch{throw Error('Private concurrency diagnostic returned an invalid envelope');}
    return {status:response.status,body};
  }
  const busy=(label,response)=>{
    check(label,response.status===409&&response.body?.code==='runtime_busy');
  };
  return async function runLiveProfileChecks(engine,callback){
    assert.ok(engine==='web'||engine==='agentic','An explicit live engine is required');
    if(checked.has(engine))return false;
    checked.add(engine);
    const selection=modeSelection(engine==='web'?'token_plan_web':'token_plan_agentic');
    assert.ok(typeof selection.model_id==='string'&&selection.model_id.trim(),'Concurrency diagnostic requires the actual configured model');
    const loginPrefix=engine==='agentic'?'/agentic/auth/login':'/auth/login';
    // Fail before any mutating probe if discovery does not see the expected existing chat reservation.
    busy(`${engine} discovery cannot enter a profile held by the live chat`,await request(`/${engine}/models`));
    if(engine==='agentic'){
      const existing=await request(`${loginPrefix}/current`);
      assert.ok(existing.status===200&&existing.body===null,'Diagnostic actor already owns an active login; preserve it');
    }
    const login=await request(`${loginPrefix}/start`,{method:'POST'});
    if(login.status===200){
      // Web start always creates a fresh job; Agentic was explicitly checked to have none for this actor.
      const jobId=login.body?.id;
      if(typeof jobId==='string'&&/^[a-f0-9]{32}$/.test(jobId)){
        const cancelled=await request(`${loginPrefix}/${jobId}/cancel`,{method:'POST'});
        assert.ok(cancelled.status===200&&cancelled.body?.id===jobId&&cancelled.body?.state==='cancelled',
          'Unexpected diagnostic login could not be confirmed cancelled; operator intervention is required');
      }else{
        throw Error('Profile exclusion failed and the unexpected diagnostic login identity was invalid');
      }
      throw Error('Profile exclusion failed: a diagnostic login unexpectedly started; only its new job was cancelled');
    }
    busy(`${engine} login cannot enter a profile held by the live chat`,login);
    const form=new FormData();
    form.set('model',selection.model_id);
    form.set('file',new Blob([pixel],{type:'image/png'}),'synthetic-one-pixel.png');
    busy(`${engine} OCR cannot enter a profile held by the live chat`,await request(`/${engine}/analyze-invoice`,{method:'POST',body:form}));
    if(engine==='agentic'){
      const web=modeSelection('token_plan_web');
      const observed=await request('/nodia-ai/web/observe',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model_id:web.model_id,effort_id:web.effort_id})});
      check('independent Web profile remains available while Agentic holds its profile',observed.status===200&&observed.body?.available===true);
    }
    if(callback)await callback(engine);
    return true;
  };
}
