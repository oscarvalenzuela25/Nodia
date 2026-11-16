#!/usr/bin/env python3
"""Forced SSH command. Only typed status/upload/deploy; no shell, SFTP or argv sudo."""
import json
import os
import pwd
import re
import selectors
import subprocess
import sys
import time

UPLOAD_REJECTIONS = frozenset({
    'incoming_quota_reached_operator_cleanup_required',
    'insufficient_upload_headroom',
    'prior_update_requires_reconciliation',
    'upload_already_recorded_no_automatic_replay',
    'receiver_busy',
    'upload_offset_conflict',
    'upload_prefix_conflict',
    'upload_ledger_requires_reconciliation',
    'upload_unmanaged_requires_reconciliation',
    'upload_chunk_digest_mismatch',
    'upload_protocol_upgrade_required',
    'upload_requires_operator_reconciliation',
    'upload_ledger_invalid',
    'upload_digest_mismatch',
    'upload_size_or_digest_mismatch',
    'upload_storage_conflict',
    'upload_storage_changed',
    'upload_file_changed',
    'upload_file_size_invalid',
    'upload_ledger_conflict',
    'upload_archive_requires_reconciliation',
    'upload_archive_record_invalid',
    'upload_archive_limit_reached',
    'upload_ledger_limit_reached',
    'upload_chunk_digest_invalid',
    'upload_chunk_size_invalid',
    'upload_not_receiving',
    'upload_not_complete',
    'upload_finalization_requires_reconciliation',
    'upload_transport_refresh_requires_reconciliation',
})


def known_upload_rejection(body, code):
    return (type(code) is int and 1 <= code <= 255 and type(body) is dict and
            set(body) == {'schema_version', 'status', 'error_code', 'automatic_retry_allowed'} and
            type(body['schema_version']) is int and body['schema_version'] == 1 and
            body['status'] == 'failed' and body['automatic_retry_allowed'] is False and
            isinstance(body['error_code'], str) and body['error_code'] in UPLOAD_REJECTIONS)


def parse_command(original):
    if not isinstance(original, str) or len(original) > 1024 or not re.fullmatch(r'[a-z0-9 -]+', original):
        raise ValueError('unsupported_deploy_command')
    parts = original.split(' ')
    if any(not part for part in parts): raise ValueError('noncanonical_deploy_command')
    result = {'schema_version': 1, 'command': parts[0]}
    identity = ('artifact_id', 'artifact_zip_sha256', 'run_id', 'run_attempt', 'bytes')
    if parts[0] == 'capabilities' and len(parts) == 1:
        names = ()
    elif parts[0] in ('upload-status', 'upload-open', 'upload-finish') and len(parts) == 6:
        names = identity
    elif parts[0] == 'upload-append' and len(parts) == 10:
        names = identity + ('offset', 'prefix_sha256', 'chunk_bytes', 'chunk_sha256')
    elif parts[0] == 'status' and len(parts) in (1, 2):
        names = ('operation_id',) if len(parts) == 2 else ()
    elif parts[0] == 'upload' and len(parts) == 6:
        names = ('artifact_id', 'artifact_zip_sha256', 'run_id', 'run_attempt', 'bytes')
    elif parts[0] == 'deploy' and len(parts) == 9:
        names = ('operation_id', 'artifact_id', 'artifact_zip_sha256', 'run_id', 'run_attempt',
                 'source_sha', 'expected_current_release', 'expected_current_tree_sha256')
    else: raise ValueError('unsupported_deploy_command')
    patterns = {'operation_id': r'[a-f0-9]{32}', 'artifact_id': r'[1-9][0-9]{0,19}',
                'artifact_zip_sha256': r'[a-f0-9]{64}', 'run_id': r'[1-9][0-9]{0,19}',
                'run_attempt': r'[1-9][0-9]{0,5}', 'bytes': r'[1-9][0-9]{0,9}',
                'source_sha': r'[a-f0-9]{40}', 'expected_current_release': r'backend-[a-f0-9]{12}-[a-f0-9]{12}',
                'expected_current_tree_sha256': r'[a-f0-9]{64}', 'offset': r'(?:0|[1-9][0-9]{0,9})',
                'prefix_sha256': r'[a-f0-9]{64}', 'chunk_bytes': r'[1-9][0-9]{0,7}',
                'chunk_sha256': r'[a-f0-9]{64}'}
    for name, value in zip(names, parts[1:]):
        if not re.fullmatch(patterns[name], value): raise ValueError('invalid_deploy_command_argument')
        result[name] = int(value) if name in ('bytes', 'offset', 'chunk_bytes') else value
    if result.get('bytes', 0) > 768 * 1024 ** 2: raise ValueError('invalid_upload_size')
    if result['command'] == 'upload-append' and not (result['chunk_bytes'] <= 8 * 1024 ** 2 and
            result['offset'] + result['chunk_bytes'] <= result['bytes']):
        raise ValueError('invalid_upload_chunk')
    return result


