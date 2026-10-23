"""Assemble an exact local COPY-only diagnostic archive; never connects to VM."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile

ROOT = Path(__file__).resolve().parents[3]
BASE_REPORT = ROOT / 'docs/evidence/nodia-ai-ai38-profile-reservation-fix-build-r01.json'
BASE_REPORT_SHA = '9c4d6f597018fda0660cccc8df501d61430b88de743d06fdeac443c793780e7d'
BASE_ARCHIVE = ROOT / '.tmp/ai38-profile-reservation-fix-build-r01.tar'
BASE_ARCHIVE_SHA = '8a6fa83f2dc6b34f573ef1664d33bf09b1ae555b62ba6b8c8ba91db4737be085'
IMAGE = 'sha256:073f319ffa35c75d82be379a2d6d0d48a1c760b7f37103c8194120e51d71660e'
EPOCH = dict(id='9b07866b018c51efcb481a47fa8d81ef94b98dab430c1535b54b5d098488f267',
             image=IMAGE, started_at='2026-10-22T19:48:35.342867871Z')
LABEL = 'ai38-web-stream-diag-build-r01'
SOURCES = ('web_generation_diagnostics.py', 'web_stream_frame_diagnostics.py')


def sha(value):
    return hashlib.sha256(value).hexdigest()


def main(names):
    assert names and len(names) == len(set(names))
    assert all(re.fullmatch(r'test_web_[a-z_]+\.py', name) for name in names)
    assert sha(BASE_REPORT.read_bytes()) == BASE_REPORT_SHA
    assert sha(BASE_ARCHIVE.read_bytes()) == BASE_ARCHIVE_SHA
    base = json.loads(BASE_REPORT.read_bytes())
    assert base['status'] == 'passed' and base['candidate_image_id'] == IMAGE
    assert len(base['target_public_python_hashes']) == 47
    assert SOURCES[0] in base['target_public_python_hashes'] and SOURCES[1] not in base['target_public_python_hashes']
    with tarfile.open(BASE_ARCHIVE) as old:
        manifest = json.load(old.extractfile('manifest.json'))
        tests = {name: old.extractfile('tests/' + name).read() for name in manifest['test_files']}
    assert all(sha(tests[name]) == pin for name, pin in manifest['test_files'].items())
    assert not (set(names) & set(tests)), 'existing_frozen_test_replacement_forbidden'
    source_root = ROOT / 'nodia-gemini-microservice'
    sources = {name: (source_root / name).read_bytes() for name in SOURCES}
    assert sha(sources[SOURCES[0]]) != base['target_public_python_hashes'][SOURCES[0]]
    tests.update({name: (source_root / 'tests' / name).read_bytes() for name in names})
    dockerfile = ('FROM ' + IMAGE + '\nCOPY ' + ' '.join(sorted(SOURCES)) + ' /app/\n').encode()
    descriptor = dict(phase='diag', label=LABEL, base_image_id=IMAGE,
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
