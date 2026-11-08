"""Compile only five reviewed Stop sources on the immutable R07 source tree.

The existing knowledge, SDK boundary files and tests remain SHA-pinned. No npm
lifecycle, environment, profile, VM service or provider is involved.
"""
import argparse,hashlib,json,subprocess,tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
WORK=ROOT/'.tmp/ai40-r08-selective-r01'
SERVER=WORK/'server'
ARTIFACTS=ROOT/'ops/lab/artifacts'
BASE_SHA='1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476'
BASE_ARCHIVE='eae0a37ea013fd2ac2deb6d746fcd0abdda4deb4ac734a740e1f3d8491cb9758'
KNOWLEDGE='5c83848c6eb1a6ce77fa63ad9de38f4dea556f260b6a9646cfceaaf4850db994'
SOURCES=('src/nodia-ai-conversation/dto/cancel-nodia-ai-run.dto.ts','src/nodia-ai-conversation/use-case/cancel-nodia-ai-run.use-case.ts','src/nodia-ai-conversation/nodia-ai-run-control.controller.ts','src/nodia-ai-conversation/nodia-ai-conversation.module.ts','src/nodia-ai-runtime/nodia-ai-runtime.service.ts')
TEST='test/nodia-ai-run-cancellation.integration.mjs'
TEST_SHA='4681d71e0dbb399e751d9f32f6ee776a7237deb31eb72a1adc507c2b785898cf'
BOUNDARIES=('common/ai/codex/codex-chat-runtime','common/ai/codex/codex-chat-images','common/ai/codex/codex-chat-image-acceptance','common/ai/codex/codex-chat-acceptance','common/ai/codex/codex-chat-journal','common/ai/codex/codex-contract','common/ai/codex/codex-rpc','common/ai/codex/codex-runtime.service','common/ai/codex/codex-process-ownership','ai-provider/use-case/codex-chat-tool-channel.use-case','nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case')
def sha(b):return hashlib.sha256(b).hexdigest()
def require(value,code):
 if not value:raise ValueError(code)
