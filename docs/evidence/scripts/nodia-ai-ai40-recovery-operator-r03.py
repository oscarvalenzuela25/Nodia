"""Fresh recovery attempt with corrected contender public-configuration assertion.

The new material directory aliases the local contenders-r02.mjs bytes to the
parent's expected contenders-r01.mjs basename; every byte is independently pinned.
The original three parent/child/source files remain byte-exact. No old intention
or generation is replayed. Journal retries are read-only status calls only.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

BASE = Path('/opt/nodia/verification/ai40-recovery-operator-r01/nodia-ai-ai40-recovery-operator-r01.py')
BASE_SHA = '46970b7d22a1ec2f271d819b2327170de40336cfbae95f07c3658d8f50177435'
STATUS = Path('/opt/nodia/verification/ai40-journal-status-read-r01/nodia-ai-ai40-journal-status-read-r01.py')
STATUS_SHA = '5e5b710b0210e82228593401f0480e54970666ef4151251e930c16bb85da6c38'
WORK = Path('/opt/nodia/verification/ai40-recovery-operator-r03')
MATERIALS = Path('/opt/nodia/verification/ai40-recovery-materials-r02')
CONTENDER_SHA = '4e144a07813ca7396b39221826a9e9ac3254c54542438cce14235f1a2fc7306a'
STATUS_READ_ATTEMPTS = []


def pinned(path, pin, name):
    if not path.is_file() or path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != pin:
        raise ValueError('recovery_successor_dependency_changed')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(args):
    sys.dont_write_bytecode = True
    original = pinned(BASE, BASE_SHA, 'immutable_recovery_r01')
    status = pinned(STATUS, STATUS_SHA, 'immutable_status_read')
    events = STATUS_READ_ATTEMPTS
    events.clear()
    load = original.load

    def load_guard(path, pin, name):
        module = load(path, pin, name)
        if name == 'immutable_public_guard':
            module.public_preflight = lambda services: status.public_preflight(module, services, events)
        return module

    original.load = load_guard
    original.WORK = WORK
    original.MATERIALS = MATERIALS
    original.MATERIAL_PINS = {**original.MATERIAL_PINS, 'nodia-ai-ai40-recovery-contenders-r01.mjs': CONTENDER_SHA}
    original.__file__ = str(Path(__file__).resolve())
    try:
        result, code = original.run(args)
        return {**result, 'schema': 'nodia-ai-ai40-recovery-operator-r03-v1',
                'predecessor_operator_sha256': BASE_SHA, 'status_read_helper_sha256': STATUS_SHA,
                'status_read_attempts': events, 'fresh_successor_work': True,
                'contender_local_source': 'docs/evidence/scripts/nodia-ai-ai40-recovery-contenders-r02.mjs',
                'contender_remote_alias': 'nodia-ai-ai40-recovery-contenders-r01.mjs'}, code
    finally:
        original.load = load


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['preflight', 'bootstrap', 'probe'])
    parser.add_argument('--scenario', choices=['cancel', 'revoke'], required=True)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--authorize-one-real-generation', action='store_true')
    args = parser.parse_args()
    try:
        result, code = run(args)
        print(json.dumps(result)); sys.exit(code)
    except Exception as error:
        message = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-recovery-operator-r03-v1', 'status': 'operator_failed',
                          'scenario': args.scenario, 'error_class': type(error).__name__,
                          'error_code': message if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', message) else 'operator_dependency_timeout_or_protocol_error',
                          'generation_may_have_started': (WORK / args.scenario / 'intent-recovery.json').exists(),
                          'operator_retry_allowed': False, 'required_next_action': 'inspect_same_owner_and_blocked_login_identities_without_replay',
                          'status_read_attempts': STATUS_READ_ATTEMPTS,
                          'private_details_emitted': False, 'services_changed': False}))
        sys.exit(1)