def main():
    if os.getuid() != pwd.getpwnam('nodia-deploy').pw_uid:
        raise ValueError('dedicated_deploy_identity_required')
    message = parse_command(os.environ.get('SSH_ORIGINAL_COMMAND'))
    env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8'}
    child = subprocess.Popen(['/usr/bin/sudo', '-n', '/usr/bin/python3', '-I',
        '/usr/local/lib/nodia/deploy-backend-receiver.py'], stdin=subprocess.PIPE,
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)
    try:
        interrupted = False
        try:
            child.stdin.write((json.dumps(message) + '\n').encode()); child.stdin.flush()
            if message['command'] in ('upload', 'upload-append'):
                # Root enforces byte count, digest, quota and deadlines independently.
                remaining = message['chunk_bytes'] if message['command'] == 'upload-append' else message['bytes']
                deadline = time.monotonic() + 240
                with selectors.DefaultSelector() as selector:
                    selector.register(sys.stdin.fileno(), selectors.EVENT_READ)
                    while True:
                        wait = min(20, deadline - time.monotonic())
                        if wait <= 0 or not selector.select(wait): raise ValueError('upload_timeout')
                        block = os.read(sys.stdin.fileno(), min(1024 * 1024, remaining + 1))
                        if not block: break
                        remaining -= len(block)
                        if remaining < 0: raise ValueError('upload_exceeds_declared_size')
                        child.stdin.write(block); child.stdin.flush()
                if remaining: raise ValueError('upload_size_or_digest_mismatch')
        except BrokenPipeError:
            if message['command'] not in ('upload', 'upload-append'):
                raise ValueError('deploy_gateway_failed_result_unknown') from None
            # The receiver may reject before consuming ZIP bytes. Read its one
            # bounded response instead of discarding it or forwarding more input.
            interrupted = True
        try:
            child.stdin.close()
        except BrokenPipeError:
            if message['command'] not in ('upload', 'upload-append'):
                raise ValueError('deploy_gateway_failed_result_unknown') from None
            interrupted = True
        output = bytearray()
        deadline = time.monotonic() + (90 if message['command'] == 'upload-open' else 35)
        with selectors.DefaultSelector() as selector:
            selector.register(child.stdout.fileno(), selectors.EVENT_READ)
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not selector.select(remaining):
                    raise ValueError('receiver_response_timeout_result_unknown')
                block = os.read(child.stdout.fileno(), 16385 - len(output))
                if not block: break
                output.extend(block)
                if len(output) > 16384: raise ValueError('receiver_response_too_large')
        if len(output) > 16384: raise ValueError('receiver_response_too_large')
        result = child.wait(timeout=30)
        # Root emits only safe structured metadata. Parse before forwarding.
        body = json.loads(output)
        if not isinstance(body, dict) or body.get('schema_version') != 1:
            raise ValueError('invalid_receiver_response')
        if interrupted and not known_upload_rejection(body, result):
            raise ValueError('deploy_gateway_failed_result_unknown')
        print(json.dumps(body), flush=True)
        return result
    finally:
        if child.poll() is None:
            child.kill(); child.wait()
        for stream in (child.stdin, child.stdout):
            try:
                stream.close()
            except BrokenPipeError:
                pass


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'deploy_gateway_failed_result_unknown'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False}), flush=True)
        sys.exit(64)