def main(a):
 require(not(WORK/'frozen.json').exists(),'already_frozen_do_not_rebuild')
 old_bytes=(SERVER/'release-manifest.json').read_bytes();require(sha(old_bytes)==BASE_SHA,'base_manifest_changed');old=json.loads(old_bytes)
 baseline=json.loads((WORK/'baseline-compiler.json').read_bytes());require(baseline['compiler_exit']==0 and baseline['verified_dist']==2893 and not baseline['changed']and not baseline['unexpected_dist_outputs']and not baseline['missing_dist_outputs'],'baseline_not_reproduced')
 pins=json.loads(a.source_pins.read_bytes());require(type(pins)is dict and set(pins)==set(SOURCES),'source_patch_set_invalid')
 patch_root=a.patch_root.resolve();require(patch_root.is_relative_to(ROOT/'.tmp'),'patch_not_isolated')
 for name,pin in old['files'].items():require(sha((SERVER/name).read_bytes())==pin,'base_member_changed_before_patch')
 require(sum(name not in old['files']for name in SOURCES)==3,'new_source_count_changed')
 for name in SOURCES:
  source=patch_root/name;require(source.is_file()and source.resolve().is_relative_to(patch_root)and sha(source.read_bytes())==pins[name]and b'\r'not in source.read_bytes(),'reviewed_source_pin_mismatch')
  require(pins[name]!=old['files'].get(name),'source_delta_missing');target=SERVER/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(source.read_bytes())
 test=a.test_source.resolve();require(test.is_relative_to(ROOT/'nodia-server/test')and sha(test.read_bytes())==TEST_SHA and TEST not in old['files'],'reviewed_test_asset_changed');(SERVER/TEST).write_bytes(test.read_bytes())
 result=subprocess.run(['node',str(SERVER/'node_modules/typescript/bin/tsc'),'-p','tsconfig.build.json','--incremental','false'],cwd=SERVER,capture_output=True,check=False)
 (WORK/'selective-tsc-stdout.txt').write_bytes(result.stdout);(WORK/'selective-tsc-stderr.txt').write_bytes(result.stderr);require(result.returncode==0,'isolated_compile_failed')
 expected_names=set(old['files'])|set(SOURCES)|{TEST}
 allowed=set(SOURCES)|{TEST}
 for name in SOURCES:
  stem='dist/'+name.removeprefix('src/').removesuffix('.ts');outputs={stem+suffix for suffix in('.js','.js.map','.d.ts')};allowed|=outputs;expected_names|=outputs
 files={name:sha((SERVER/name).read_bytes())for name in sorted(expected_names)}
 delta=[{'path':name,'old_sha256':old['files'].get(name),'sha256':pin}for name,pin in files.items()if old['files'].get(name)!=pin]
 require({v['path']for v in delta}<=allowed and all(name in {v['path']for v in delta}for name in SOURCES),'delta_outside_reviewed_sources')
 actual={p.relative_to(SERVER).as_posix()for p in(SERVER/'dist').rglob('*')if p.is_file()};require(actual=={n for n in files if n.startswith('dist/')},'unexpected_compiled_member')
 require(not any('codex-chat-audio'in n for n in files),'unaccepted_audio_found')
 for boundary in BOUNDARIES:
  name='dist/'+boundary+'.js';require(files[name]==old['files'][name],'native_boundary_changed')
 for name in('dist/nodia-ai-runtime/config/runtime-policy.json','dist/nodia-ai/knowledge/manifest.json','dist/nodia-ai/knowledge/bundle.json'):
  if name in old['files']:require(files[name]==old['files'][name],'policy_or_knowledge_changed')
 published=json.loads((SERVER/'dist/nodia-ai/knowledge/manifest.json').read_bytes());references={v['path']for c in published['capability_contracts']for v in c['implementation_sources']}|{v['path']for d in published['documents']for v in d['source_hashes']};require(not references&{'nodia-server/'+n for n in SOURCES},'published_source_overlap')
 require(old['knowledge_release']==KNOWLEDGE,'knowledge_release_changed')
 new={**{k:v for k,v in old.items()if k!='files'},'files':files};manifest=json.dumps(new,sort_keys=True,indent=2).encode()+b'\n';(SERVER/'release-manifest.json').write_bytes(manifest)
 archive=ARTIFACTS/'ai40-server-r08.tar.gz';manifest_path=ARTIFACTS/'ai40-server-r08-manifest.json';require(not archive.exists()and not manifest_path.exists(),'successor_artifact_exists')
 with manifest_path.open('xb')as f:f.write(manifest)
 with tarfile.open(archive,'x:gz')as tar:
  for name in sorted(files):tar.add(SERVER/name,arcname=name,recursive=False)
  tar.add(SERVER/'release-manifest.json',arcname='release-manifest.json',recursive=False)
 plan={'release':'/opt/nodia/releases/nodia-server-ai40-r08','manifest_sha256':sha(manifest),'files':len(files),'dist_outputs':sum(n.startswith('dist/')for n in files),'knowledge_release':KNOWLEDGE,'codex_profile_root':'/var/lib/nodia/codex'}
 plan_path=WORK/'adopt-plan-r08.json';plan_path.write_text(json.dumps(plan,indent=2)+'\n',encoding='utf8',newline='\n')
 receipt={'schema':'nodia-ai-ai40-r08-selective-package-v1','status':'frozen_not_adopted','base_archive_sha256':BASE_ARCHIVE,'base_manifest_sha256':BASE_SHA,'manifest_sha256':sha(manifest),'archive_sha256':sha(archive.read_bytes()),'archive_bytes':archive.stat().st_size,'plan_sha256':sha(plan_path.read_bytes()),'source_pins':pins,'test_asset_sha256':TEST_SHA,'delta':delta,'files':len(files),'dist_outputs':plan['dist_outputs'],'production_TS_sources':sum(n.startswith('src/')and n.endswith('.ts')for n in files),'knowledge_release':KNOWLEDGE,'published_reference_overlap':0,'native_11_boundaries_policy_and_knowledge_unchanged':True,'compiler':{'exit':result.returncode,'stdout_bytes':len(result.stdout),'stderr_bytes':len(result.stderr),'baseline_dist_reproduced':2893,'config_pins':json.loads((WORK/'setup.json').read_bytes())['compiler_configs'],'dependency_lock_sha256':files['package-lock.json'],'node_modules_target':str((SERVER/'node_modules').resolve())},'unaccepted_audio_files_added':False,'provider_generations':0,'VM_mutations':0,'source':str(Path(__file__).relative_to(ROOT)),'source_sha256':sha(Path(__file__).read_bytes()),'isolated_PG_acceptance':'pending_not_inferred_from_compilation'}
 (WORK/'frozen.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8',newline='\n');print(json.dumps(receipt))
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--patch-root',type=Path,required=True);parser.add_argument('--source-pins',type=Path,required=True);parser.add_argument('--test-source',type=Path,required=True);main(parser.parse_args())
