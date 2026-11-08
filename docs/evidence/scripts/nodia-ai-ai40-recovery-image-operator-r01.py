"""Fresh post-recovery PNG/JPEG/WebP qualifications on the unchanged R07 release.

Only the write-once workspace and operator identity change. The exact pinned
R07/R06 protocol, synthetic fixture bytes/oracles and native inspector remain.
Every MIME needs a newly authorized generation; no old run is resumed/replayed,
no proof is copied/restored and no UI/R2 acceptance is inferred.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

BASE = Path('/opt/nodia/verification/ai40-r07-image-operator-r01/nodia-ai-ai40-r07-image-operator-r01.py')
BASE_SHA = '89f0a83777b944cee72a842b57697370839d6e025d118efac74538b7f8f5c738'
WORK = Path('/opt/nodia/verification/ai40-recovery-images-r01')
MIMES = {'png': 'image/png', 'jpeg': 'image/jpeg', 'webp': 'image/webp'}


def run(args):
    if not BASE.is_file() or BASE.is_symlink() or hashlib.sha256(BASE.read_bytes()).hexdigest() != BASE_SHA:
        raise ValueError('immutable_r07_image_operator_pin_mismatch')
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('immutable_r07_image_operator', BASE)
    original = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(original)
    original.WORK = WORK
    original.__file__ = str(Path(__file__).resolve())
    result, code = original.run(args)
    return {**result, 'schema': 'nodia-ai-ai40-recovery-image-operator-v1',
            'inherited_R07_operator_sha256': BASE_SHA,
            'fresh_private_fixtures': False,
            'exact_R07_synthetic_fixtures_reused': True,
            'consumed_runs_or_intents_replayed': False}, code


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
        print(json.dumps({'schema': 'nodia-ai-ai40-recovery-image-operator-v1', 'status': 'operator_failed',
                          'mime': MIMES[args.mime], 'error_class': type(error).__name__,
                          'error_code': message if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', message) else 'operator_dependency_timeout_or_protocol_error',
                          'generation_may_have_started': (WORK / ('intent-' + args.mime + '.json')).exists(),
                          'operator_retry_allowed': False,
                          'required_next_action': 'inspect_exact_attempt_and_reconcile_without_replay',
                          'private_details_emitted': False}))
        sys.exit(1)
