"""Offline knowledge assembly from an exact exported release; never changes global authoring/build output."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', required=True)
    parser.add_argument('--archive-sha', required=True)
    parser.add_argument('--base-manifest-sha', required=True)
    parser.add_argument('--base-knowledge-release', required=True)
    parser.add_argument('--work', required=True)
    parser.add_argument('--overlay', action='append', default=[], help='Repository-relative production TS path=exact SHA256')
    parser.add_argument('--add-image-binding', help='One explicit explanatory image binding; no capability addition')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    work = (root / args.work).resolve()
    assert work.parent == root / '.tmp' and not work.exists(), 'fresh_tmp_work_required'
    archive = (root / args.archive).resolve()
    assert sha(archive) == args.archive_sha, 'archive_pin_failed'
    server = work / 'nodia-server'
    server.mkdir(parents=True)
    with tarfile.open(archive) as tar:
        seen = set()
        for member in tar.getmembers():
            parts = PurePosixPath(member.name).parts
            assert parts and not PurePosixPath(member.name).is_absolute() and '..' not in parts
            assert member.isdir() or member.isfile(), 'archive_link_or_special_denied'
            assert member.name not in seen, 'archive_duplicate'
            seen.add(member.name)
            assert parts[0] in ['src', 'dist', 'config', 'scripts', 'test'] or (len(parts) == 1 and (parts[0] in ['release-manifest.json', 'package.json', 'package-lock.json', 'nest-cli.json'] or re.fullmatch(r'tsconfig(?:\.[A-Za-z0-9_-]+)?\.json', parts[0]))), 'archive_path_denied'
            target = server.joinpath(*parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                assert member.size <= 16 * 1024 * 1024, 'public_source_member_too_large'
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(tar.extractfile(member).read())
    assert sha(server / 'release-manifest.json') == args.base_manifest_sha, 'base_release_pin_failed'
    release = json.loads((server / 'release-manifest.json').read_bytes())
    for relative, pin in release['files'].items():
        file = server / relative
        if file.is_file():
            expected = pin if isinstance(pin, str) else pin['sha256']
            assert sha(file) == expected, ('exported_file_changed', relative)
    baseline = json.loads((server / 'dist/nodia-ai/knowledge/manifest.json').read_bytes())
    assert baseline['release_id'] == args.base_knowledge_release
    registry_path = server / 'config/nodia-ai-knowledge.registry.json'
    registry_raw = registry_path.read_bytes()
    registry = json.loads(registry_raw)
    overlays = []
    changed_pins = []
    for item in args.overlay:
        relative, expected = item.rsplit('=', 1)
        assert re.fullmatch(r'nodia-server/src/[A-Za-z0-9_./-]+\.ts', relative) and '..' not in PurePosixPath(relative).parts and not relative.endswith('.spec.ts')
        source, target = root / relative, work / relative
        assert target.is_file() and sha(source) == expected
        before = sha(target)
        target.write_bytes(source.read_bytes())
        overlays.append({'path': relative, 'before': before, 'after': expected})
        for cap in registry['capabilities']:
            for row in cap['implementation_sources']:
                if row['path'] == relative:
                    assert row['sha256'] == before
                    changed_pins.append({'capability_id': cap['capability_id'], 'path': relative, 'before': before, 'after': expected})
                    row['sha256'] = expected
    # Preserve original registry formatting/records; replace only exact source rows.
    text = registry_raw.decode('utf-8')
    for change in changed_pins:
        pattern = r'("path":\s*"' + re.escape(change['path']) + r'",\s*"sha256":\s*")' + change['before'] + r'(")'
        text, count = re.subn(pattern, lambda m: m[1] + change['after'] + m[2], text)
        assert count == 1
    assert json.loads(text) == registry
    binding = None
    if args.add_image_binding:
        binding = json.loads((root / args.add_image_binding).read_bytes())
        assert binding['document_id'] == 'nodia-ai.image-generation'
        assert binding['purpose'] == 'feature_explanation'
        assert binding['required_module_routes'] == ['/tools/nodia-ai']
        assert [r['capability_id'] for r in binding['requires']] == ['nodia_attachments_describe']
        assert not any(b['document_id'] == binding['document_id'] for b in registry['bindings'])
        registry['bindings'].append(binding)
        text = json.dumps(registry, ensure_ascii=False, indent=2) + '\n'
    registry_path.write_text(text, encoding='utf-8', newline='\n')
    for cap in registry['capabilities']:
        for row in cap['implementation_sources']:
            assert sha(work / row['path']) == row['sha256'], ('unrelated_implementation_binding_changed', row['path'])
    authoring_only = []
    def copy_reference(relative, draft=False):
        src = (root / relative).resolve()
        assert src.is_relative_to(root) and src.is_file() and not src.is_symlink(), relative
        dst = work / relative
        if dst.exists():
            return
        production_missing = relative.startswith('nodia-server/src/') and not relative.endswith('.spec.ts')
        assert not production_missing or draft, ('approved_reference_missing_from_real_cohort', relative)
        if production_missing:
            authoring_only.append(relative)
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(src.read_bytes())
    for relative in registry['source_paths']:
        copy_reference(relative)
        document = (work / relative).read_text(encoding='utf-8')
        match = re.match(r'^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$', document)
        assert match, relative
        metadata = json.loads(match[1])
        refs = [s['path'] for s in metadata['sources']] + metadata['verification']['evidence_paths']
        if metadata['approval']:
            refs.append(metadata['approval']['reference'])
        for ref in refs:
            copy_reference(ref, metadata['document_status'] != 'approved')
        for link in re.finditer(r'\[[^\]\n]+\]\(([^)\n]+)\)', match[2]):
            value = link[1].strip('<>').split('#')[0]
            if not value or re.match(r'^https?://', value):
                continue
            resolved = (root / Path(relative).parent / value).resolve()
            assert resolved.is_relative_to(root)
            copy_reference(resolved.relative_to(root).as_posix(), metadata['document_status'] != 'approved')
    for cap in registry['capabilities']:
        for kind in ['input_schema', 'output_schema']:
            copy_reference(cap[kind]['path'])
        for ref in cap['evidence_paths']:
            copy_reference(ref)
    for ref in ['docs/mvp/nodia-ai-v1-common-contracts.schema.json', 'docs/mvp/52-nodia-ai-ai06-knowledge-publication-contract.md', 'docs/architecture/decisions/ADR-038-nodia-ai-compiled-knowledge-contract.md', 'docs/nodia-ai/knowledge/_templates/product.md', 'docs/nodia-ai/knowledge/_templates/feature.md']:
        copy_reference(ref)
    dependencies = root / 'nodia-server/node_modules'
    if os.name == 'nt':
        quoted = lambda p: str(p).replace("'", "''")
        subprocess.run(['powershell', '-NoProfile', '-Command', f"New-Item -ItemType Junction -Path '{quoted(server / 'node_modules')}' -Target '{quoted(dependencies)}' | Out-Null"], check=True, capture_output=True)
    else:
        (server / 'node_modules').symlink_to(dependencies, target_is_directory=True)
    steps = []
    for command in [['node', 'scripts/build-nodia-ai-knowledge.mjs', '--check'], ['node', 'scripts/build-nodia-ai-knowledge.mjs'], ['node', 'scripts/build-nodia-ai-context.mjs', '--prepare'], ['node', 'scripts/build-nodia-ai-context.mjs']]:
        result = subprocess.run(command, cwd=server, capture_output=True, encoding='utf-8', timeout=90)
        assert result.returncode == 0, result.stderr.strip()
        steps.append(json.loads(result.stdout.strip().splitlines()[-1]))
    current = json.loads((server / 'dist/nodia-ai/knowledge/manifest.json').read_bytes())
    strip = lambda rows, key: [{k: v for k, v in row.items() if k != key} for row in rows]
    assert strip(current['capability_contracts'], 'implementation_sources') == strip(baseline['capability_contracts'], 'implementation_sources')
    old_docs = {d['document_id']: d for d in baseline['documents']}
    for document in current['documents']:
        if document['document_id'] in old_docs:
            assert {k: v for k, v in document.items() if k != 'source_hashes'} == {k: v for k, v in old_docs[document['document_id']].items() if k != 'source_hashes'}
    old_fragments = {(f['document_id'], f['fragment_id']): f for f in baseline['fragments']}
    for fragment in current['fragments']:
        key = (fragment['document_id'], fragment['fragment_id'])
        if key in old_fragments:
            assert fragment == old_fragments[key]
        else:
            assert binding and fragment['document_id'] == 'nodia-ai.image-generation'
    approved = root / 'docs/nodia-ai/knowledge/nodia-ai/features/invoice-ocr-product-comparison.md'
    assert sha(approved) == '9d93844d136b9aa056bdffdf5be60495fa474d06de08a911d53dfba6f2e33a6f'
    files = []
    for relative in ['config/nodia-ai-knowledge.registry.json', 'src/nodia-ai/knowledge/manifest.json', 'dist/nodia-ai/knowledge/manifest.json', 'src/nodia-ai-context/config/knowledge-pin.json', 'dist/nodia-ai-context/config/knowledge-pin.json']:
        src, dst = server / relative, work / 'deployment' / relative
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(src.read_bytes())
        files.append({'path': relative, 'sha256': sha(dst), 'bytes': dst.stat().st_size})
    if binding:
        for fragment in current['fragments']:
            if (fragment['document_id'], fragment['fragment_id']) not in old_fragments:
                relative = fragment['asset_path']
                for area in ['src', 'dist']:
                    src = server / area / 'nodia-ai/knowledge' / relative
                    dst = work / 'deployment' / area / 'nodia-ai/knowledge' / relative
                    dst.parent.mkdir(parents=True, exist_ok=True); dst.write_bytes(src.read_bytes())
                    files.append({'path': dst.relative_to(work / 'deployment').as_posix(), 'sha256': sha(dst), 'bytes': dst.stat().st_size})
    report = {'status': 'selective_knowledge_assembled', 'base_source_manifest_sha256': args.base_manifest_sha, 'base_knowledge_release': baseline['release_id'], 'release_id': current['release_id'],
        'capabilities': len(current['capability_contracts']), 'schema_references': 2 * len(current['capability_contracts']), 'fragments': len(current['fragments']), 'documents': len(current['documents']),
        'overlays': overlays, 'changed_implementation_pins': changed_pins, 'binding_added': binding is not None, 'existing_contracts_fragments_approved_contents_unchanged': True,
        'approved_OCR_sha256': sha(approved), 'authoring_only_excluded_from_runtime_or_TS_compilation': authoring_only, 'build_steps': steps, 'files': files,
        'limits': ['Offline knowledge only; no VM, SDK, inference or production TS build.', 'Only deployment/ output is a payload; never copy staged authoring-only source references or global authoring bundle.']}
    (work / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(report, ensure_ascii=False))

if __name__ == '__main__':
    main()
