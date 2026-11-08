"""Pinned R03 -> image-tested R04 successor of the existing guarded operator.

Reuse the immutable availability wrapper and its backup/drain/ACK/descriptor,
namespace, journal and failure controls. Only successor identity and the exact
technical knowledge release are changed. No readiness/publication override.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

PRIOR = Path('/opt/nodia/verification/ai40-availability-operator-r01/nodia-ai-ai40-availability-adopt-r01.py')
PRIOR_SHA = 'd34a2d92fdadca4901282a4cc3ccf75d5948901e4a5c8a14e1915df1cf1f9b87'
OLD = Path('/opt/nodia/releases/nodia-server-ai40-r03')
NEW = Path('/opt/nodia/releases/nodia-server-ai40-r04')
OLD_MANIFEST = '0e769ded9a0a36e6d62a17415ea15d1843ce48735ff746ce5e238c5c3b2ea341'
NEW_MANIFEST = '188d4ca7d251d986862bc8c7edf5f267bc6746f3f2b38a0164fce1c085ae3ef0'
OLD_KNOWLEDGE = '49935f292d476721ee9825fcc6e0cbce434da0d2461e2f6dd5a758faeb6840ca'
NEW_KNOWLEDGE = 'aa65da06b352743b1f937e8613c3c34bc0caf86db94be4993954a1b7814113d0'
PLAN_SHA = 'ae85c9f947bb976a8e9c5f6d260c2a9885a56b896bcaa77491f7b89c19c07368'
WORK = Path('/opt/nodia/verification/ai40-image-adopt-r04')
EXTERNAL_SCHEMAS = frozenset('docs/evidence/nodia-ai-ai36-c05-publication-' + name + '.schema.json'
                             for name in ('common-preparation', 'common-reads', 'write-finance-business'))


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def semantic_knowledge_guard():
    release_manifests = {}
    for root, pin in ((OLD, OLD_MANIFEST), (NEW, NEW_MANIFEST)):
        require(sha(root / 'release-manifest.json') == pin, 'release_manifest_pin_mismatch')
        release_manifests[root] = json.loads((root / 'release-manifest.json').read_bytes())
        expected = release_manifests[root]['files']['dist/nodia-ai/knowledge/manifest.json']
        require(sha(root / 'dist/nodia-ai/knowledge/manifest.json') == expected, 'knowledge_bundle_bytes_changed')
    bundles = [json.loads((root / 'dist/nodia-ai/knowledge/manifest.json').read_bytes()) for root in (OLD, NEW)]
    require([bundle['release_id'] for bundle in bundles] == [OLD_KNOWLEDGE, NEW_KNOWLEDGE], 'knowledge_release_pin_mismatch')
    for bundle in bundles:
        require(len(bundle['documents']) == 31 and len(bundle['fragments']) == 31 and len(bundle['capability_contracts']) == 74,
                'knowledge_publication_count_changed')
    # Only known technical digests may differ. Revisions, IDs, approval metadata,
    # paths, routes and fragment bytes remain exact, including all other fields.
    def without_technical_hashes(value, path=''):
        if isinstance(value, list):
            return [without_technical_hashes(item, path + '/' + str(index)) for index, item in enumerate(value)]
        if not isinstance(value, dict):
            return value
        result = {}
        for key, item in value.items():
            current = path + '/' + key
            technical = current in ('/release_id', '/registry_sha256', '/contract_schema_sha256') or bool(re.fullmatch(
                r'/(?:documents/\d+/source_hashes/\d+/sha256|capability_contracts/\d+/(?:implementation_sources/\d+/sha256|(?:input|output)_schema/sha256)|fragments/\d+/requires/\d+/(?:input|output)_schema_sha256)', current))
            if technical:
                require(isinstance(item, str) and re.fullmatch('[a-f0-9]{64}', item), 'technical_digest_invalid')
                continue
            result[key] = without_technical_hashes(item, current)
        return result
    require(without_technical_hashes(bundles[0]) == without_technical_hashes(bundles[1]), 'knowledge_semantics_or_authority_changed')

    def reference_bytes(root, reference):
        name = reference['path']
        require(isinstance(name, str) and name.startswith('nodia-server/'), 'contract_source_path_invalid')
        relative = Path(name.removeprefix('nodia-server/'))
        require(not relative.is_absolute() and '..' not in relative.parts, 'contract_source_path_invalid')
        path = root / relative
        require(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root), 'contract_source_unavailable')
        value = path.read_bytes()
        digest = hashlib.sha256(value).hexdigest()
        require(digest == reference['sha256'] == release_manifests[root]['files'].get(relative.as_posix()),
                'contract_source_pin_mismatch')
        return value

    runtime_common = []
    for root in (OLD, NEW):
        name = 'dist/nodia-ai-tools/config/common-schema.json'
        require(sha(root / name) == release_manifests[root]['files'][name], 'runtime_common_schema_pin_mismatch')
        runtime_common.append(json.loads((root / name).read_bytes()))
    require(runtime_common[0] == runtime_common[1], 'runtime_common_schema_semantics_changed')
    schema_pairs, implementation_pairs, external_pairs = 0, 0, 0
    schema_paths = set()
    for old_capability, new_capability in zip(bundles[0]['capability_contracts'], bundles[1]['capability_contracts']):
        require(old_capability['capability_id'] == new_capability['capability_id'], 'capability_identity_changed')
        for field in ('input_schema', 'output_schema'):
            references = [capability[field] for capability in (old_capability, new_capability)]
            if references[0]['path'] in EXTERNAL_SCHEMAS:
                require(references[0] == references[1], 'external_schema_reference_changed')
                require(re.fullmatch('[a-f0-9]{64}', references[0]['sha256']), 'external_schema_digest_invalid')
                external_pairs += 1
                schema_paths.add(references[0]['path'])
                continue
            schemas = [json.loads(reference_bytes(root, reference)) for root, reference in zip((OLD, NEW), references)]
            require(schemas[0] == schemas[1], 'capability_schema_semantics_changed')
            for schema, reference in zip(schemas, references):
                definitions = schema.get('$defs', schema.get('definitions', {}))
                require(reference['definition'] in definitions, 'capability_schema_definition_missing')
            schema_pairs += 1
            schema_paths.add(references[0]['path'])
        for old_ref, new_ref in zip(old_capability['implementation_sources'], new_capability['implementation_sources']):
            require(old_ref['path'] == new_ref['path'], 'capability_implementation_path_changed')
            old_bytes, new_bytes = reference_bytes(OLD, old_ref), reference_bytes(NEW, new_ref)
            require(old_bytes.replace(b'\r\n', b'\n') == new_bytes.replace(b'\r\n', b'\n'),
                    'capability_implementation_semantics_changed')
            implementation_pairs += 1
    for fragment in bundles[0]['fragments']:
        path = fragment['asset_path']
        require(not Path(path).is_absolute() and '..' not in Path(path).parts, 'fragment_asset_path_invalid')
        require(sha(OLD / 'dist/nodia-ai/knowledge' / path) == fragment['sha256'] and
                sha(NEW / 'dist/nodia-ai/knowledge' / path) == fragment['sha256'], 'fragment_content_changed')
    return {'documents': 31, 'fragments': 31, 'capabilities': 74,
            'approved_content_and_authority_unchanged': True, 'technical_release_changed': True,
            'schema_pairs_verified_structurally': schema_pairs, 'distinct_schema_files': len(schema_paths),
            'external_schema_references_preserved_exactly': external_pairs,
            'runtime_common_schema_structural_equivalence': True,
            'implementation_reference_pairs_equal_after_LF_normalization': implementation_pairs}


def effective_result(value):
    if value.get('status') not in ('adopt_completed', 'rollback_completed'):
        return value
    target = OLD if value['status'] == 'rollback_completed' else NEW
    knowledge = OLD_KNOWLEDGE if target == OLD else NEW_KNOWLEDGE
    require(value.get('target') == str(target), 'effective_target_mismatch')
    require(json.loads((target / 'dist/nodia-ai-context/config/knowledge-pin.json').read_bytes())['release_id'] == knowledge,
            'effective_context_release_mismatch')
    return {**value, 'knowledge_release': knowledge, 'package_plan_knowledge_release': NEW_KNOWLEDGE,
            'effective_release': str(target), 'availability_requires_current_fingerprint_observation': True,
            'MCP_proof_restored_by_file_copy': False}


def run(args):
    require(sha(Path(__file__).resolve()) == args.operator_sha256, 'successor_operator_pin_mismatch')
    require(PRIOR.is_file() and not PRIOR.is_symlink() and sha(PRIOR) == PRIOR_SHA, 'prior_wrapper_pin_mismatch')
    require(args.plan_sha256 == PLAN_SHA, 'successor_plan_pin_mismatch')
    knowledge = semantic_knowledge_guard()
    spec = importlib.util.spec_from_file_location('pinned_availability_successor', PRIOR)
    previous = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(previous)
    previous.OLD, previous.OLD_SHA, previous.OLD_KNOWLEDGE = OLD, OLD_MANIFEST, OLD_KNOWLEDGE
    previous.TARGET, previous.TARGET_SHA, previous.WORK = NEW, NEW_MANIFEST, WORK
    previous.PLAN_SHA = PLAN_SHA
    previous.PRIOR_WORK = Path('/opt/nodia/verification/ai40-availability-adopt-r01')
    previous.PRIOR_WRAPPER_SHA = PRIOR_SHA
    previous.PRIOR_PLAN_SHA = '1edc3fa69a83d79be98d31831b1fcafd3da99b68b324b0cab1a79eeac52793b5'
    previous.PRIOR_SOURCE = Path('/opt/nodia/releases/nodia-server-ai40-r02')
    previous.PRIOR_SOURCE_SHA = 'a555aa8f35e3fffe22b9293e62f2585e2004d55a9c9ab5ecce78d8486bbc35dc'
    # Inherited immutable logic writes the executing successor's source pin in
    # transition receipts; the imported prior source was independently verified.
    previous.__file__ = str(Path(__file__).resolve())
    inherited = previous.configure

    def configure(base, phase):
        strict_original_plan = base.plan_file
        configured = inherited(base, phase)
        inherited_load = configured.load_helper

        def exact_successor_plan(path, pin):
            value = strict_original_plan(path, pin)
            require(value['release'] == str(NEW) and value['manifest_sha256'] == NEW_MANIFEST and
                    value['knowledge_release'] == NEW_KNOWLEDGE, 'exact_image_successor_required')
            return value

        configured.plan_file = exact_successor_plan

        def load_helper():
            operator, helpers = inherited_load()
            inherited_freeze = operator.freeze

            def freeze(name, value):
                # Correct the inherited rollback projection in durable receipts,
                # after its own target/process checks; never relabel the target.
                inherited_freeze(name, effective_result(value))

            operator.freeze = freeze
            return operator, helpers

        configured.load_helper = load_helper
        return configured

    previous.configure = configure
    return {**effective_result(previous.run(args)), 'inherited_wrapper_sha256': PRIOR_SHA, 'knowledge_semantics': knowledge}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['preflight', 'adopt', 'rollback'])
    parser.add_argument('--base-driver', required=True)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--plan-sha256', required=True)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--execute', action='store_true')
    options = parser.parse_args()
    try:
        output = run(options)
        print(json.dumps(output))
        sys.exit(0 if output.get('status') in ('preflight_passed_no_mutations', 'adopt_completed', 'rollback_completed') else 1)
    except Exception as error:
        code = str(error)
        print(json.dumps({'stage': 'AI40-R04', 'status': 'precondition_failed', 'error_class': type(error).__name__,
                          'failure_code': code if re.fullmatch('[a-z][a-z0-9_]{1,95}', code) else None,
                          'private_details_emitted': False, 'generation_not_replayed': True}))
        sys.exit(1)
