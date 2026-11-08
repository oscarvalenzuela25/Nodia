"""One isolated successor with phase diagnostics; preserve original probe source.

No additional RPC methods. Never print native stderr or raw protocol frames.
"""
from pathlib import Path
import hashlib
import json
import traceback

original = Path('/opt/nodia/verification/ai40-document-audio-r01/offline-file-admission.py')
source = original.read_bytes()
assert hashlib.sha256(source).hexdigest() == '0c58046be2fe837545e86c710dbd61781f27b10a877b773500df88bfa6734f26'
successor = source.replace(b"ROOT = Path('/opt/nodia/verification/ai40-offline-file-admission-r01')",
                           b"ROOT = Path('/opt/nodia/verification/ai40-offline-file-admission-r02')")
state = {'__file__': str(original), '__name__': '__main__'}
try:
    exec(compile(successor, str(original), 'exec'), state)
except Exception as error:
    frames = [{'line': frame.lineno, 'function': frame.name} for frame in traceback.extract_tb(error.__traceback__)
              if frame.filename == str(original)]
    methods = state.get('methods', [])
    process = state.get('process')
    print(json.dumps({'schema': 'nodia-ai-ai40-offline-file-admission-diagnostic-v1', 'status': 'offline_probe_failed',
                      'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                      'original_source_sha256': hashlib.sha256(source).hexdigest(), 'only_change': 'fresh isolated ROOT suffix r02',
                      'exception_class': type(error).__name__, 'source_frames': frames, 'methods': methods,
                      'results_completed': state.get('results'), 'native_child_exit_code': process.poll() if process else None,
                      'last_safe_response': state['summary'](next((m for m in reversed(state.get('messages', [])) if 'id' in m), {})) if 'summary' in state else None,
                      'native_group_absent': state.get('group_absent'), 'private_details_emitted': False,
                      'provider_generations': 0, 'provider_observations': 0, 'operational_profile_reads': 0}))
