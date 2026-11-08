"""Build exactly four reviewed source deltas on the SHA-pinned R05 tree.

No npm lifecycle, knowledge regeneration, current source-tree build, VM access,
account request, secret/profile copy or dependency installation is performed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / '.tmp/ai40-r06-selective-r01'
SERVER = WORK / 'server'
ARTIFACTS = ROOT / 'ops/lab/artifacts'
BASE_SHA = '07b83a30d4721dba1d1ca34d0b083868b5a8b64369d8ac853d389434f73a76cd'
KNOWLEDGE = '5c83848c6eb1a6ce77fa63ad9de38f4dea556f260b6a9646cfceaaf4850db994'
SOURCES = ('src/common/ai/codex/codex-chat-runtime.ts',
           'src/nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.ts',
           'src/nodia-ai-context/use-case/build-nodia-ai-compaction.use-case.ts',
           'src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts')

def sha(value):
    return hashlib.sha256(value).hexdigest()

def require(value, code):
    if not value:
        raise ValueError(code)

def main(a):
    require(not (WORK/'frozen.json').exists(), 'already_frozen_do_not_rebuild')
    old_bytes = (SERVER/'release-manifest.json').read_bytes()
    require(sha(old_bytes) == BASE_SHA, 'base_manifest_changed')
    old = json.loads(old_bytes)
    baseline = json.loads((WORK/'baseline-compiler.json').read_bytes())
    require(baseline['compiler_exit']==0 and not baseline['changed'] and not baseline['unexpected_dist_outputs'], 'baseline_not_reproduced')
    pins = json.loads(a.source_pins.read_bytes())
    require(type(pins) is dict and set(pins)==set(SOURCES), 'source_patch_set_invalid')
    patch_root = a.patch_root.resolve()
    require(patch_root.is_relative_to(ROOT/'.tmp'), 'patch_root_not_isolated')
    for name,pin in old['files'].items():
        require(sha((SERVER/name).read_bytes())==pin, 'base_member_changed_before_patch')
    for name in SOURCES:
        source=patch_root/name
        require(source.is_file() and source.resolve().is_relative_to(patch_root) and sha(source.read_bytes())==pins[name], 'reviewed_source_pin_mismatch')
        require(b'\r\n' not in source.read_bytes(), 'patch_requires_LF')
        require(pins[name] != old['files'][name], 'source_delta_missing')
        (SERVER/name).write_bytes(source.read_bytes())
    require(not any('codex-chat-audio' in name for name in old['files']), 'baseline_audio_not_expected')
    require(b'probeAudio' not in (SERVER/SOURCES[1]).read_bytes() and b'localAudio' not in (SERVER/SOURCES[0]).read_bytes(), 'unaccepted_audio_delta_detected')
    result=subprocess.run(['node',str(SERVER/'node_modules/typescript/bin/tsc'),'-p','tsconfig.build.json','--incremental','false'],cwd=SERVER,capture_output=True,check=False)
    (WORK/'selective-tsc-stdout.txt').write_bytes(result.stdout)
    (WORK/'selective-tsc-stderr.txt').write_bytes(result.stderr)
    require(result.returncode==0, 'isolated_compile_failed')
    files={name:sha((SERVER/name).read_bytes()) for name in old['files']}
    allowed=set(SOURCES)
    for source in SOURCES:
        stem='dist/'+source.removeprefix('src/').removesuffix('.ts')
        allowed.update(stem+suffix for suffix in ('.js','.js.map','.d.ts'))
    delta=[{'path':name,'old_sha256':old['files'][name],'sha256':pin} for name,pin in files.items() if old['files'][name]!=pin]
    require(set(x['path'] for x in delta)<=allowed, 'compiled_delta_outside_reviewed_sources')
    require(all(name in {x['path'] for x in delta} for name in SOURCES), 'reviewed_delta_not_emitted')
    actual={p.relative_to(SERVER).as_posix() for p in (SERVER/'dist').rglob('*') if p.is_file()}
    require(actual=={name for name in files if name.startswith('dist/')}, 'unexpected_compiled_member')
    require(files['dist/nodia-ai/knowledge/manifest.json']==old['files']['dist/nodia-ai/knowledge/manifest.json'] and old['knowledge_release']==KNOWLEDGE, 'knowledge_regenerated')
    published=json.loads((SERVER/'dist/nodia-ai/knowledge/manifest.json').read_bytes())
    references={r['path'] for c in published['capability_contracts'] for r in c['implementation_sources']}|{r['path'] for d in published['documents'] for r in d['source_hashes']}
    require(not references & {'nodia-server/'+name for name in SOURCES}, 'published_source_hash_would_be_stale')
    new={**{k:v for k,v in old.items() if k!='files'},'files':files}
    manifest=json.dumps(new,sort_keys=True,indent=2).encode()+b'\n'
    (SERVER/'release-manifest.json').write_bytes(manifest)
    manifest_path=ARTIFACTS/'ai40-server-r06-manifest.json'
    archive=ARTIFACTS/'ai40-server-r06.tar.gz'
    require(not archive.exists() and not manifest_path.exists(), 'successor_artifact_exists')
    with manifest_path.open('xb') as f:f.write(manifest)
    with tarfile.open(archive,'x:gz') as tar:
        for name in sorted(files):tar.add(SERVER/name,arcname=name,recursive=False)
        tar.add(SERVER/'release-manifest.json',arcname='release-manifest.json',recursive=False)
    plan={'release':'/opt/nodia/releases/nodia-server-ai40-r06','manifest_sha256':sha(manifest),'files':len(files),'dist_outputs':sum(name.startswith('dist/') for name in files),'knowledge_release':KNOWLEDGE,'codex_profile_root':'/var/lib/nodia/codex'}
    plan_path=ROOT/'docs/evidence/nodia-ai-ai40-adopt-plan-r06.json'
    with plan_path.open('x',encoding='utf-8',newline='\n') as f:f.write(json.dumps(plan,indent=2)+'\n')
    receipt={'schema':'nodia-ai-ai40-r06-selective-package-v1','status':'frozen_not_adopted','base_archive_sha256':'5913cc1b5957ab53fa10a91a95c7da8d8187ae86e0fb4f1db7c794f2b8b6023e','base_manifest_sha256':BASE_SHA,'manifest_sha256':sha(manifest),'archive_sha256':sha(archive.read_bytes()),'archive_bytes':archive.stat().st_size,'plan_sha256':sha(plan_path.read_bytes()),'source_pins':pins,'delta':delta,'unchanged_files':len(files)-len(delta),'files':len(files),'dist_outputs':plan['dist_outputs'],'production_TS_sources':sum(n.startswith('src/') and n.endswith('.ts') for n in files),'knowledge_release':KNOWLEDGE,'published_reference_overlap':0,'knowledge_assets_regenerated':False,'compiler':{'exit':result.returncode,'stdout_bytes':len(result.stdout),'stderr_bytes':len(result.stderr),'baseline_dist_reproduced':2893,'config_pins':json.loads((WORK/'setup.json').read_bytes())['compiler_configs'],'dependency_lock_sha256':files['package-lock.json'],'node_modules_target':str((SERVER/'node_modules').resolve())},'unaccepted_audio_files_added':False,'provider_generations':0,'VM_mutations':0,'source':str(Path(__file__).relative_to(ROOT)),'source_sha256':sha(Path(__file__).read_bytes())}
    (WORK/'frozen.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps(receipt))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--patch-root',type=Path,required=True);p.add_argument('--source-pins',type=Path,required=True);main(p.parse_args())
