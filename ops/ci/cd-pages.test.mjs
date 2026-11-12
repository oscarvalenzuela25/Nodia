import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assetTools, deploymentMarker, publishPages, readPages, staticAssets } from './cd-pages.mjs';
import { publicConfiguration } from './artifact-release.mjs';
const environment={GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/master',GITHUB_RUN_ATTEMPT:'1',
  CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_PAGES_PROJECT_NAME:'nodia',CLOUDFLARE_API_TOKEN:'synthetic-only',
  VITE_API_URL:'https://166.0.112.187/api/v1',VITE_GOOGLE_CLIENT_ID:'fixture.apps.googleusercontent.com'};
const metadata={source_sha:'b'.repeat(40),package_tree_sha256:'c'.repeat(64),ci:{run_id:'12',run_attempt:'1'},
  ...publicConfiguration(environment,{event:'push',ref:'refs/heads/master'}),production_eligible:true};
const id='11111111-2222-3333-4444-555555555555';
const deployment=(desired=false,status='success')=>({id,environment:'production',deployment_trigger:{metadata:{branch:'master',
  commit_hash:desired?metadata.source_sha:'d'.repeat(40),commit_message:desired?deploymentMarker(metadata):'historical'}},latest_stage:{name:'deploy',status}});
const project=canonical=>({name:'nodia',subdomain:'nodia-1ge.pages.dev',production_branch:'master',
  source:{type:'github',config:{production_branch:'master',production_deployments_enabled:false,preview_deployment_setting:'none'}},canonical_deployment:canonical});
const response=value=>Response.json({success:true,errors:[],result:value});
const fixture=t=>{const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'nodia-pages-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.writeFileSync(path.join(dir,'index.html'),'fixture');return dir;};
test('static upload hashes use BLAKE3 of base64 bytes and extension; executable Pages inputs are excluded',async t=>{
  const tools=await assetTools();assert.equal(tools.hash(Buffer.alloc(0),'file'), 'af1349b9f5f9a1a6a0404dea36dcc949');
  const dir=fixture(t);const assets=await staticAssets(dir,tools);assert.equal(Object.keys(assets.manifest)[0],'/index.html');
  for(const name of ['_worker.js','_routes.json','wrangler.toml','functions/hello.js']){
    const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'fixture');
    await assert.rejects(staticAssets(dir,tools),/functions_or_config/);fs.rmSync(file);}
});
test('canonical source must agree with its release marker and configuration drift is explicit',async()=>{
  const current=deployment(true);const baseline=await readPages(environment,{request:async()=>response(project(current))});
  assert.equal(baseline.config_changed,false);
  current.deployment_trigger.metadata.commit_hash='d'.repeat(40);
  await assert.rejects(readPages(environment,{request:async()=>response(project(current))}),/marker_source_mismatch/);
});
test('a static deployment sends only approved multipart fields and creates exactly once after uploads',async t=>{
  const dir=fixture(t), calls=[];let canonical=deployment(false);
  const request=async(url,options)=>{
    const resource=url.split('/client/v4')[1];calls.push([resource,options]);
    if(resource.endsWith('/projects/nodia'))return response(project(canonical));
    if(resource.includes('/deployments?'))return response([]);
    if(resource.endsWith('/upload-token'))return response({jwt:'synthetic-upload-only'});
    if(resource.endsWith('/check-missing'))return response(JSON.parse(options.body).hashes);
    if(resource.endsWith('/upload')||resource.endsWith('/upsert-hashes'))return response(null);
    if(resource.endsWith('/deployments')){
      assert.ok(options.body instanceof FormData);assert.deepEqual([...options.body.keys()].sort(),['branch','commit_dirty','commit_hash','commit_message','manifest']);
      assert.equal(options.body.get('branch'),'master');canonical=deployment(true);return response(canonical);}
    throw Error('unexpected synthetic request');
  };
  let gates=0;const result=await publishPages({environment,metadata,directory:dir,allowCreate:true,request,revalidate:async()=>{gates++;}});
  assert.equal(result.status,'complete');assert.equal(gates,2);
  assert.equal(calls.filter(([url,options])=>url.endsWith('/deployments')&&options.method==='POST').length,1);
  assert.ok(calls.every(([,options])=>options.redirect==='error'));
});
test('a lost create response has one attempt and no automatic replay; prior origin or pending marker cannot create',async t=>{
  const dir=fixture(t);let creates=0;
  const request=async(url,options)=>{
    if(url.endsWith('/projects/nodia'))return response(project(deployment(false)));
    if(url.includes('/deployments?'))return response([]);
    if(url.endsWith('/upload-token'))return response({jwt:'fixture'});
    if(url.endsWith('/check-missing'))return response([]);
    if(url.endsWith('/upsert-hashes'))return response(null);
    if(url.endsWith('/deployments')){creates++;throw Error('synthetic lost reply');}
    throw Error('unexpected request');
  };
  await assert.rejects(publishPages({environment,metadata,directory:dir,allowCreate:true,request}),/write_outcome_unknown/);assert.equal(creates,1);
  await assert.rejects(publishPages({environment,metadata,directory:dir,allowCreate:false,request}),/prior_cd_pages/);assert.equal(creates,1);
  await assert.rejects(publishPages({environment,metadata,directory:dir,allowCreate:false,request:async url=>response(url.includes('/deployments?')?[deployment(true,'active')]:project(deployment(false)))}),/existing_pages_deployment_requires_reconciliation/);
});
test('an exact successful marker can only verify without writing or requiring assets',async()=>{
  let calls=0;const result=await publishPages({environment,metadata,allowCreate:false,request:async(_,options)=>{calls++;assert.equal(options.method,'GET');return response(project(deployment(true)));}});
  assert.equal(result.status,'already_current');assert.equal(calls,1);
});
