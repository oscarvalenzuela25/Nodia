from pathlib import Path
from urllib.parse import unquote
import json
import re

root = Path(__file__).resolve().parents[1]
files = [
    'docs/mvp/README.md', 'docs/mvp/00-progress.md',
    'docs/mvp/45-nodia-ai-implementation-plan.md',
    'docs/mvp/78-nodia-ai-ai32-attachments-voice.md',
    'docs/nodia-ai/knowledge/README.md',
    'docs/nodia-ai/knowledge/nodia-ai/README.md',
    'docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md',
    'docs/architecture/decisions/ADR-057-nodia-ai-attachment-lifecycle.md',
    'nodia-gemini-microservice/README.md',
]
links = 0
for relative in files:
    path = root / relative
    text = path.read_text(encoding='utf-8')
    assert 'R03' in text, relative
    for target in re.findall(r'\]\(([^)]+)\)', text):
        if 'r03' not in target.lower():
            continue
        target = target.split('#', 1)[0]
        if target:
            resolved = (path.parent / unquote(target)).resolve()
            assert resolved.is_file(), (relative, target)
            links += 1
for relative, revision in [
    ('docs/nodia-ai/knowledge/nodia-ai/README.md', 28),
    ('docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md', 4),
]:
    text = (root / relative).read_text(encoding='utf-8')
    metadata = json.loads(text[4:].split('\n---\n', 1)[0])
    assert metadata['document_status'] == 'draft'
    assert metadata['integration_status'] == 'unregistered'
    assert metadata['approval'] is None
    assert metadata['revision'] == revision
    for evidence in metadata['verification']['evidence_paths']:
        assert (root / evidence).is_file(), evidence
plan = (root / files[2]).read_text(encoding='utf-8')
assert '- [ ] **AI-32 ' in plan
print(json.dumps({'stage': 'AI-32-R03', 'status': 'passed',
    'documents': len(files), 'r03_local_links_checked': links,
    'draft_approvals_preserved': True, 'ai32_acceptance_checkbox_open': True}))
