"""Fresh R07 native image qualification using the immutable R06 protocol.

Each MIME consumes its own write-once intent. No retry, proof restoration,
readiness override or UI/R2 acceptance is introduced by this successor.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

BASE = Path('/opt/nodia/verification/ai40-r06-image-operator-r01/nodia-ai-ai40-r06-image-operator-r01.py')
BASE_SHA = 'b048369c1abe3b31df801bf1e94b70462dfca4196f14d276387da737cdb38355'
WORK = Path('/opt/nodia/verification/ai40-r07-image-operator-r01')
FIXTURES = Path('/opt/nodia/verification/ai40-r07-image-fixtures-r01')
GUARD = Path('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py')
GUARD_SHA = '753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58'
INSPECTOR = WORK / 'nodia-ai-ai40-r07-image-native-inspect-r01.mjs'
INSPECTOR_SHA = '43afb9e3bb57b64b63eee1f543a9f664ebae726eabd593366d1bb845c517d441'
PRIVATE_SHA = '574fdb2ae459d489c2f6ab602f97560c3198026dbf0f1ac4cb0a4249e8c2d668'
MIMES = {'png': 'image/png', 'jpeg': 'image/jpeg', 'webp': 'image/webp'}


def run(args):
    if not BASE.is_file() or BASE.is_symlink() or hashlib.sha256(BASE.read_bytes()).hexdigest() != BASE_SHA:
        raise ValueError('immutable_image_operator_pin_mismatch')
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('immutable_r06_image_operator', BASE)
    original = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(original)
    for name in ('WORK', 'FIXTURES', 'GUARD', 'GUARD_SHA', 'INSPECTOR', 'INSPECTOR_SHA', 'PRIVATE_SHA'):
        setattr(original, name, globals()[name])
    original.__file__ = str(Path(__file__).resolve())
    result, code = original.run(args)
    return {**result, 'schema': 'nodia-ai-ai40-r07-image-operator-v1',
            'inherited_image_protocol_sha256': BASE_SHA,
            'fresh_private_fixtures': True}, code


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['preflight', 'probe'])
    parser.add_argument('--mime', choices=sorted(MIMES), required=True)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--authorize-one-real-generation', action='store_true')
    args = parser.parse_args()
    try:
        result, code = run(args)
        print(json.dumps(result))
        sys.exit(code)
    except Exception as error:
        message = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-r07-image-operator-v1', 'status': 'operator_failed', 'mime': MIMES[args.mime], 'error_class': type(error).__name__, 'error_code': message if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', message) else 'operator_dependency_timeout_or_protocol_error', 'generation_may_have_started': (WORK / ('intent-' + args.mime + '.json')).exists(), 'operator_retry_allowed': False, 'required_next_action': 'inspect_exact_attempt_and_reconcile_without_replay', 'private_details_emitted': False}))
        sys.exit(1)
