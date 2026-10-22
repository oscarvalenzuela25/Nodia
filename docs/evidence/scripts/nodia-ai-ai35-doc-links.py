"""Check repository-relative Markdown file targets offline; anchors are outside this check."""
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote

root = Path(__file__).resolve().parents[3]
directories = sys.argv[1:] or ['docs/mvp', 'docs/features', 'docs/nodia-ai', 'docs/architecture', 'docs/evidence']
checked = 0
files = set()
missing = []
for relative in directories:
    source = (root / relative).resolve()
    assert source.is_relative_to(root) and source.exists()
    files.update(source.rglob('*.md') if source.is_dir() else [source])
for source in sorted(files):
    fenced = False
    fence = None
    for line_number, line in enumerate(source.read_text(encoding='utf-8-sig').splitlines(), 1):
        match = re.match(r'^\s*(`{3,}|~{3,})', line)
        if match:
            if not fenced:
                fence, fenced = match[1][0], True
            elif match[1][0] == fence:
                fenced = False
            continue
        if fenced:
            continue
        targets = [match[1].strip('<>') for match in re.finditer(r'!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)', line)]
        reference = re.match(r'^\s*\[[^\]]+\]:\s*(<[^>]+>|[^\s]+)', line)
        if reference:
            targets.append(reference[1].strip('<>'))
        for target in targets:
            if target.startswith(('#', '//')) or re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target):
                continue
            local = unquote(target.split('#', 1)[0].split('?', 1)[0])
            if not local:
                continue
            local = re.sub(r':\d+$', '', local)
            destination = (root / local.lstrip('/')) if local.startswith('/') else source.parent / local
            checked += 1
            if not destination.exists():
                missing.append({'source': source.relative_to(root).as_posix(), 'line': line_number, 'target': target})
print(json.dumps({'stage': 'AI-35', 'scope': 'offline_markdown_repository_relative_file_targets', 'status': 'passed' if not missing else 'failed', 'directories': directories, 'markdown_files': len(files), 'local_file_targets_checked': checked, 'missing_targets': missing, 'external_requests': 0, 'limitations': ['Does not validate fragment anchors, remote URLs, JavaScript, or rendered browser navigation']}, indent=2))
if missing:
    raise SystemExit(1)

