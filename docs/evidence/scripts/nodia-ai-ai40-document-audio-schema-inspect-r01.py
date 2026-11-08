"""Read only pinned public Codex protocol artifacts; never construct a runtime.

No CLI/account/model/turn request, profile read, credential, database or service
operation. The retained schemas were exported offline by the same pinned ELF.
"""
from pathlib import Path
import hashlib
import json


def sha(data):
    return hashlib.sha256(data).hexdigest()


BINARY = Path('/opt/nodia/nodia-server/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex')
BINARY_SHA = '9a820c17865fa825d04db416818679a9d63bd72e50835c396f496e5684626c9c'
assert BINARY.is_file() and not BINARY.is_symlink() and sha(BINARY.read_bytes()) == BINARY_SHA
roots = [
    (Path('/opt/nodia/verification/ai39-native-protocol-r01/schemas'),
     '5166c32910f3716024fc1b1e4107bb6992dd7a499b54447e907e72d07d365ae9'),
    (Path('/opt/nodia/verification/ai39-experimental-protocol-r02/schemas'),
     '8256cbaac59b86eaa64394cee94291cc78de95780dc650c4953fde396619c01e'),
]
results = []
for root, pin in roots:
    assert root.is_dir() and not root.is_symlink()
    files = sorted(root.rglob('*.json'))
    assert all(p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(root) for p in files)
    manifest = [{'path': str(p.relative_to(root)), 'sha256': sha(p.read_bytes()), 'bytes': p.stat().st_size} for p in files]
    assert sha(json.dumps(manifest, sort_keys=True).encode()) == pin
    schemas = {str(p.relative_to(root)): json.loads(p.read_bytes()) for p in files}
    client = schemas['ClientRequest.json']
    methods = {}
    for variant in client['oneOf']:
        fields = variant.get('properties', {})
        for name in fields.get('method', {}).get('enum', []):
            methods[name] = fields.get('params')
    turn = schemas['v2/TurnStartParams.json']
    selected = {}
    for name, schema in schemas.items():
        if any(word in name.lower() for word in ('audio', 'transcri', 'realtime', 'inject')):
            selected[name] = {'sha256': next(item['sha256'] for item in manifest if item['path'] == name),
                              'schema': schema}
    results.append({'root': str(root), 'schema_files': len(files), 'schema_manifest_sha256': pin,
                    'turn_start_schema_sha256': sha((root / 'v2/TurnStartParams.json').read_bytes()),
                    'user_input': turn['definitions']['UserInput'],
                    'turn_start_required': turn['required'],
                    'turn_start_input_property': turn['properties']['input'],
                    'audio_realtime_transcription_methods': {name: value for name, value in methods.items()
                        if any(word in name.lower() for word in ('audio', 'transcri', 'realtime'))},
                    'file_related_methods': {name: value for name, value in methods.items() if 'file' in name.lower()},
                    'inject_methods': {name: value for name, value in methods.items() if 'inject' in name.lower()},
                    'raw_content_definitions': {name: value for name, value in client.get('definitions', {}).items()
                        if name in ('RawResponseItem', 'ContentItem', 'ResponseItem', 'FunctionCallOutputBody')},
                    'audio_realtime_transcription_schemas': selected})
release = Path('/opt/nodia/releases/nodia-server-ai40-r05')
assert sha((release / 'release-manifest.json').read_bytes()) == '07b83a30d4721dba1d1ca34d0b083868b5a8b64369d8ac853d389434f73a76cd'
packages = {}
for name in ('codex', 'codex-linux-x64'):
    path = Path('/opt/nodia/nodia-server/node_modules/@openai') / name / 'package.json'
    value = json.loads(path.read_bytes())
    packages[name] = {'version': value['version'], 'package_manifest_sha256': sha(path.read_bytes())}
print(json.dumps({'schema': 'nodia-ai-ai40-document-audio-schema-inspection-v1', 'status': 'passed',
                  'source_sha256': sha(Path(__file__).read_bytes()), 'binary_path': str(BINARY), 'binary_sha256': BINARY_SHA,
                  'active_release_pin_read': str(release), 'packages': packages, 'bundles': results,
                  'cli_processes': 0, 'provider_observations': 0, 'provider_generations': 0,
                  'profile_reads': 0, 'SQL_writes': 0, 'service_changes': 0}))
