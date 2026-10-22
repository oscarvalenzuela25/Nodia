// Narrow AI-32-R02 source-provenance reconciliation. No routes, grants or historical facts change.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');process.chdir(root);
const inventoryPath='docs/mvp/nodia-ai-current-endpoints.json';
const deltaPath='docs/evidence/nodia-ai-ai32-r02-catalog-delta.json';
const beforeInventorySha='f691bdfd35be0c89d83ac333a636f854713c9c2e05065107304d35582834335e';
const changes=[
  {
    "file": "nodia-server/src/nodia-ai-adapter/types/nodia-ai-adapter.types.ts",
    "before_sha256": "093c1e766dd16fdfb357f62b1d721f994efb9247912cb92537279ddbc4be4539",
    "after_sha256": "61ecd20e06f92d3e5fcde43a43e375d5dc4ababca75074312bb1650d977bb7ae"
  },
  {
    "file": "nodia-server/src/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.ts",
    "before_sha256": "03a35791afd48230fb232b1c32b4c09f8ebd568bf1b25ee97623331d9b7a1cf5",
    "after_sha256": "57f9b9dd8d8cc7391d00ea5ca22cb595b9006569b41d49d2e8f170a1f3ff4f67"
  },
  {
    "file": "nodia-server/src/nodia-ai-attachment/config/attachment-contract.schema.json",
    "before_sha256": "1c850d242301b3363dbe77227d15cf1f7ab577bd8a126fb981615f77894c5f1d",
    "after_sha256": "b2ee60317b9384d1ec5d478a394bc215a04f2369185f633313f722e53d203a48"
  },
  {
    "file": "nodia-server/src/nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case.ts",
    "before_sha256": "1b1d801952e8835b917d5b68ffbd74c5dea536d46bc02e276d9aa852bc610897",
    "after_sha256": "1856b3bdff7969dcf2d83aa923976e6948da985e2f7805136e4c3400951c8637"
  },
  {
    "file": "nodia-server/src/nodia-ai-attachment/use-case/observe-nodia-ai-attachment-capabilities.use-case.ts",
    "before_sha256": "6b940923a9e4e51335fd1239976c49b770f7d8b09d1fef70a538faa82b5cbbf2",
    "after_sha256": "8dcd0ba73b66a1d2c620ec73ab056c6c36025b26ad774756c56353be4854527f"
  },
  {
    "file": "nodia-server/src/nodia-ai-context/use-case/prepare-nodia-ai-admission.use-case.ts",
    "before_sha256": "3a532b62bd36250edf8c8007d7e641855b5ab971b0476af9b6990dfbed927b95",
    "after_sha256": "7858e94f74262311bc9a876c93fec389e3de22a7717e0a904f765f76ce5b0337"
  },
  {
    "file": "nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts",
    "before_sha256": "b7d58bb99133e1a534d2bd48cc5937c94ab05750693546273d193fd2fe900b7f",
    "after_sha256": "8f7581f333aa07b7d2248f32ae09753d892f99d64fdaddf4b9296490297fc55d"
  },
  {
    "file": "nodia-server/src/nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case.ts",
    "before_sha256": "44791d986c2f7b80a84aae6773eb1438013d31c62c43cf2961ac252ef2d952f4",
    "after_sha256": "d774e5ab2e273f9113457076d323305ebd49d67a6eb96788a08d2ee43487113d"
  },
  {
    "file": "nodia-server/src/nodia-ai-invoice-attachment/types/invoice-attachment-stage.ts",
    "before_sha256": "e423023774a943ff9f33d6ad3ea863520e100de295504cbc786f084493a1ea3a",
    "after_sha256": "4b8795dfb8f5190671163afeceb2d486e44944ff6e4be191ce17dd45c1389dea"
  },
  {
    "file": "nodia-server/src/nodia-ai-invoice-attachment/use-case/stage-nodia-ai-invoice-attachment.use-case.ts",
    "before_sha256": "86fc0fab74dec0d2cb64d5a15dd6e2deaee16015822bf432aa5f3e963cad021d",
    "after_sha256": "f1fc9fea2d6efe5b0f657a15170c4236e0a22d7a45da0ad3bcbc52fa79cd54eb"
  },
  {
    "file": "nodia-server/src/nodia-ai-invoice-operations/use-case/build-nodia-ai-invoice-operations.use-case.ts",
    "before_sha256": "5ce34e30c9ecb8a4b8bf9bcb6715cf4f1af7fa8aa09366a710738072f9e09c32",
    "after_sha256": "0419529a1f6bec5d66dd8c155712f70dc35094861093fdd16cab9af49463f0e9"
  }
];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const bytes=value=>JSON.stringify(value,null,2)+'\n';
function readInventory(){return JSON.parse(fs.readFileSync(inventoryPath,'utf8'));}
function reconstruct(inventory,direction){
 const copy=structuredClone(inventory);
 assert.equal(copy.sourceChecksums.length,825);
 assert.equal(copy.sourceChecksums.filter(v=>v.file.endsWith('.spec.ts')).length,0,'Inventory tracks production, not unit-test files');
 assert.equal(new Set(copy.sourceChecksums.map(v=>v.file)).size,825);
 for(const change of changes){
  const source=copy.sourceChecksums.find(v=>v.file===change.file);assert(source,'Missing tracked source '+change.file);
  assert.equal(source.sha256,direction==='after'?change.before_sha256:change.after_sha256,'Unexpected inventory source hash '+change.file);
  source.sha256=direction==='after'?change.after_sha256:change.before_sha256;
 }
 return copy;
}
function expectedDelta(after){
 const before=reconstruct(after,'before');
 assert.equal(hash(bytes(before)),beforeInventorySha,'Inventory changed outside eleven reviewed source hashes');
 assert.deepEqual(before.counts,after.counts);
 return {schema_version:1,stage:'AI-32-R02',scope:'Exact production source hashes for MIME evidence admission and independently staged legacy invoice transfer; no endpoint additions',
  before_inventory_sha256:beforeInventorySha,after_inventory_sha256:hash(bytes(after)),
  source_hash_changes:changes,source_hash_count:825,unit_test_files_in_inventory:0,
  unchanged_counts:after.counts,controllers_unchanged:true,handlers_unchanged:true,routes_unchanged:true,modules_unchanged:true,
  historical_stage_facts_unchanged:true,source_paths_unchanged:true,catalog_names_unchanged:true,
  database_migrations_added:0,approved_document_changes:false,
  limitations:['Only structural provenance is reconciled; actual MIME acceptance and legacy effects require their separate runtime/SQL evidence','Current catalog validator is unchanged and still verifies every source hash, compiled schema and AST route']};
}
function verifySources(inventory){
 for(const source of inventory.sourceChecksums)assert.equal(hash(fs.readFileSync(source.file)),source.sha256,'Source drift '+source.file);
 for(const change of changes)assert.equal(hash(fs.readFileSync(change.file)),change.after_sha256,'Reviewed R02 source drift '+change.file);
}
const mode=process.argv[2]??'--check';assert(['--check','--write'].includes(mode),'Use --check or --write');
let inventory=readInventory();
if(mode==='--write'){
 const original=fs.readFileSync(inventoryPath);
 if(hash(original)===beforeInventorySha){inventory=reconstruct(inventory,'after');expectedDelta(inventory);verifySources(inventory);fs.writeFileSync(inventoryPath,bytes(inventory));}
 else {assert.equal(hash(bytes(reconstruct(inventory,'before'))),beforeInventorySha,'Unexpected current inventory');verifySources(inventory);}
 fs.writeFileSync(deltaPath,bytes(expectedDelta(inventory)));
}
const expected=expectedDelta(inventory);verifySources(inventory);
assert.deepEqual(JSON.parse(fs.readFileSync(deltaPath,'utf8')),expected,'R02 catalog delta drift');
assert.equal(hash(fs.readFileSync(inventoryPath)),expected.after_inventory_sha256,'Current inventory byte drift');
console.log(JSON.stringify({stage:'AI-32-R02',mode,status:'passed',source_hashes:825,changed_source_hashes:changes.length,unchanged_counts:inventory.counts,before_inventory_sha256:beforeInventorySha,after_inventory_sha256:expected.after_inventory_sha256}));
