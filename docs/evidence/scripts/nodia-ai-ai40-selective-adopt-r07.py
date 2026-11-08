"""Narrow R06 -> R07 successor. No provider or account observation is performed."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

R06 = Path('/opt/nodia/verification/ai40-r06-operator-r01/nodia-ai-ai40-selective-adopt-r06.py')
R06_SHA = '272c5d44a1a6774c6587c32448facebcecd7729fbd645f65a719ae4ce9920d98'
OLD = Path('/opt/nodia/releases/nodia-server-ai40-r06')
NEW = Path('/opt/nodia/releases/nodia-server-ai40-r07')
OLD_SHA = '5aa5b74dd43cfbc61615f766ba8e17dd12bb3c8bb0a695bd85fc68c6d519c2bd'
NEW_SHA = '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476'
PLAN_SHA = 'e829082c4dd93322cdb9325721622a3787bbb72ff704caa2eed208fa279c005d'
SCOPE = '1233a6c04a7d215994bfb7f40f41eef5e0d44935532fce8a8f092fdf1c57d11a'
EXPECTED_DELTA = [{'path': 'dist/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.d.ts', 'old_sha256': '0c402b8c8616973b1cc26c43cc5e12afd8444ebc33ffbcd80f5dfe7409455001', 'sha256': 'b336426c94826bf1e523f926301b57e9871ac1d80f7ee9be977e0cd166d0603a'}, {'path': 'dist/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.js', 'old_sha256': '721ae31413ce47b024dfc83890a1a18e451abd4456b94df028917fb6f38f2098', 'sha256': '2a181c2460bb5f5402e65c4767bf25253395421095931f8276f0fa401d76d9e1'}, {'path': 'dist/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.js.map', 'old_sha256': '5340d24477374f995ca9d42bf4d5bdbc036ee8a3544009f99cebb22115348483', 'sha256': 'e99e42fd3d1d86fb6f30bcd9b0c82a3c74d1faca2ea40deb74b597bd1a016552'}, {'path': 'dist/nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.d.ts', 'old_sha256': '9a8ffdfa3067800d07fd34378e8ad75f1a37222a53f2c8b5be8ff01a71526251', 'sha256': '300226b789c4a2a7bfde01d518686d24c2289f2dd8a98306ca047db71d40076f'}, {'path': 'dist/nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.js', 'old_sha256': '6c46995be5ff9b2a0c096554a07fa149044af56d90bf3b247496e161f18390b9', 'sha256': '1802b939db21d1095c61a5f44c055c3c7a9e049115a48952af8b4c25f2764f63'}, {'path': 'dist/nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.js.map', 'old_sha256': 'dcc50cc9f39fcf388721ccc3889ce4acdfe3b28c0b716d8dd9246a9672cfec40', 'sha256': '16bff747b2a9170ec3692f24800c56d99a2b91005e310579f42075a07142f7f8'}, {'path': 'src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts', 'old_sha256': '2ce8f0661c25f0b8d48e59de8e3801f6180ecf8151c0d79397c5e167ad8d2965', 'sha256': 'd0548d240a6cf2c051054e1cca4b25c02c8a5b6948f4ffd81b356ed53c874a1d'}, {'path': 'src/nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.ts', 'old_sha256': '91e1e396e45d131b6aa5d15d1e7de082a1296c64eb1ca3081c2a1a049d661dde', 'sha256': '9d101bb0779aa32a7ed99e4ae3b82cb2bd45184dbd5b464180b651f5d1b3a1b0'}]


def require(value, code):
    if not value:
        raise ValueError(code)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def unchanged_scope():
    script = r'''
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const roots=process.argv.slice(1);createRequire(roots[0]+'/package.json')('reflect-metadata');
const sha=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const executable='/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex';
assert.equal(sha(readFileSync(executable)),'9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c');assert.equal(process.version,'v24.20.0');
const boundaries=['common/ai/codex/codex-chat-runtime','common/ai/codex/codex-chat-images','common/ai/codex/codex-chat-image-acceptance','common/ai/codex/codex-chat-acceptance','common/ai/codex/codex-chat-journal','common/ai/codex/codex-contract','common/ai/codex/codex-rpc','common/ai/codex/codex-runtime.service','common/ai/codex/codex-process-ownership','ai-provider/use-case/codex-chat-tool-channel.use-case','nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case'];
const values=[];for(const root of roots){
 const raw=readFileSync(root+'/dist/nodia-ai-runtime/config/runtime-policy.json');
 const {ValidateNodiaAiRuntimePolicyUseCase:Validate}=await import(pathToFileURL(root+'/dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js'));
 const policy=new Validate().execute(JSON.parse(raw));
 const {codexChatRuntimeFingerprint:fingerprint}=await import(pathToFileURL(root+'/dist/common/ai/codex/codex-chat-acceptance.js'));
 values.push({root,boundaries:Object.fromEntries(boundaries.map(p=>[p,sha(readFileSync(root+'/dist/'+p+'.js'))])),policy_asset_sha256:sha(raw),validated_policy_sha256:sha(JSON.stringify(canonical(policy))),runtime_fingerprint:sha(await fingerprint(executable)+JSON.stringify(canonical(policy)))});
}
assert.equal(values[0].runtime_fingerprint,'1233a6c04a7d215994bfb7f40f41eef5e0d44935532fce8a8f092fdf1c57d11a');assert.equal(values[0].runtime_fingerprint,values[1].runtime_fingerprint);
assert.deepEqual(values[0].boundaries,values[1].boundaries);assert.equal(values[0].policy_asset_sha256,values[1].policy_asset_sha256);assert.equal(values[0].validated_policy_sha256,values[1].validated_policy_sha256);
console.log(JSON.stringify({source:values[0],target:values[1],node:process.version,v8:process.versions.v8,platform:process.platform,architecture:process.arch,native_binary_sha256:sha(readFileSync(executable)),provider_observations:0,provider_generations:0}));
'''
    result = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-e', script, str(OLD), str(NEW)], capture_output=True, timeout=30, check=False)
    require(result.returncode == 0 and len(result.stdout) < 16384, 'account_free_scope_check_failed')
    return json.loads(result.stdout)


def run(args):
    require(R06.is_file() and not R06.is_symlink() and digest(R06) == R06_SHA, 'immutable_r06_driver_pin_mismatch')
    spec = importlib.util.spec_from_file_location('immutable_r06_driver', R06)
    prior = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prior)
    prior.OLD, prior.NEW, prior.OLD_SHA, prior.NEW_SHA = OLD, NEW, OLD_SHA, NEW_SHA
    prior.PLAN_SHA = PLAN_SHA
    prior.WORK = Path('/opt/nodia/verification/ai40-selective-adopt-r07')
    prior.EXPECTED_DELTA = EXPECTED_DELTA
    prior.scope_guard = unchanged_scope
    prior.__file__ = str(Path(__file__).resolve())
    original_load = prior.load

    def load(path, pin, name):
        module = original_load(path, pin, name)
        if name == 'immutable_availability_guards':
            original_check = module.completed_prior_attempt

            def completed_r06_final_adoption():
                # The original strict receipt validator remains authoritative.
                # Replace only its exact predecessor coordinates before checking.
                module.PRIOR_WORK = Path('/opt/nodia/verification/ai40-selective-final-adopt-r06')
                module.PRIOR_WRAPPER_SHA = R06_SHA
                module.PRIOR_PLAN_SHA = '5a6d2d03f565eceef5eadfb117d19b6d763fc93569227e0ff000770bd553cc75'
                module.PRIOR_SOURCE = Path('/opt/nodia/releases/nodia-server-ai40-r05')
                module.PRIOR_SOURCE_SHA = '07b83a30d4721dba1d1ca34d0b083868b5a8b64369d8ac853d389434f73a76cd'
                return original_check()

            module.completed_prior_attempt = completed_r06_final_adoption
        return module

    prior.load = load
    args.cycle = 'initial'
    result = prior.run(args)
    return {**result, 'technical_scope_changed': False, 'native_runtime_changed': False,
            'fresh_MCP_and_images_required': True, 'prior_unknown_acceptances_not_restored': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['preflight', 'adopt', 'rollback'])
    parser.add_argument('--base-driver', required=True)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--execute', action='store_true')
    try:
        result = run(parser.parse_args())
        print(json.dumps(result))
        sys.exit(0 if result.get('status') in ('preflight_passed_no_mutations', 'adopt_completed', 'rollback_completed') else 1)
    except Exception as error:
        message = str(error)
        print(json.dumps({'stage': 'AI40-R07', 'status': 'precondition_failed', 'error_class': type(error).__name__, 'failure_code': message if re.fullmatch('[a-z][a-z0-9_]{1,95}', message) else None, 'private_details_emitted': False, 'generation_not_replayed': True}))
        sys.exit(1)
