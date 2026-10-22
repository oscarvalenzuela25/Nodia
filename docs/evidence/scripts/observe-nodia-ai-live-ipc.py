"""Non-generative, read-only structural observation of the owned live MCP diagnostic."""
import json
from pathlib import Path
from experiments.nodia_ai_agentic_diagnostics import error_categories

root = Path('/home/nodia/agentic_profile')
observations = []
for directory in root.glob('nodia-mcp-*'):
    if directory.is_symlink() or not directory.is_dir():
        continue
    bridge = directory / 'bridge'
    receipt = bridge / 'gate.jsonl'
    gates = []
    if receipt.is_file() and receipt.stat().st_size <= 65536:
        for line in receipt.read_text().splitlines():
            item = json.loads(line)
            if set(item) == {'tool', 'allowed'}:
                gates.append(item['allowed'] is True)
    log = directory / 'cli.log'
    gate_diagnostics = []
    sidecar = bridge / 'gate-diagnostic.jsonl'
    if sidecar.is_file() and sidecar.stat().st_size <= 65536:
        for line in sidecar.read_text().splitlines():
            item = json.loads(line)
            if set(item) == {'category', 'call_kind'} and all(isinstance(value, str) and len(value) <= 64 for value in item.values()):
                gate_diagnostics.append(item)
    categories = []
    if log.is_file() and log.stat().st_size <= 2000000:
        categories = error_categories(log.read_text(errors='replace'))
    observations.append({'rpc_files': len(list((bridge / 'requests').glob('*.json'))),
                         'callback_response_files': len(list((bridge / 'responses').glob('*.json'))),
                         'gate_decisions': len(gates), 'gate_denials': gates.count(False),
                         'cli_log_categories': categories, 'gate_diagnostics': gate_diagnostics})
print(json.dumps({'read_only': True, 'inference_performed': False, 'active_ipc': observations}))
