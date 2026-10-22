import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire('/opt/nodia/nodia-server/package.json');const env=require('dotenv').parse(fs.readFileSync('/opt/nodia/nodia-gemini-microservice/.env'));
const start=performance.now();try{
 const response=await fetch('http://127.0.0.1:8000/web/status',{headers:{'x-nodia-service-token':env.GEMINI_SERVICE_TOKEN},signal:AbortSignal.timeout(20000)});
 const data=await response.json();const codes=new Set(['web_session_busy','profile_busy','web_profile_busy','session_unavailable','service_unauthorized','service_auth_unconfigured']);
 console.log(JSON.stringify({http_status:response.status,elapsed_ms:Math.round(performance.now()-start),authenticated:typeof data.authenticated==='boolean'?data.authenticated:null,has_cookies:typeof data.has_cookies==='boolean'?data.has_cookies:null,has_browser_profile:typeof data.has_browser_profile==='boolean'?data.has_browser_profile:null,has_model:typeof data.model==='string'&&data.model.length>0,code:codes.has(data.code)?data.code:data.code?'other':null,generations:0}));
}catch(error){console.log(JSON.stringify({exception_type:new Set(['TimeoutError','AbortError','TypeError']).has(error.name)?error.name:'Other',elapsed_ms:Math.round(performance.now()-start),generations:0}));}
