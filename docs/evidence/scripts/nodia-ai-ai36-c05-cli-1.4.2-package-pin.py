"""Explicitly authorized public artifact acquisition. Never executes the installer or binary."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
CACHE = ROOT / '.tmp/cache'
DESTINATION = CACHE / 'antigravity-cli-1.4.2-linux-amd64'
MANIFEST = 'https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/linux_amd64.json'
EXPECTED = {'version': '1.4.2',
    'url': 'https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.2-4835981233356800/linux-x64/cli_linux_x64.tar.gz',
    'sha512': '4a393afc1369cee94e817c1b430c9128d02b12ebd4d5703ace5cd47b2333e216d673fb0097cbf7195f757b110163ba9850e9eea3fdbbaddd4b25668b82c03f05'}
MAX_BYTES = 512 * 1024 * 1024


def main():
    assert not DESTINATION.exists(), 'Preserve each artifact acquisition receipt.'
    CACHE.mkdir(parents=True, exist_ok=True)
    ignore = CACHE / '.gitignore'
    if not ignore.exists():
        ignore.write_text('*\n', encoding='utf-8')
    result = subprocess.run(['git', 'check-ignore', str(DESTINATION / 'cli_linux_x64.tar.gz')],
        cwd=ROOT, capture_output=True, check=False)
    assert result.returncode == 0, 'Binary cache must be ignored before acquisition.'
    with urllib.request.urlopen(MANIFEST, timeout=20) as response:
        assert response.url == MANIFEST
        raw = response.read(65537)
        assert len(raw) <= 65536
    assert json.loads(raw) == EXPECTED, 'Do not substitute another release if the live manifest changes.'
    DESTINATION.mkdir(mode=0o700)
    (DESTINATION / 'manifest.received.json').write_bytes(raw)
    package = DESTINATION / 'cli_linux_x64.tar.gz'
    size = 0
    digest = hashlib.sha512()
    with urllib.request.urlopen(EXPECTED['url'], timeout=60) as response, package.open('xb') as output:
        assert response.url == EXPECTED['url']
        length = response.headers.get('Content-Length')
        if length is not None:
            assert length.isdecimal() and 0 < int(length) <= MAX_BYTES
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            assert size <= MAX_BYTES
            digest.update(chunk)
            output.write(chunk)
    assert digest.hexdigest() == EXPECTED['sha512'], 'Pinned official package checksum mismatch.'
    binary = DESTINATION / 'agy-1.4.2-linux.bin'
    with tarfile.open(package, 'r:gz') as archive:
        entries = []
        for entry in archive:
            entries.append(entry)
            assert len(entries) <= 16
            assert entry.isfile() and not entry.issym() and not entry.islnk() and 0 < entry.size <= MAX_BYTES
        assert len(entries) == 1, 'Require the single official CLI payload.'
        with archive.extractfile(entries[0]) as source, binary.open('xb') as output:
            shutil.copyfileobj(source, output)
    assert binary.stat().st_size == entries[0].size
    with binary.open('rb') as source:
        binary_sha512 = hashlib.file_digest(source, 'sha512').hexdigest()
    assert binary.open('rb').read(4) == b'\x7fELF'
    receipt = {'schema_version': 1, 'scope': 'authorized_explicit_1.4.2_public_package_acquisition_no_execution',
        'observed_at_utc': datetime.now(timezone.utc).isoformat(), 'status': 'verified_package_not_executed',
        'manifest_source': MANIFEST, 'manifest_raw_sha256': hashlib.sha256(raw).hexdigest(),
        'manifest': EXPECTED, 'package_bytes': size, 'package_sha512_verified': True,
        'binary_path_relative': binary.relative_to(ROOT).as_posix(), 'binary_bytes': binary.stat().st_size,
        'binary_sha512': binary_sha512, 'binary_digest_scope': 'Computed from the single ELF inside the SHA512-verified package; no separate vendor binary checksum or signature was obtained.',
        'cache_gitignored': True, 'binary_signature_verified': None,
        'source_script_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'installer_executions': 0, 'binary_executions': 0, 'VM_operations': 0, 'profile_access': 0,
        'configured_selection_changes': 0, 'production_source_changes': 0}
    path = ROOT / 'docs/evidence/nodia-ai-ai36-c05-cli-1.4.2-package-pin.json'
    with path.open('x', encoding='utf-8') as output:
        output.write(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
