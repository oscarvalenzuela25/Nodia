"""Fresh MCP qualifications after the two controlled R07 recovery probes.

Each checkpoint has a separate, write-once intention. The frozen MCP protocol
requires every old proof to be absent and native/SQL work to be closed. It never
restores historical proofs or replays a consumed or uncertain generation.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

BASE = Path('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py')
BASE_SHA = '753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58'
ROOT = Path('/opt/nodia/verification/ai40-recovery-mcp-r01')
CHECKPOINTS = ('after-cancel', 'after-revoke')


def run(args):
    if args.checkpoint not in CHECKPOINTS:
        raise ValueError('recovery_checkpoint_invalid')
    if not BASE.is_file() or BASE.is_symlink() or hashlib.sha256(BASE.read_bytes()).hexdigest() != BASE_SHA:
        raise ValueError('immutable_mcp_operator_pin_mismatch')
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('immutable_r07_recovery_mcp_operator', BASE)
    original = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(original)
    original.WORK = ROOT / args.checkpoint
    original.__file__ = str(Path(__file__).resolve())
    report, code = original.run(args)
    return {**report, 'schema': 'nodia-ai-ai40-recovery-mcp-operator-v1',
            'recovery_checkpoint': args.checkpoint,
            'inherited_mcp_protocol_sha256': BASE_SHA}, code


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['preflight', 'probe'])
    parser.add_argument('--checkpoint', choices=CHECKPOINTS, required=True)
    parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--authorize-one-real-generation', action='store_true')
    args = parser.parse_args()
    try:
        result, code = run(args)
        print(json.dumps(result))
        sys.exit(code)
    except Exception as error:
        message = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-recovery-mcp-operator-v1',
                          'checkpoint': args.checkpoint, 'status': 'operator_failed',
                          'error_class': type(error).__name__,
                          'error_code': message if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', message)
                          else 'operator_command_timeout' if isinstance(error, subprocess.TimeoutExpired)
                          else 'operator_dependency_or_protocol_error',
                          'generation_may_have_started': (ROOT / args.checkpoint / 'intent-mcp.json').exists(),
                          'operator_retry_allowed': False,
                          'required_next_action': 'inspect_exact_identities_and_reconcile_without_replay',
                          'private_details_emitted': False, 'services_changed': False,
                          'configuration_changed': False}))
        sys.exit(1)
