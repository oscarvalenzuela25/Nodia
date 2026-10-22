// Explicit source allowlist. No .env, profiles, sessions, dependencies or operational data enter the archive.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(repository,'nodia-server/.tmp/ai11-ai12-release');
fs.mkdirSync(output,{recursive:true});
const kind=process.argv[2];
if(!['microservice','server'].includes(kind))throw Error('Specify microservice or server');
const source=path.join(repository,kind==='microservice'?'nodia-gemini-microservice':'nodia-server');
const files=[];
const append=(directory,predicate)=>{
  for(const entry of fs.readdirSync(path.join(source,directory),{withFileTypes:true})){
    const relative=path.posix.join(directory,entry.name);
    if(entry.isSymbolicLink())throw Error('Symlinks are not release sources');
    if(entry.isDirectory())append(relative,predicate);
    else if(predicate(relative))files.push(relative);
  }
};
if(kind==='microservice'){
  for(const entry of fs.readdirSync(source,{withFileTypes:true}))
    if(entry.isFile()&&(entry.name.endsWith('.py')||['Dockerfile','requirements.txt','antigravity-cli.lock.json','.dockerignore'].includes(entry.name)))files.push(entry.name);
  append('scripts',file=>file.endsWith('.py'));
  append('experiments',file=>file.endsWith('.py'));
}else{
  // A standalone `nest build` deletes this postbuild asset. Reject a partial
  // build here instead of producing a release that cannot boot the registry.
  const sharedContract=fs.readFileSync(path.join(source,'dist/nodia-ai-tools/config/common-schema.json'));
  if(!sharedContract.equals(fs.readFileSync(path.join(repository,'docs/mvp/nodia-ai-v1-common-contracts.schema.json'))))
    throw Error('Missing or stale shared tool contract: run npm run build');
  append('dist',file=>/\.(?:js|json)$/.test(file)&&!file.endsWith('.fixture.js'));
  // Only compiler-referenced, content-addressed knowledge fragments enter a release.
  // Source Markdown, drafts, profiles and authoring documentation are never bundled.
  const knowledgeRoot='dist/nodia-ai/knowledge';
  const knowledge=JSON.parse(fs.readFileSync(path.join(source,knowledgeRoot,'manifest.json'),'utf8'));
  if(!Array.isArray(knowledge.fragments))throw Error('Invalid compiled knowledge manifest');
  for(const fragment of knowledge.fragments){
    if(!/^fragments\/[a-f0-9]{64}\.md$/.test(fragment.asset_path)||
      fragment.asset_path!==`fragments/${fragment.sha256}.md`)throw Error('Invalid knowledge fragment path');
    const relative=path.posix.join(knowledgeRoot,fragment.asset_path);
    const bytes=fs.readFileSync(path.join(source,relative));
    if(bytes.length!==fragment.byte_length||createHash('sha256').update(bytes).digest('hex')!==fragment.sha256)
      throw Error('Compiled knowledge fragment mismatch');
    files.push(relative);
  }
  for(const file of ['package.json','package-lock.json','test/nodia-ai.integration.fixture.mjs','test/nodia-ai-live.integration.mjs','test/nodia-ai-live-unknown.fixture.mjs','test/nodia-ai-live-concurrency.fixture.mjs','test/nodia-ai-live-worker.fixture.mjs',
    'test/nodia-ai-ai15-live.integration.mjs','test/nodia-ai-ai15-live-attest.mjs',
    'test/nodia-ai-ai15-codex-observation.fixture.mjs','test/nodia-ai-ai15-live-seeds.fixture.mjs',
    'test/nodia-ai-ai15-gemini-observation.fixture.mjs',
    'test/nodia-ai-ai15-quota-gateway.integration.mjs',
    'test/nodia-ai-ai15-domain-seeds.fixture.mjs',
    'test/nodia-ai-ai16-events.integration.mjs','test/nodia-ai-ai16-observation.integration.mjs',
    'test/nodia-ai-ai17.integration.mjs','test/nodia-ai-ai18.integration.mjs','test/nodia-ai-ai19.integration.mjs',
    'test/nodia-ai-ai20.integration.mjs','test/nodia-ai-ai20-worker.fixture.mjs',
    'test/nodia-ai-ai21.integration.mjs','test/nodia-ai-ai21-worker.fixture.mjs',
    'test/nodia-ai-ai22.integration.mjs','test/nodia-ai-ai22-worker.fixture.mjs',
    'test/nodia-ai-ai23.integration.mjs','test/nodia-ai-ai23-worker.fixture.mjs',
    'test/nodia-ai-ai24.integration.mjs','test/nodia-ai-ai24-worker.fixture.mjs',
    'test/nodia-ai-ai25.integration.mjs','test/nodia-ai-ai25-worker.fixture.mjs',
    'test/nodia-ai-ai26.integration.mjs','test/nodia-ai-ai26-worker.fixture.mjs',
    'test/nodia-ai-ai27.integration.mjs',
    'test/nodia-ai-ai27-worker.fixture.mjs',
    'test/nodia-ai-ai28.integration.mjs','test/nodia-ai-ai28-worker.fixture.mjs',
    'test/nodia-ai-ai29.integration.mjs','test/nodia-ai-ai29-worker.fixture.mjs',
    'test/nodia-ai-ai29-r01.integration.mjs','test/nodia-ai-ai29-r01-worker.fixture.mjs',
    'test/nodia-ai-ai30.integration.mjs','test/nodia-ai-ai30.fixture.mjs',
    'test/nodia-ai-ai31.integration.mjs',
    'test/nodia-ai-ai32-attachments.integration.mjs',
    'test/nodia-ai-ai32-invoice-attachments.integration.mjs',
    'test/nodia-ai-ai29-gemini-real.integration.mjs',
    'test/nodia-ai-ai08.integration.mjs','test/module-catalog.integration.mjs',
    'test/action-catalog.integration.mjs','test/role-catalog.integration.mjs',
    'test/ai-api.integration.mjs','test/agentic-cli.integration.mjs',
    'test/rental.integration.mjs',
    'test/codex-login-supervisor.integration.mjs','test/codex-http.integration.mjs',
    'test/provider-contacts.integration.mjs','test/invoice-access.integration.mjs','test/invoice-upload.integration.mjs',
    'test/nodia-ai-ai15-artifacts.integration.mjs',
    'test/finance.integration.mjs','test/fixtures/authority.integration.mjs',
    'test/nodia-ai-unpublished.fixture.mjs','scripts/nodia-ai-knowledge/contracts.schema.json',
    'scripts/observe-nodia-ai-lab-selection.mjs','scripts/reconcile-nodia-ai-runtime.mjs']){
    if(fs.existsSync(path.join(source,file)))files.push(file);
  }
}
files.sort();
if(files.some(file=>file.split('/').some(part=>part==='.env'||/^(?:browser_profile|session_state|agentic_profile|node_modules)$/.test(part))))throw Error('Operational data in release');
const manifest={kind,files:files.map(file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(path.join(source,file))).digest('hex')}))};
const list=path.join(output,`${kind}-files.txt`),archive=path.join(output,`${kind}.tar.gz`);
fs.writeFileSync(list,files.join('\n')+'\n');
fs.writeFileSync(path.join(output,`${kind}-manifest.json`),JSON.stringify(manifest,null,2));
execFileSync('tar',['-czf',archive,'-C',source,'-T',list],{stdio:'pipe'});
console.log(JSON.stringify({kind,files:files.length,archive,sha256:createHash('sha256').update(fs.readFileSync(archive)).digest('hex')}));
