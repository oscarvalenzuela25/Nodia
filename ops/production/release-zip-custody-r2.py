#!/usr/bin/env python3
"""Publish and verify age deployment archives in the dedicated OPS-05 R2 bucket."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile


BUCKET = 'nodia-ops05-release-custody'
PREFIX = 'ops05/v1'
CATALOG = 'catalog.json'
AGE_HEADER = b'age-encryption.org/v1\n'
MAX_OBJECT = 300 * 1024 * 1024  # Wrangler's remote single-PUT limit.
MISSING_KEY = re.compile(r'^\s*(?:[Xx✘✖]\s*)?(?:\[ERROR\]\s*)?The specified key does not exist\.\s*$', re.M)
TERMINAL_STYLE = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')

_spec = importlib.util.spec_from_file_location('release_zip_custody', Path(__file__).with_name('release-zip-custody.py'))
custody = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(custody)


@dataclass(frozen=True)
class SealedObject:
    filename: str
    size: int | None
    sha256: str

    @property
    def is_catalog(self):
        return self.filename == CATALOG


class Wrangler:
    def __init__(self, cli, account_id, catalog_sha256, workspace):
        custody.require(cli.is_absolute() and cli.is_file(), 'an absolute Wrangler CLI path is required')
        self.cli = str(cli)
        self.catalog_sha256 = catalog_sha256
        self.workspace = workspace
        self.environment = dict(os.environ, WRANGLER_SEND_METRICS='false', NO_COLOR='1')
        if account_id is not None:
            custody.require(re.fullmatch('[0-9a-f]{32}', account_id), 'invalid Cloudflare account ID')
            self.environment['CLOUDFLARE_ACCOUNT_ID'] = account_id

    def request(self, action, entry, path, *, allow_missing=False):
        key = f'{BUCKET}/{PREFIX}/{self.catalog_sha256}/{entry.filename}'
        command = ['node', self.cli, 'r2', 'object', action, key, '--remote', '--file', str(path)]
        if action == 'put':
            media_type = 'application/json' if entry.is_catalog else 'application/octet-stream'
            command.extend(['--content-type', media_type, '--cache-control', 'no-store'])
        result = subprocess.run(command, cwd=self.workspace, env=self.environment, stdin=subprocess.DEVNULL,
                                capture_output=True, encoding='utf-8', errors='replace', timeout=600, check=False)
        if result.returncode:
            diagnostic = TERMINAL_STYLE.sub('', result.stderr + '\n' + result.stdout)
            if action == 'get' and allow_missing and MISSING_KEY.search(diagnostic):
                return False
            match = re.search(r'Failed to fetch [^\n]+ - (\d{3}):', diagnostic)
            status = f' (HTTP {match[1]})' if match else ''
            raise RuntimeError(f'Wrangler {action.upper()} failed for {entry.filename}{status}')
        custody.require(action != 'get' or path.is_file(), f'Wrangler GET did not produce {entry.filename}')
        return True


def canonical_dir(path):
    absolute = path.absolute()
    custody.require(absolute.is_dir() and absolute.resolve(strict=True) == absolute,
                    'an existing canonical working directory is required')
    return absolute


def private_output(path):
    target = canonical_dir(path.parent) / path.name
    target.mkdir(mode=0o700)
    if os.name == 'posix':
        custody.require(stat.S_IMODE(target.stat().st_mode) == 0o700, 'private download directory required')
    return target


def verify_file(path, entry, destination=None):
    size = path.lstat().st_size
    limit = custody.MAX_CATALOG if entry.is_catalog else MAX_OBJECT
    custody.require(0 < size <= limit and (entry.size is None or size == entry.size),
                    f'wrong object size for {entry.filename}')
    with custody.regular_source(path, size) as source:
        if not entry.is_catalog:
            custody.require(source.read(len(AGE_HEADER)) == AGE_HEADER, f'age ciphertext required for {entry.filename}')
            source.seek(0)
        custody.require(custody.digest(source, destination) == (size, entry.sha256),
                        f'wrong SHA-256 for {entry.filename}')
    return size


def catalog_objects(path, expected_sha256):
    catalog = SealedObject(CATALOG, None, expected_sha256)
    size = verify_file(path, catalog)
    raw = custody.read_json(path, expected_sha256)
    rows = raw['originals']
    custody.require(set(raw) == {'schema_version', 'encryption', 'recipient', 'created_at', 'originals'}
                    and type(raw['schema_version']) is int and raw['schema_version'] == 1
                    and raw['encryption'] == 'age-v1-x25519' and custody.RECIPIENT.fullmatch(raw['recipient'])
                    and datetime.fromisoformat(raw['created_at']).tzinfo is not None
                    and isinstance(rows, list) and rows, 'unsupported custody catalog')
    objects = []
    artifact_ids = set()
    for row in rows:
        record = custody.original_record(row)
        name = custody.cipher_name(record)
        cipher_size = row['cipher_bytes']
        custody.require(set(row) == set(record) | {'cipher_file', 'cipher_bytes', 'cipher_sha256'}
                        and row['cipher_file'] == name and type(cipher_size) is int
                        and record['size_bytes'] < cipher_size <= min(MAX_OBJECT, record['size_bytes'] + custody.MAX_CATALOG)
                        and custody.HEX.fullmatch(row['cipher_sha256']), 'invalid ciphertext receipt')
        custody.require(record['artifact_id'] not in artifact_ids, 'duplicate artifact in custody catalog')
        artifact_ids.add(record['artifact_id'])
        objects.append(SealedObject(name, cipher_size, row['cipher_sha256']))
    return SealedObject(CATALOG, size, expected_sha256), objects


def upload(args, remote):
    source = canonical_dir(args.source)
    catalog, objects = catalog_objects(source / CATALOG, args.catalog_sha256)
    entries = [*objects, catalog]
    custody.require({path.name for path in source.iterdir()} == {entry.filename for entry in entries},
                    'upload source must contain only the trusted catalog and its ciphertexts')
    # Check every local object before the first remote mutation.
    for entry in entries:
        verify_file(source / entry.filename, entry)

    readback = private_output(args.readback) if args.readback is not None else None

    def publish(entry):
        with tempfile.TemporaryDirectory(prefix='object-', dir=remote.workspace) as directory:
            work = Path(directory)
            incoming = work / 'received'
            missing = not remote.request('get', entry, incoming, allow_missing=True)
            if missing:
                # Stage only bytes that matched the trusted receipt, even if the original file is modified later.
                staged = work / entry.filename
                with staged.open('xb') as destination:
                    verify_file(source / entry.filename, entry, destination)
                remote.request('put', entry, staged)
                incoming = work / 'received-after-write'
                remote.request('get', entry, incoming)
            if readback is None:
                verify_file(incoming, entry)
            else:
                with custody.staged_output(readback / entry.filename) as scratch:
                    with scratch.open('wb') as output:
                        verify_file(incoming, entry, output)
                        output.flush()
                        os.fsync(output.fileno())
        print(f'R2 verified {entry.filename}', file=sys.stderr)
        return int(missing)

    uploaded = 0
    with ThreadPoolExecutor(max_workers=args.jobs) as workers:
        for offset in range(0, len(objects), args.jobs):
            uploaded += sum(workers.map(publish, objects[offset:offset + args.jobs]))
    uploaded += publish(catalog)
    return {'status': 'published_and_verified', 'uploaded': uploaded, 'already_verified': len(entries) - uploaded,
            'ciphertexts': len(objects), 'readback_saved': readback is not None}


def download(args, remote):
    target = private_output(args.out)
    catalog = SealedObject(CATALOG, None, args.catalog_sha256)
    # Keep the catalog unpublished until all ciphertexts have been authenticated by digest.
    with custody.staged_output(target / CATALOG) as scratch:
        remote.request('get', catalog, scratch)
        _, objects = catalog_objects(scratch, args.catalog_sha256)
        for entry in objects:
            with custody.staged_output(target / entry.filename) as encrypted:
                remote.request('get', entry, encrypted)
                verify_file(encrypted, entry)
            print(f'R2 verified {entry.filename}', file=sys.stderr)
    return {'status': 'downloaded_and_verified', 'ciphertexts': len(objects)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--wrangler-cli', required=True, type=Path)
    parser.add_argument('--account-id')
    parser.add_argument('--catalog-sha256', required=True)
    actions = parser.add_subparsers(dest='action', required=True)
    publisher = actions.add_parser('upload')
    publisher.add_argument('--source', required=True, type=Path)
    publisher.add_argument('--readback', type=Path, help='save R2-verified bytes in a new private directory')
    publisher.add_argument('--jobs', type=int, choices=range(1, 4), default=1)
    actions.add_parser('download').add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    try:
        custody.require(custody.HEX.fullmatch(args.catalog_sha256), 'invalid trusted catalog SHA-256')
        parent = args.source.parent if args.action == 'upload' else args.out.parent
        with tempfile.TemporaryDirectory(prefix='.ops05-r2-', dir=canonical_dir(parent)) as directory:
            remote = Wrangler(args.wrangler_cli, args.account_id, args.catalog_sha256, Path(directory))
            result = upload(args, remote) if args.action == 'upload' else download(args, remote)
        print(json.dumps(dict(result, bucket=BUCKET, catalog_sha256=args.catalog_sha256), separators=(',', ':')))
    except (OSError, RuntimeError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as error:
        print(error if not isinstance(error, subprocess.TimeoutExpired) else 'Wrangler request timed out', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
