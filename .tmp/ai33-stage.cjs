// Local artifact preparation only. Never includes .env or production node_modules.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),server=path.join(root,'nodia-server');
const walk=dir=>fs.readdirSync(path.join(server,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const compiled=walk('dist').sort();
const input=[...compiled,'package.json','package-lock.json','test/nodia-ai.integration.fixture.mjs','test/nodia-ai-ai33.integration.mjs'];
const files=Object.fromEntries(input.map(p=>[p,sha(fs.readFileSync(path.join(server,p)))]));
fs.mkdirSync(path.join(server,'.tmp'),{recursive:true});
const manifest={stage:'AI-33',scope:'isolated_compiled_sql_integration_candidate',compiled_files:compiled.length,configured_environment_included:false,files};
fs.writeFileSync(path.join(server,'.tmp/ai33-stage-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const archive=path.join(root,'.tmp/ai33-sql-stage.tar');
cp.execFileSync('tar',['-cf',archive,'dist','package.json','package-lock.json','test/nodia-ai.integration.fixture.mjs','test/nodia-ai-ai33.integration.mjs','.tmp/ai33-stage-manifest.json'],{cwd:server,stdio:'pipe'});
console.log(JSON.stringify({stage:'AI-33',compiled_files:compiled.length,manifest_sha256:sha(fs.readFileSync(path.join(server,'.tmp/ai33-stage-manifest.json'))),archive_sha256:sha(fs.readFileSync(archive)),archive_bytes:fs.statSync(archive).size,test_sha256:files['test/nodia-ai-ai33.integration.mjs']}));
