// Additive production packet; production applies only after explicit root GO.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),server=path.join(root,'nodia-server');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'.tmp/ai33-runtime-baseline-manifest.json'),'utf8'));
assert.equal(Object.keys(baseline).length,909);
const stage=JSON.parse(fs.readFileSync(path.join(server,'.tmp/ai33-stage-manifest.json'),'utf8'));
for(const [relative,digest] of Object.entries(stage.files))assert.equal(hash(fs.readFileSync(path.join(server,relative))),digest,'SQL candidate drift '+relative);
const candidate={};
for(const relative of Object.keys(baseline).sort())candidate[relative]=stage.files[relative]??baseline[relative];
for(const relative of Object.keys(stage.files).filter(p=>p.startsWith('dist/')&&p.endsWith('.js')&&!p.endsWith('.fixture.js'))){
  if(!candidate[relative]){
    assert(relative.startsWith('dist/nodia-ai-preference/')||relative==='dist/migrations/1792900000000-CreateNodiaAiPreferences.js','Unexpected added runtime source '+relative);
    candidate[relative]=stage.files[relative];
  }
}
assert.equal(Object.keys(candidate).length,923);
const ts=require(path.join(server,'node_modules/typescript'));
let imports=0;
for(const relative of Object.keys(candidate).filter(p=>p.endsWith('.js')&&!/\.fixtures?\.js$/.test(p))){
  const sf=ts.createSourceFile(relative,fs.readFileSync(path.join(server,relative),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  function reference(text){if(!text.startsWith('.'))return;const target=path.posix.normalize(path.posix.join(path.posix.dirname(relative),text));assert(candidate[target],'Missing runtime relative import '+relative+' -> '+target);imports++;}
  function visit(node){
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteralLike(node.moduleSpecifier))reference(node.moduleSpecifier.text);
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments.length===1&&ts.isStringLiteralLike(node.arguments[0]))reference(node.arguments[0].text);
    ts.forEachChild(node,visit);
  }visit(sf);
}
const changed=Object.keys(baseline).filter(p=>candidate[p]!==baseline[p]).sort(),added=Object.keys(candidate).filter(p=>!baseline[p]).sort();
const localManifest='.tmp/ai33-runtime-candidate-manifest.json', localBase='.tmp/ai33-runtime-before-manifest.json';
fs.writeFileSync(path.join(server,localManifest),JSON.stringify(candidate,null,2)+'\n');
fs.writeFileSync(path.join(server,localBase),JSON.stringify(baseline,null,2)+'\n');
const files=[...changed,...added,localManifest,localBase];
const archive=path.join(root,'.tmp/ai33-runtime-packet.tar');
cp.execFileSync('tar',['-cf',archive,...files],{cwd:server,stdio:'pipe'});
const report={stage:'AI-33',scope:'additive_runtime_packet_preparation',status:'prepared_not_activated',compiled_files:923,previous_compiled_files:909,changed,added,relative_imports_verified:imports,sql_compiled_manifest_sha256:hash(fs.readFileSync(path.join(server,'.tmp/ai33-stage-manifest.json'))),candidate_manifest_sha256:hash(fs.readFileSync(path.join(server,localManifest))),packet_sha256:hash(fs.readFileSync(archive)),test_sha256:stage.files['test/nodia-ai-ai33.integration.mjs'],production_database_migrated:false,services_restarted:false,provider_generations:0,storage_operations:0};
fs.writeFileSync(path.join(root,'.tmp/ai33-runtime-packet.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
