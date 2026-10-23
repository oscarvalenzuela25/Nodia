"""Assemble an exact local COPY-only diagnostic archive; never connects to VM."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile

ROOT = Path(__file__).resolve().parents[3]
BASE_REPORT = ROOT / 'docs/evidence/nodia-ai-ai38-web-stream-build-r01.json'
BASE_REPORT_SHA = '4d39acc22f94fbae9266fbc49b1bed47661f92a38898684a906602d5e0348d8a'
BASE_ARCHIVE = ROOT / '.tmp/ai38-web-stream-diag-build-r01.tar'
BASE_ARCHIVE_SHA = 'd12d51db4b8e5db76ec4762fea4c17506665e5a8e14eae2a2d9fd40c7e5752da'
IMAGE = 'sha256:985ba983fec5789671ceaa53c98103fbbf5b81c07938e6d10b2099034e2c0306'
EPOCH = dict(id='b20db84410938175ca00002b56ec3fef9b894af1399413b2fabbbbd36bcfab96',
             image=IMAGE, started_at='2026-10-22T21:25:38.245485678Z')
LABEL = 'ai38-web-stream-recovery-fix-build-r01'
SOURCES = ('gemini_service.py', 'nodia_ai_chat.py', 'web_chat_recovery.py')


def sha(value):
    return hashlib.sha256(value).hexdigest()


def main(names):
    assert names and len(names) == len(set(names))
    assert all(re.fullmatch(r'test_web_[a-z_]+\.py', name) for name in names)
    assert sha(BASE_REPORT.read_bytes()) == BASE_REPORT_SHA
    assert sha(BASE_ARCHIVE.read_bytes()) == BASE_ARCHIVE_SHA
    base = json.loads(BASE_REPORT.read_bytes())
    assert base['status'] == 'passed' and base['candidate_image_id'] == IMAGE
    assert len(base['target_public_python_hashes']) == 48
    assert set(SOURCES[:2]) <= set(base['target_public_python_hashes']) and SOURCES[2] not in base['target_public_python_hashes']
    with tarfile.open(BASE_ARCHIVE) as old:
        manifest = json.load(old.extractfile('manifest.json'))
        tests = {name: old.extractfile('tests/' + name).read() for name in manifest['test_files']}
    assert all(sha(tests[name]) == pin for name, pin in manifest['test_files'].items())
    assert not (set(names) & set(tests)), 'existing_frozen_test_replacement_forbidden'
    source_root = ROOT / 'nodia-gemini-microservice'
    sources = {name: (source_root / name).read_bytes() for name in SOURCES}
    old_chat = (ROOT / '.tmp/ai38-web-stream-recovery-live-chat-r01.py').read_bytes()
    assert sha(old_chat) == base['target_public_python_hashes']['nodia_ai_chat.py']
    anchor = b'                            preserve_structured_text=True,\r\n'
    assert old_chat.count(anchor) == 1
    sources['nodia_ai_chat.py'] = old_chat.replace(anchor, anchor + b'                            chat_budget_seconds=request.timeout_seconds,\r\n')
    assert sources['nodia_ai_chat.py'] == (ROOT / '.tmp/ai38-web-stream-recovery-overlay-chat-r01.py').read_bytes()
    assert sha(sources[SOURCES[0]]) != base['target_public_python_hashes'][SOURCES[0]]
    tests.update({name: (source_root / 'tests' / name).read_bytes() for name in names})
    dockerfile = ('FROM ' + IMAGE + '\nCOPY ' + ' '.join(sorted(SOURCES)) + ' /app/\n').encode()
    descriptor = dict(phase='fix', label=LABEL, base_image_id=IMAGE,
        expected_operational_epoch=EPOCH, base_public_python_hashes=base['target_public_python_hashes'],
        image_sources={name: sha(payload) for name, payload in sources.items()},
        test_files={name: sha(payload) for name, payload in sorted(tests.items())},
        historic_test_manifest_sha256=base['manifest_sha256'], historic_test_sources=len(manifest['test_files']),
        added_diagnostic_test_sources=len(names), dockerfile_sha256=sha(dockerfile))
    payload = (json.dumps(descriptor, indent=2) + '\n').encode()
    destination = ROOT / '.tmp' / (LABEL + '.tar')
    with destination.open('xb') as stream, tarfile.open(fileobj=stream, mode='w') as archive:
        members = {'manifest.json': payload, 'context/Dockerfile': dockerfile}
        members.update({'context/' + name: body for name, body in sources.items()})
        members.update({'tests/' + name: body for name, body in tests.items()})
        for name, body in sorted(members.items()):
            info = tarfile.TarInfo(name)
            info.size, info.mode, info.mtime = len(body), 0o644, 0
            archive.addfile(info, io.BytesIO(body))
    print(json.dumps(dict(archive=str(destination), archive_sha256=sha(destination.read_bytes()),
        manifest_sha256=sha(payload), image_sources=descriptor['image_sources'],
        frozen_tests=len(manifest['test_files']), added_tests=len(names), VM_changes=0,
        provider_requests=0), indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--test', action='append', required=True)
    main(parser.parse_args().test)
