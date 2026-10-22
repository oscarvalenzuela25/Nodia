"""Offline contract and negative checks; no imported application or VM actions."""
import hashlib
import json
from pathlib import Path
import re
import runpy


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / 'docs/evidence/scripts/nodia-ai-ai38-proxy.py'
SNIPPET = ROOT / 'ops/nginx/nodia-ai-attachment-content.conf'


def main():
    functions = runpy.run_path(str(SCRIPT), run_name='offline_review')
    render = functions['render']
    original = (b'server {\n    listen 127.0.0.1:8080;\n'
                b'    client_max_body_size 11m;\n    location /api/v1 {\n'
                b'        proxy_pass http://127.0.0.1:3000;\n    }\n'
                b'    location / { return 404; }\n}\n')
    snippet = SNIPPET.read_bytes()
    rendered = render(original, snippet)
    checks = []

    def check(name, condition):
        assert condition, name
        checks.append(name)

    policy = json.loads((ROOT / 'docs/mvp/nodia-ai-v1-runtime-policy.json').read_text())
    check('exact_raw_file_limit_matches_runtime_policy',
          policy['admission']['file_bytes'] == 20 * 1024 * 1024 and
          b'client_max_body_size 20m;' in snippet)
    check('message_aggregate_is_separate_from_upload_body',
          policy['admission']['message_files_bytes'] == 40 * 1024 * 1024 and
          policy['admission']['files_per_message'] == 4 and b'40m' not in snippet)
    check('global_limit_preserved', rendered.count(b'client_max_body_size 11m;') == 1)
    check('only_owned_block_added',
          rendered.replace(rendered[rendered.index(functions['BEGIN']):
                                    rendered.index(functions['END']) + len(functions['END'])],
                           b'', 1) == original)
    check('no_public_listener_or_new_upstream', b'listen ' not in snippet and
          snippet.count(b'proxy_pass http://127.0.0.1:3000;') == 1)
    pattern = re.search(rb'location ~\* "([^"]+)"', snippet).group(1).decode()
    route = '/api/v1/nodia-ai/attachments/12345678-1234-4123-8123-123456789abc/content'
    matcher = re.compile(pattern, re.IGNORECASE)
    check('valid_UUIDv4_route_selected', matcher.search(route) is not None)
    check('case_insensitive_route_preserves_Express_contract', matcher.search(route.upper()) is not None)
    for label, candidate in (
        ('no_scope_widening_to_other_API', '/api/v1/products'),
        ('no_scope_widening_to_intent_JSON', '/api/v1/nodia-ai/attachments'),
        ('no_scope_widening_to_review', route.replace('/content', '/interpretation')),
        ('no_suffix_or_child_route', route + '/child'),
        ('no_invalid_UUID_version', route.replace('-4123-', '-3123-')),
        ('no_invalid_UUID_variant', route.replace('-8123-', '-7123-')),
    ):
        check(label, matcher.search(candidate) is None)
    for label, candidate in (
        ('refuse_duplicate_owned_block', rendered),
        ('refuse_unknown_global_limit', original.replace(b'11m;', b'12m;')),
        ('refuse_missing_API_location', original.replace(b'location /api/v1 {', b'location /other {')),
    ):
        refused = False
        try:
            render(candidate, snippet)
        except AssertionError:
            refused = True
        check(label, refused)
    controller = (ROOT / 'nodia-server/src/nodia-ai-attachment/nodia-ai-attachment.controller.ts').read_text()
    create = (ROOT / 'nodia-server/src/nodia-ai-attachment/use-case/create-nodia-ai-attachment.use-case.ts').read_text()
    upload = (ROOT / 'nodia-server/src/nodia-ai-attachment/use-case/upload-nodia-ai-attachment.use-case.ts').read_text()
    check('HTTP_contract_is_raw_PUT', "@Put(':id/content')" in controller and
          "@ApiConsumes('application/octet-stream')" in controller)
    check('backend_intent_still_enforces_dynamic_file_limit',
          'dto.byte_count > this.policy.admission.file_bytes' in create)
    check('backend_stream_still_enforces_reserved_length',
          'BigInt(contentLength) !== BigInt(attachment.reserved_bytes)' in upload and
          'bytes > Number(row.reserved_bytes)' in upload)
    report = {'status': 'passed', 'checks': checks, 'check_count': len(checks),
              'script_sha256': hashlib.sha256(SCRIPT.read_bytes()).hexdigest(),
              'snippet_sha256': hashlib.sha256(snippet).hexdigest(),
              'scope': 'offline_only_no_nginx_or_authenticated_upload_acceptance'}
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
