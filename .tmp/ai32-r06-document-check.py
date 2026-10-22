import json
import re
from pathlib import Path
from urllib.parse import unquote

root = Path(__file__).resolve().parent.parent
files = [
 'docs/mvp/README.md', 'docs/mvp/00-progress.md', 'docs/mvp/45-nodia-ai-implementation-plan.md',
 'docs/mvp/78-nodia-ai-ai32-attachments-voice.md', 'docs/mvp/vps-local-vm-lab.md',
 'docs/architecture/decisions/ADR-057-nodia-ai-attachment-lifecycle.md',
 'docs/nodia-ai/knowledge/README.md', 'docs/nodia-ai/knowledge/nodia-ai/README.md',
 'docs/nodia-ai/knowledge/nodia-ai/features/attachments-and-voice.md', 'docs/mvp/68-nodia-ai-ai22-business-operations.md', 'docs/nodia-ai/knowledge/businesses/features/confirmed-business-effects.md',
]
def slug(text):
    text = re.sub(r'<[^>]+>', '', text).lower()
    text = re.sub(r'[^\w\s-]', '', text)
    return text.replace(' ', '-')
checked = 0
for file in files:
    path = root / file
    source = path.read_text(encoding='utf-8')
    assert '\ufffd' not in source, file
    if '/knowledge/nodia-ai/' in file or '/knowledge/businesses/features/' in file:
        metadata = json.loads(source.split('---', 2)[1])
        assert metadata['approval'] is None and metadata['document_status'] == 'draft'
        assert metadata['integration_status'] == 'unregistered'
        for evidence in metadata['verification']['evidence_paths']:
            assert (root / evidence).is_file(), evidence
    for value in re.findall(r'\]\(([^)]+)\)', source):
        if 'r06' not in value.lower() or value.startswith(('http:', 'https:')):
            continue
        link, _, anchor = unquote(value).partition('#')
        target = (path.parent / link).resolve() if link else path
        assert target.is_file(), (file, value)
        if anchor:
            headings = re.findall(r'^#{1,6}\s+(.+)$', target.read_text(encoding='utf-8'), re.M)
            assert anchor in [slug(heading) for heading in headings], (file, value)
        checked += 1
plan = (root / files[2]).read_text(encoding='utf-8')
assert '- [ ] **AI-32 —' in plan
assert '> Estado: propuesto' in (root / files[5]).read_text(encoding='utf-8')
print(json.dumps({'stage':'AI-32-R06','documents':len(files),'r06_links_checked':checked,
 'status':'passed','document_approval_changed':False,'ai32_acceptance_checkbox_open':True}))
