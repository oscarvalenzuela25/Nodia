"""Reproduce AI39's partial-cut evidence/source checks; never starts a runtime."""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[3]
checks = []


def checked(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)


def read(name):
    return json.loads((ROOT / 'docs/evidence' / name).read_text(encoding='utf-8'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    native = read('nodia-ai-ai39-experimental-protocol-r02.json')
    initializer = read('nodia-ai-ai39-native-initializer-r01.json')
    peer = read('nodia-ai-ai39-channel-process-r02.json')
    unit = read('nodia-ai-ai39-channel-vitest-r01.json')
    c02 = read('nodia-ai-ai39-c02-reconciliation-r01.json')
    checked('native-experimental-schemas-445', native['schema_count'] == 445)
    checked('native-admission-active-parser', native['native_cases'][0]['thread_result'] is True and
            native['native_cases'][1]['thread_result'] is False and
            native['native_cases'][2]['thread_result'] is False)
    checked('native-binary-same-across-gates', native['binary_sha256'] == initializer['binary_sha256'])
    for label, report in [('admission', native), ('initializer', initializer)]:
        key = 'inference_requests' if label == 'admission' else 'provider_inference_requests'
        checked(label + '-zero-inference', report[key] == 0)
        checked(label + '-zero-account-discovery', report['model_list_requests'] == 0 and
                report['account_read_requests'] == 0 and report['login_requests'] == 0)
    checked('initializer-actual-effective-policy', initializer['actual_production_initializer'] is True and
            initializer['effective_codex_settings_validated_by_initializer'] is True)
    checked('initializer-only-initialize-config-thread', initializer['requested_methods'] ==
            ['initialize', 'config/read', 'thread/start'])
    checked('initializer-native-child-reaped', initializer['owned_native_process_reaped'] is True)
    checked('initializer-no-auth-file', initializer['synthetic_profile_auth_file_absent'] is True)
    checked('peer-real-jsonl-and-fourteen-checks', peer['all_passed'] is True and peer['checks'] == 14 and
            peer['mode'] == 'isolated_real_jsonl_synthetic_peer')
    checked('peer-one-gateway-callback', peer['gateway_callbacks'] == 1 and peer['admitted_request_budget_hooks'] == 4)
    checked('peer-native-children-reaped', peer['owned_children_reaped'] is True)
    checked('peer-no-real-effects-or-inference', peer['real_business_effects'] == 0 and
            peer['provider_inference_requests'] == 0 and peer['account_or_connection_profiles_opened'] is False)
    checked('peer-and-initializer-network-isolated', peer['network_namespace'] is True and
            initializer['network_namespace'] is True and native['network_namespace'] is True)
    checked('peer-compiled-sources-equal-native-initializer', peer['source_manifest'] == initializer['source_manifest'])
    for relative, expected in peer['source_manifest'].items():
        checked('channel-source:' + relative, digest(ROOT / 'nodia-server/src' / relative) == expected)
    for source in c02['sources']:
        checked('c02-source:' + source['path'], digest(ROOT / source['path']) == source['sha256'])
    checked('unit-93-pass', unit['success'] is True and unit['numPassedTests'] == 93 and unit['numFailedTests'] == 0)
    checked('c02-targeted-179-pass', c02['checks']['targeted_use_cases']['tests'] == 179 and
            c02['checks']['targeted_use_cases']['exit_code'] == 0)
    checked('c02-global-4475-pass', c02['checks']['full_suite_final']['tests'] == 4475 and
            c02['checks']['full_suite_final']['failed'] == 0)
    checked('c02-final-native-build-passed', c02['checks']['final_native_Nest_build']['exit_code'] == 0)
    checked('c02-no-mode-or-deployment', c02['Codex_available_or_enabled'] is False and c02['deployment'] is False)
    ficha = ROOT / 'docs/nodia-ai/knowledge/nodia-ai/features/context-execution.md'
    metadata = json.loads(ficha.read_text(encoding='utf-8').split('---', 2)[1])
    checked('feature-draft-partial-unregistered', metadata['document_status'] == 'draft' and
            metadata['implementation']['status'] == 'partial' and metadata['integration_status'] == 'unregistered' and
            metadata['approval'] is None)
    links = 0
    for relative in ['docs/mvp/85-nodia-ai-ai39-codex-runtime.md',
                     'docs/architecture/decisions/ADR-072-nodia-ai-provider-runtime-adapters.md']:
        path = ROOT / relative
        for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
            if target.startswith(('https://', 'http://', '#')):
                continue
            resolved = (path.parent / target.split('#', 1)[0]).resolve()
            # The exact output link may be checked before its exclusive creation;
            # every other target must already exist. No publication or runtime.
            own_output = Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else None
            checked('link:' + relative + ':' + target, resolved.exists() or resolved == own_output)
            links += 1
    evidence_names = ['nodia-ai-ai39-native-protocol-r01.json', 'nodia-ai-ai39-experimental-protocol-r02.json',
                      'nodia-ai-ai39-native-initializer-r01.json', 'nodia-ai-ai39-channel-process-r02.json',
                      'nodia-ai-ai39-channel-vitest-r01.json', 'nodia-ai-ai39-c02-reconciliation-r01.json']
    source_paths = [ROOT / 'nodia-server/src' / p for p in peer['source_manifest']]
    source_paths += [ROOT / source['path'] for source in c02['sources']]
    source_paths += [ROOT / 'nodia-server/src/ai-provider/use-case/codex-chat-tool-channel.use-case.spec.ts', ficha,
                     ROOT / 'docs/mvp/85-nodia-ai-ai39-codex-runtime.md',
                     ROOT / 'docs/architecture/decisions/ADR-072-nodia-ai-provider-runtime-adapters.md']
    result = {
        'task': 'AI39-partial-cut', 'validator_checks': len(checks), 'all_passed': True,
        'check_names': checks, 'local_document_links_verified': links,
        'evidence_sha256': {name: digest(ROOT / 'docs/evidence' / name) for name in evidence_names},
        'source_sha256': {str(path.relative_to(ROOT)).replace('\\', '/'): digest(path) for path in source_paths},
        'validator_sha256': digest(Path(__file__)),
        'limits': ['No Codex account, inference, native tool callback, modalities, durable runtime or deployment accepted.',
                   'C02 is a declared identity contract and unit/build evidence, not SQL/provider acceptance.',
                   'C03 caller must still wire profile journal/lease/fence, gateway, all-RPC accounting, terminal proof and ACK.',
                   'The registry/publication and AI38/AI40 gates remain independent.'],
    }
    if len(sys.argv) == 2:
        output = Path(sys.argv[1])
        with output.open('x', encoding='utf-8') as stream:
            json.dump(result, stream, indent=2)
            stream.write('\n')
        print(json.dumps({'path': str(output), 'sha256': digest(output), 'checks': len(checks), 'passed': True}))
    else:
        print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
