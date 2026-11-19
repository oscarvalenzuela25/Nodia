#!/usr/bin/env python3
"""Seal original deployment ZIPs with age and restore them into a private workspace."""

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import tempfile
import zipfile


CHUNK = 1024 * 1024
MAX_ZIP = 768 * CHUNK
MAX_CATALOG = 8 * CHUNK
MAX_MANIFEST = 16 * CHUNK
HEX = re.compile(r'[0-9a-f]{64}')
ARTIFACT = re.compile(r'[1-9][0-9]{0,19}')
RECIPIENT = re.compile(r'age1[023456789acdefghjklmnpqrstuvwxyz]{58}')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_object(items):
    result = dict(items)
    require(len(items) == len(result), 'JSON contains duplicate keys')
    return result


def read_json(path, expected_sha256=None):
    with path.open('rb') as source:
        raw = source.read(MAX_CATALOG + 1)
    require(len(raw) <= MAX_CATALOG, 'catalog exceeds size limit')
    if expected_sha256 is not None:
        require(hashlib.sha256(raw).hexdigest() == expected_sha256, 'catalog digest differs from the custody receipt')
    return json.loads(raw, object_pairs_hook=unique_object)


def digest(source, destination=None):
    checksum = hashlib.sha256()
    count = 0
    while block := source.read(CHUNK):
        checksum.update(block)
        count += len(block)
        if destination is not None:
            destination.write(block)
    return count, checksum.hexdigest()


@contextmanager
def regular_source(path, size):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_size == size and path.resolve(strict=True) == path.absolute(),
            f'unexpected source file {path.name}')
    with path.open('rb') as source:
        opened = os.fstat(source.fileno())

        def identity(item):
            return item.st_dev, item.st_ino, item.st_size, item.st_mtime_ns

        require(identity(opened) == identity(info), 'source changed while opening')
        yield source
        descriptor, location = os.fstat(source.fileno()), path.lstat()
        require(identity(descriptor) == identity(location) == identity(info)
                and descriptor.st_ctime_ns == opened.st_ctime_ns and location.st_ctime_ns == info.st_ctime_ns,
                'source changed while reading')


@contextmanager
def staged_output(target):
    require(target.parent.is_dir() and target.parent.resolve() == target.parent.absolute(),
            'existing canonical destination directory required')
    require(not os.path.lexists(target), f'destination exists {target.name}')
    with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.ops05-', delete=False) as temporary:
        scratch = Path(temporary.name)
    try:
        yield scratch
        os.link(scratch, target)
    finally:
        scratch.unlink()


def original_record(record):
    artifact = record['artifact_id']
    require(isinstance(artifact, str) and ARTIFACT.fullmatch(artifact), 'invalid artifact ID')
    require(all(isinstance(record[name], str) and HEX.fullmatch(record[name]) for name in
                ('sha256', 'tar_sha256', 'manifest_sha256', 'tree_sha256')), 'invalid original digest')
    size = record['size_bytes']
    require(type(size) is int and 0 < size <= MAX_ZIP, 'invalid original size')
    run_id, attempt, source_sha = (record[name] for name in ('run_id', 'run_attempt', 'source_sha'))
    require(ARTIFACT.fullmatch(run_id) and ARTIFACT.fullmatch(attempt) and re.fullmatch('[0-9a-f]{40}', source_sha),
            'invalid run provenance')
    expected_release = f"backend-{source_sha[:12]}-{record['tree_sha256'][:12]}"
    require(record['release_id'] == expected_release, 'release does not match its source and tree')
    path = PurePosixPath(record['path'])
    require(path.parent.parent in (PurePosixPath('/var/lib/nodia-updates/incoming'),
                                   PurePosixPath('/var/lib/nodia-updates/archived-incoming')) and
            path.parent.name == f'server-{run_id}-{attempt}' and path.name == f'{artifact}.zip' and
            str(path) == record['path'], 'invalid original path')
    return {name: record[name] for name in (
        'artifact_id', 'path', 'sha256', 'size_bytes', 'release_id', 'run_id', 'run_attempt', 'source_sha',
        'tar_sha256', 'manifest_sha256', 'tree_sha256',
    )}


def cipher_name(record):
    return f"{record['artifact_id']}-{record['sha256']}.zip.age"


def seal(args):
    inventory = read_json(args.inventory)
    require(inventory['snapshot_unchanged'] is True and inventory['originals'], 'stable inventory required')
    records = [original_record(row) for row in inventory['originals']]
    require(len({row['artifact_id'] for row in records}) == len(records), 'duplicate artifact in inventory')
    require(RECIPIENT.fullmatch(args.recipient), 'dedicated age X25519 recipient required')
    args.out.mkdir(mode=0o700)
    for record in records:
        source = args.source / f"original-{record['artifact_id']}.zip"
        target = args.out / cipher_name(record)
        with staged_output(target) as scratch:
            with regular_source(source, record['size_bytes']) as plain, scratch.open('wb') as encrypted:
                with subprocess.Popen([args.age, '--encrypt', '--recipient', args.recipient],
                                      stdin=subprocess.PIPE, stdout=encrypted) as process:
                    with process.stdin as sink:
                        observed = digest(plain, sink)
                    require(process.wait() == 0, 'age encryption failed')
                require(observed == (record['size_bytes'], record['sha256']), f'original differs from inventory {source.name}')
                encrypted.flush()
                os.fsync(encrypted.fileno())
            with scratch.open('rb') as encrypted:
                size, checksum = digest(encrypted)
        record.update(cipher_file=target.name, cipher_bytes=size, cipher_sha256=checksum)
    catalog = {
        'schema_version': 1, 'encryption': 'age-v1-x25519', 'recipient': args.recipient,
        'created_at': datetime.now(timezone.utc).isoformat(), 'originals': records,
    }
    target = args.out / 'catalog.json'
    with staged_output(target) as scratch:
        with scratch.open('w', encoding='utf-8', newline='\n') as output:
            json.dump(catalog, output, indent=2)
            output.write('\n')
            output.flush()
            os.fsync(output.fileno())
    with target.open('rb') as source:
        _, checksum = digest(source)
    return {'status': 'sealed', 'originals': len(records), 'cipher_bytes': sum(row['cipher_bytes'] for row in records),
            'catalog_sha256': checksum}


