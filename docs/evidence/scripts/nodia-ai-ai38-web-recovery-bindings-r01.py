"""Observe both current Gemini bindings after a pinned adoption; never generates."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

HELPER = Path('/opt/nodia/verification/ai38-profile-modalities-r01/nodia-ai-ai38-profile-reattest-modalities-r01.py')
PIN = 'f51d16a67b73a5eb5f5eaa6beee4bad1ae06d0e1af0d7641487887835af843d3'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adoption-report', type=Path, required=True)
    parser.add_argument('--adoption-sha256', required=True)
    args = parser.parse_args()
    assert hashlib.sha256(args.adoption_report.read_bytes()).hexdigest() == args.adoption_sha256
    adoption = json.loads(args.adoption_report.read_bytes())
    assert adoption['status'] == 'adopt_completed' and len(adoption['public_sources_after']) == 49
    assert hashlib.sha256(HELPER.read_bytes()).hexdigest() == PIN
    expected = adoption['epoch_after']

    def epoch():
        result = subprocess.run(['docker', 'inspect', 'nodia-gemini-microservice'], capture_output=True, check=True, timeout=15)
        value = json.loads(result.stdout)[0]
        observed = dict(container_id=value['Id'], image_id=value['Image'], started_at_utc=value['State']['StartedAt'])
        assert value['State']['Running'] and observed == expected
        return observed

    spec = importlib.util.spec_from_file_location('frozen_readonly_bindings', HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    files = helper.verify_packet(helper.PACKET)
    before = epoch()
    snapshots = []
    for mode in ('agentic', 'web'):
        started = datetime.now(timezone.utc).isoformat()
        result = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-', str(helper.PACKET), helper.API_ENV, mode],
            input=helper.SNAPSHOT.encode(), capture_output=True, timeout=60,
            env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODE_ENV': 'test',
                 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory'})
        assert result.returncode == 0
        value = json.loads(result.stdout)
        assert value['connection_id'] == '2' and value['provider_key'] == 'gemini'
        assert all(item == 0 for item in value['quiet'].values())
        snapshots.append(dict(mode=mode, began_VM_utc=started, ended_VM_utc=datetime.now(timezone.utc).isoformat(), snapshot=value))
        assert epoch() == before
    print(json.dumps(dict(schema='ai38-web-recovery-bindings-v1', status='observed_read_only',
        adoption_sha256=args.adoption_sha256, helper_sha256=PIN, packet_files_verified=files,
        native_epoch=before, same_epoch_after=epoch() == before, snapshots=snapshots,
        native_observe_requests=2, configured_SQL_writes=0, provider_generation_requests=0,
        raw_credentials_or_responses_emitted=False), indent=2))


if __name__ == '__main__':
    main()
