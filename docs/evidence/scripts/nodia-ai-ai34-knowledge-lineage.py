"""Compare published generated knowledge manifests; no remote/provider requests."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[3]
before = json.loads((root / '.tmp/ai34-knowledge-before-upgrade.json').read_text(encoding='utf-8-sig'))
after = json.loads((root / 'nodia-server/dist/nodia-ai/knowledge/manifest.json').read_text(encoding='utf-8-sig'))
hash_value = lambda value: hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
fragments_equal = before['fragments'] == after['fragments']
contracts_equal = before['capability_contracts'] == after['capability_contracts']
before_docs = {item['document_id']: item for item in before['documents']}
after_docs = {item['document_id']: item for item in after['documents']}
assert before_docs.keys() == after_docs.keys()
changes = []
for identity, item in after_docs.items():
    prior = before_docs[identity]
    assert {key: value for key, value in item.items() if key != 'source_hashes'} == {key: value for key, value in prior.items() if key != 'source_hashes'}
    old_sources = {source['path']: source['sha256'] for source in prior['source_hashes']}
    new_sources = {source['path']: source['sha256'] for source in item['source_hashes']}
    for name in sorted(old_sources.keys() | new_sources.keys()):
        if old_sources.get(name) != new_sources.get(name):
            changes.append({'document_id': identity, 'path': name, 'before_sha256': old_sources.get(name), 'after_sha256': new_sources.get(name)})
assert fragments_equal and contracts_equal
assert len(after['fragments']) == 27 and len(after['capability_contracts']) == 67
assert before['registry_sha256'] == after['registry_sha256']
assert before['contract_schema_sha256'] == after['contract_schema_sha256']
print(json.dumps({'stage': 'AI-34', 'scope': 'generated_published_knowledge_release_lineage', 'status': 'passed', 'before_release': before['release_id'], 'after_release': after['release_id'], 'published_fragments': 27, 'published_fragments_unchanged': True, 'published_fragments_canonical_sha256': hash_value(after['fragments']), 'capability_contracts': 67, 'capability_contracts_unchanged': True, 'capability_contracts_canonical_sha256': hash_value(after['capability_contracts']), 'registry_unchanged': True, 'contract_schema_unchanged': True, 'document_metadata_except_source_hashes_unchanged': True, 'source_hash_changes': changes, 'provider_generations': 0, 'limitations': ['Historical canary reports keep their original pinned releases; this comparison does not claim new real-provider acceptance']}, indent=2))