def verify_zip(path, record):
    with path.open('rb') as source:
        require(digest(source) == (record['size_bytes'], record['sha256']), 'restored ZIP digest or size differs')
    release = record['release_id']
    manifest, tar = f'{release}.manifest.json', f'{release}.tar.gz'
    with zipfile.ZipFile(path) as archive:
        require(sorted(archive.namelist()) == sorted((manifest, tar, 'artifact-result.json', 'build-metadata.json')),
                'unexpected deployment ZIP inventory')
        require(0 < archive.getinfo('artifact-result.json').file_size <= 65536, 'unexpected result size')
        with archive.open('artifact-result.json') as artifact:
            result = json.load(artifact, object_pairs_hook=unique_object)
        require(result['release_id'] == release and result['source_sha'] == record['source_sha']
                and result['package_tree_sha256'] == record['tree_sha256']
                and result['archive_file'] == tar and result['manifest_file'] == manifest
                and result['manifest_sha256'] == record['manifest_sha256']
                and result['archive_sha256'] == record['tar_sha256']
                and result['ci']['run_id'] == record['run_id'] and result['ci']['run_attempt'] == record['run_attempt'],
                'restored deployment provenance differs')
        for member, checksum, limit in ((manifest, record['manifest_sha256'], MAX_MANIFEST),
                                        (tar, record['tar_sha256'], MAX_ZIP),
                                        ('build-metadata.json', result['metadata_sha256'], 65536)):
            require(0 < archive.getinfo(member).file_size <= limit, 'unexpected deployment ZIP member size')
            with archive.open(member) as source:
                require(digest(source)[1] == checksum, f'restored package digest differs for {member}')


def restore(args):
    require(HEX.fullmatch(args.catalog_sha256), 'invalid custody receipt digest')
    catalog = read_json(args.catalog, args.catalog_sha256)
    require(catalog['schema_version'] == 1 and catalog['encryption'] == 'age-v1-x25519', 'unsupported catalog')
    matches = [row for row in catalog['originals'] if row['artifact_id'] == args.artifact]
    require(len(matches) == 1, 'artifact missing or ambiguous')
    stored = matches[0]
    record = original_record(stored)
    name = cipher_name(record)
    size = stored['cipher_bytes']
    require(name == stored['cipher_file'] and HEX.fullmatch(stored['cipher_sha256'])
            and type(size) is int and record['size_bytes'] < size <= record['size_bytes'] + MAX_CATALOG,
            'invalid sealed object metadata')
    identity = sys.stdin.buffer.read(16385)
    require(0 < len(identity) <= 16384, 'age identity required on standard input')
    encrypted = args.archive_dir / name
    with staged_output(args.out) as scratch:
        with regular_source(encrypted, size) as source:
            require(digest(source)[1] == stored['cipher_sha256'], 'sealed object digest differs')
            with scratch.open('wb') as output:
                result = subprocess.run([args.age, '--decrypt', '--identity', '-', str(encrypted)], input=identity,
                                        stdout=output, check=False)
                require(result.returncode == 0, 'age authentication or decryption failed')
                output.flush()
                os.fsync(output.fileno())
        verify_zip(scratch, record)
    return {'status': 'restored', 'artifact_id': record['artifact_id'], 'release_id': record['release_id'],
            'zip_sha256': record['sha256'], 'tar_sha256': record['tar_sha256'],
            'manifest_sha256': record['manifest_sha256'], 'tree_sha256': record['tree_sha256']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest='action', required=True)
    sealer = actions.add_parser('seal')
    sealer.add_argument('--inventory', required=True, type=Path)
    sealer.add_argument('--source', required=True, type=Path)
    sealer.add_argument('--recipient', required=True)
    restorer = actions.add_parser('restore')
    restorer.add_argument('--catalog', required=True, type=Path)
    restorer.add_argument('--catalog-sha256', required=True)
    restorer.add_argument('--archive-dir', required=True, type=Path)
    restorer.add_argument('--artifact', required=True)
    restorer.add_argument('--identity-stdin', required=True, action='store_true')
    for action in (sealer, restorer):
        action.add_argument('--out', required=True, type=Path)
        action.add_argument('--age', default='age')
    args = parser.parse_args()
    try:
        result = (seal if args.action == 'seal' else restore)(args)
        print(json.dumps(result, separators=(',', ':')))
    except (OSError, KeyError, TypeError, ValueError, zipfile.BadZipFile) as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
