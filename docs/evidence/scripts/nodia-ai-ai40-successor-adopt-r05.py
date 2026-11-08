"""Narrow R04 -> R05 transition; reuse immutable R04 semantic and deployment guards.

No account discovery or provider generation. A changed technical scope fails
closed rather than copying, refreshing or overriding acceptance evidence.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

R04 = Path('/opt/nodia/verification/ai40-r04-operator-r01/nodia-ai-ai40-image-adopt-r04-r02.py')
R04_SHA = 'b2701d4d052f0e335589828153cecb21d955afd49b5da82bac4f006ddbfa72ae'
OLD = Path('/opt/nodia/releases/nodia-server-ai40-r04')
NEW = Path('/opt/nodia/releases/nodia-server-ai40-r05')
OLD_SHA = '188d4ca7d251d986862bc8c7edf5f267bc6746f3f2b38a0164fce1c085ae3ef0'
NEW_SHA = '07b83a30d4721dba1d1ca34d0b083868b5a8b64369d8ac853d389434f73a76cd'
OLD_KNOWLEDGE = 'aa65da06b352743b1f937e8613c3c34bc0caf86db94be4993954a1b7814113d0'
NEW_KNOWLEDGE = '5c83848c6eb1a6ce77fa63ad9de38f4dea556f260b6a9646cfceaaf4850db994'
PLAN_SHA = '9277a411699b2870577b3863a71e24ee0ec1d3fab21b589a088b4aaf00688cfc'
WORK = Path('/opt/nodia/verification/ai40-predispatch-adopt-r05')
SCOPE = '51a284da7f892943e9101d08af7513f405b81034c7b85f7c05517d0daab82543'


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path, pin, name):
    require(path.is_file() and not path.is_symlink() and sha(path) == pin, name + '_pin_mismatch')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def scope_guard():
    # Import only the pure fingerprint and policy validator, never a runtime,
    # SDK, session store, model discovery or CLI process. Both complete release
    # manifests have already been verified by the original deployment driver.
    script = r'''
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const roots=process.argv.slice(1);
createRequire(roots[0]+'/package.json')('reflect-metadata');
const sha=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const executable='/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex';
const binarySha=sha(readFileSync(executable));
assert.equal(binarySha,'9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c');
assert.equal(process.version,'v24.20.0');
const boundaries=['common/ai/codex/codex-chat-runtime','common/ai/codex/codex-chat-images','common/ai/codex/codex-chat-image-acceptance','common/ai/codex/codex-chat-acceptance','common/ai/codex/codex-chat-journal','common/ai/codex/codex-contract','common/ai/codex/codex-rpc','common/ai/codex/codex-runtime.service','common/ai/codex/codex-process-ownership','ai-provider/use-case/codex-chat-tool-channel.use-case','nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case'];
const values=[];
for(const root of roots){
 const policyRaw=readFileSync(root+'/dist/nodia-ai-runtime/config/runtime-policy.json');
 const {ValidateNodiaAiRuntimePolicyUseCase:Validate}=await import(pathToFileURL(root+'/dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js'));
 const policy=new Validate().execute(JSON.parse(policyRaw));
 const {codexChatRuntimeFingerprint:fingerprint}=await import(pathToFileURL(root+'/dist/common/ai/codex/codex-chat-acceptance.js'));
 const runtime=await fingerprint(executable);
 values.push({root,boundaries:Object.fromEntries(boundaries.map(p=>[p,sha(readFileSync(root+'/dist/'+p+'.js'))])),policy_asset_sha256:sha(policyRaw),validated_policy_sha256:sha(JSON.stringify(canonical(policy))),runtime_fingerprint:sha(runtime+JSON.stringify(canonical(policy)))});
}
assert.deepEqual(values[0].boundaries,values[1].boundaries);
assert.equal(values[0].policy_asset_sha256,values[1].policy_asset_sha256);
assert.equal(values[0].validated_policy_sha256,values[1].validated_policy_sha256);
assert.equal(values[0].runtime_fingerprint,values[1].runtime_fingerprint);
console.log(JSON.stringify({native_binary_sha256:binarySha,node:process.version,v8:process.versions.v8,platform:process.platform,architecture:process.arch,source:values[0],target:values[1],provider_observations:0,provider_generations:0}));
'''
    result = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-e', script, str(OLD), str(NEW)],
                            capture_output=True, timeout=30, check=False)
    require(result.returncode == 0 and len(result.stdout) <= 16384, 'account_free_scope_check_failed')
    value = json.loads(result.stdout)
    require(value['source']['runtime_fingerprint'] == SCOPE == value['target']['runtime_fingerprint'],
            'reviewed_technical_scope_changed')
    return value


def run(args):
    require(sha(Path(__file__).resolve()) == args.operator_sha256, 'successor_operator_pin_mismatch')
    require(args.plan_sha256 == PLAN_SHA, 'successor_plan_pin_mismatch')
    guard = load(R04, R04_SHA, 'immutable_r04_guards')
    guard.OLD, guard.NEW = OLD, NEW
    guard.OLD_MANIFEST, guard.NEW_MANIFEST = OLD_SHA, NEW_SHA
    guard.OLD_KNOWLEDGE, guard.NEW_KNOWLEDGE = OLD_KNOWLEDGE, NEW_KNOWLEDGE
    knowledge = guard.semantic_knowledge_guard()
    # Only approved-document provenance SHA changes in the current knowledge
    # bundle; schemas, fragments, capabilities and source references stay equal.
    bundles = [json.loads((root / 'dist/nodia-ai/knowledge/manifest.json').read_bytes()) for root in (OLD, NEW)]
    provenance = []
    for a, b in zip(bundles[0]['documents'], bundles[1]['documents']):
        for x, y in zip(a['source_hashes'], b['source_hashes']):
            if x != y:
                provenance.append({'document_id': a['document_id'], 'old': x, 'new': y})
    require(provenance == [{'document_id': 'nodia-ai.conversation-coordination',
                            'old': {'path': 'docs/mvp/45-nodia-ai-implementation-plan.md',
                                    'sha256': '7134466241afdf553eb77f079a3cb9e54a0a0d513480e38870a81c80611ebbe5'},
                            'new': {'path': 'docs/mvp/45-nodia-ai-implementation-plan.md',
                                    'sha256': '87cbf625329d87e91003b4aa285e3d369ba70913c05e3dc3ad98061451af8db9'}}],
            'knowledge_provenance_delta_unexpected')
    previous = load(guard.PRIOR, guard.PRIOR_SHA, 'immutable_availability_guards')
    previous.OLD, previous.OLD_SHA, previous.OLD_KNOWLEDGE = OLD, OLD_SHA, OLD_KNOWLEDGE
    previous.TARGET, previous.TARGET_SHA, previous.WORK, previous.PLAN_SHA = NEW, NEW_SHA, WORK, PLAN_SHA
    previous.PRIOR_WORK = Path('/opt/nodia/verification/ai40-image-adopt-r04')
    previous.PRIOR_WRAPPER_SHA = R04_SHA
    previous.PRIOR_PLAN_SHA = 'ae85c9f947bb976a8e9c5f6d260c2a9885a56b896bcaa77491f7b89c19c07368'
    previous.PRIOR_SOURCE = Path('/opt/nodia/releases/nodia-server-ai40-r03')
    previous.PRIOR_SOURCE_SHA = '0e769ded9a0a36e6d62a17415ea15d1843ce48735ff746ce5e238c5c3b2ea341'
    previous.__file__ = str(Path(__file__).resolve())
    inherited = previous.configure
    scope = None

    def configure(base, phase):
        nonlocal scope
        # Full inventory verification, using the pinned original driver's
        # manifest routine, precedes imports of any source/target JS.
        base.manifest(OLD, OLD_SHA, OLD_KNOWLEDGE)
        base.manifest(NEW, NEW_SHA, NEW_KNOWLEDGE)
        scope = scope_guard()
        original_plan = base.plan_file
        configured = inherited(base, phase)
        inherited_load = configured.load_helper

        def exact_plan(path, pin):
            value = original_plan(path, pin)
            require(value['release'] == str(NEW) and value['manifest_sha256'] == NEW_SHA
                    and value['knowledge_release'] == NEW_KNOWLEDGE, 'exact_successor_required')
            return value

        configured.plan_file = exact_plan

        def load_helper():
            operator, helpers = inherited_load()
            original_freeze = operator.freeze

            def freeze(name, value):
                if name in ('adopt-after.json', 'rollback-after.json'):
                    require(scope_guard() == scope, 'technical_scope_changed_during_transition')
                original_freeze(name, {**guard.effective_result(value), 'preserved_technical_scope': scope,
                                       'knowledge_provenance_delta': provenance})

            operator.freeze = freeze
            return operator, helpers

        configured.load_helper = load_helper
        return configured

    previous.configure = configure
    return {**guard.effective_result(previous.run(args)), 'knowledge_semantics': knowledge,
            'knowledge_provenance_delta': provenance, 'preserved_technical_scope': scope,
            'inherited_r04_guards_sha256': R04_SHA}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['preflight', 'adopt', 'rollback'])
    parser.add_argument('--base-driver', required=True)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--execute', action='store_true')
    try:
        output = run(parser.parse_args())
        print(json.dumps(output))
        sys.exit(0 if output.get('status') in ('preflight_passed_no_mutations', 'adopt_completed', 'rollback_completed') else 1)
    except Exception as error:
        code = str(error)
        print(json.dumps({'stage': 'AI40-R05', 'status': 'precondition_failed', 'error_class': type(error).__name__,
                          'failure_code': code if re.fullmatch('[a-z][a-z0-9_]{1,95}', code) else None,
                          'private_details_emitted': False, 'generation_not_replayed': True}))
        sys.exit(1)
