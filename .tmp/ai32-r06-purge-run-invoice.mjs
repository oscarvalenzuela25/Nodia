/** VM coordinator: private descriptor/environment into frozen invoice harness; safe output only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const expected=process.argv[2];assert.ok(/^[a-f0-9]{64}$/.test(expected));
const privateInput=readFileSync(0,'utf8'),descriptor=JSON.parse(privateInput);
assert.equal(descriptor.stage,'AI-32-R06');assert.equal(descriptor.purpose,'invoice');
const script='/tmp/ai32-r06-invoice-real.mjs';
assert.equal(createHash('sha256').update(await fs.readFile(script)).digest('hex'),expected);
const require=createRequire(descriptor.server_root+'/package.json');
const values=require('dotenv').parse(await fs.readFile(descriptor.runtime_source_root+'/.env'));
const environment={PATH:process.env.PATH,LANG:'C.UTF-8',DOTENV_CONFIG_PATH:'/dev/null',NODE_ENV:'test',RATE_LIMIT_STORAGE:'memory',AWS_EC2_METADATA_DISABLED:'true'};
for(const key of ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','R2_ENDPOINT','GEMINI_MICROSERVICE_URL','GEMINI_SERVICE_TOKEN'])environment[key]=values[key]??'';
const privateDirectory=descriptor.ledger_path.substring(0,descriptor.ledger_path.lastIndexOf('/'));
const stdoutPath=privateDirectory+'/invoice-stdout.log',stderrPath=privateDirectory+'/invoice-stderr.log';
const stdout=await fs.open(stdoutPath,'wx',0o600),stderr=await fs.open(stderrPath,'wx',0o600);
let exitCode;
try{
 const child=spawn('/usr/local/bin/node',[script],{env:environment,stdio:['pipe',stdout.fd,stderr.fd]});
 child.stdin.end(privateInput);
 exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code));});
}finally{await stdout.close();await stderr.close();}
const raw=await fs.readFile(stdoutPath,'utf8');
let report;
try{report=JSON.parse(raw);}catch{report={stage:'AI-32-R06',scope:'invoice_harness_coordinator',status:'failed',safe_failure_phase:'safe_report_unavailable',private_output_retained:true};}
report.coordinator={harness_sha256:expected,exit_code:exitCode,descriptor_stdin:true,private_stdout_stderr_mode:'0600',operational_postgres_env_passed:false};
console.log(JSON.stringify(report,null,2));
if(exitCode!==0)process.exitCode=1;
