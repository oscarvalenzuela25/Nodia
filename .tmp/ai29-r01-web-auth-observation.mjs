import fs from 'node:fs';
import {createRequire} from 'node:module';
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016';
const require=createRequire(runtime+'/package.json');
const cfg=require('dotenv').parse(fs.readFileSync(runtime+'/.env'));
const url=new URL(cfg.GEMINI_MICROSERVICE_URL);
if (!['localhost','127.0.0.1'].includes(url.hostname)) throw Error('private_loopback_only');
try {
 const response=await fetch(new URL('/auth/status',url),{headers:{'X-Nodia-Service-Token':cfg.GEMINI_SERVICE_TOKEN},signal:AbortSignal.timeout(45000)});
 const body=await response.json();
 console.log(JSON.stringify({observation:'private_web_authentication_only',http_status:response.status,authenticated:typeof body.authenticated==='boolean'?body.authenticated:null,has_cookies:typeof body.has_cookies==='boolean'?body.has_cookies:null,has_browser_profile:typeof body.has_browser_profile==='boolean'?body.has_browser_profile:null,error_code:typeof body.code==='string'&&/^[a-z_]{1,80}$/.test(body.code)?body.code:null,provider_payload_omitted:true}));
} catch {console.log(JSON.stringify({observation:'private_web_authentication_only',outcome:'transport_unavailable_or_timeout',provider_payload_omitted:true}));process.exitCode=1;}
