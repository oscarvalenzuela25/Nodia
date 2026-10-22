/** Local values enter only an encrypted child's stdin; never logs or arguments. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require=createRequire(path.resolve('nodia-server/package.json'));
const values=require('dotenv').parse(fs.readFileSync('nodia-server/.env'));
const required=['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME'];
const selected=Object.fromEntries(required.map(key=>[key,values[key]]));
if(Object.hasOwn(values,'R2_ENDPOINT'))selected.R2_ENDPOINT=values.R2_ENDPOINT;
if(required.some(key=>typeof selected[key]!=='string'||!selected[key].trim()))throw new Error('missing_local_r2_configuration');
const options=['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab',
 '-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts',
 '-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=8'];
const result=spawnSync('ssh',[...options,'operador@172.31.209.214',
 'sudo -n /usr/local/bin/node /tmp/ai32-r05-r2-configure.mjs'],
 {input:JSON.stringify(selected),encoding:'utf8',timeout:180000,maxBuffer:65536});
let report;try{report=JSON.parse(result.stdout);}catch{report={stage:'AI-32-R05',status:'failed',safe_error_category:'private_transfer_failed'};}
fs.writeFileSync('.tmp/ai32-r05-r2-configuration.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,configuration_modified:report.configuration_modified,
 gemini_container_identity_preserved:report.gemini_container_identity_preserved}));
process.exitCode=result.status===0&&report.status==='passed'?0:1;
