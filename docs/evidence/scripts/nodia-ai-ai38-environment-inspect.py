"""Read-only VM network/clock metadata; no config, profiles or response bodies emitted.

Run as root via stdin. This inventories local configuration, not public Internet
reachability, a trusted TLS origin, continuous retention or release readiness.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess


def read_command(argv):
    result = subprocess.run(argv, capture_output=True, timeout=20, check=False)
    return result.returncode, result.stdout.decode('utf-8', errors='replace')


def units():
    result = {}
    for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx'):
        code, raw = read_command(['systemctl', 'show', name, '--no-pager',
                                 '--property=ActiveState,SubState,MainPID'])
        if code:
            raise RuntimeError('unit_metadata_unavailable')
        values = dict(line.split('=', 1) for line in raw.splitlines() if '=' in line)
        result[name] = {key: values[key] for key in ('ActiveState', 'SubState', 'MainPID')}
    return result


def inspect():
    started = datetime.now(timezone.utc).isoformat()
    before = units()
    site = Path('/etc/nginx/sites-available/nodia-lab')
    site_digest = hashlib.sha256(site.read_bytes()).hexdigest()
    code, raw = read_command(['ss', '-H', '-ltn'])
    if code:
        raise RuntimeError('listener_metadata_unavailable')
    listeners = []
    for line in raw.splitlines():
        address = line.split()[3]
        port = int(address.rsplit(':', 1)[1])
        if port in (22, 80, 443, 3000, 5432, 6379, 8000, 8080):
            listeners.append({'address': address, 'port': port})
    code, raw = read_command(['/usr/sbin/nginx', '-T'])
    if code:
        raise RuntimeError('nginx_configuration_invalid_or_unavailable')
    listen_lines = re.findall(r'^\s*listen\s+([^;]+);', raw, re.MULTILINE)
    nginx = {
        'configuration_test_passed': True,
        'listen_directive_count': len(listen_lines),
        'ssl_listen_directive_count': sum(bool(re.search(r'\bssl\b', value)) for value in listen_lines),
        'certificate_directive_count': len(re.findall(r'^\s*ssl_certificate\s+', raw, re.MULTILINE)),
        'scoped_20m_present': 'client_max_body_size 20m;' in site.read_text(),
        'site_sha256': site_digest,
        'raw_configuration_emitted': False,
    }
    firewall = {}
    for command in ('iptables', 'ip6tables'):
        code, raw = read_command(['/usr/sbin/' + command, '-S'])
        policies = {}
        if code == 0:
            for line in raw.splitlines():
                match = re.fullmatch(r'-P (INPUT|FORWARD|OUTPUT) (ACCEPT|DROP)', line)
                if match:
                    policies[match[1]] = match[2]
        firewall[command] = {'command_available': code == 0, 'filter_policies': policies,
                             'append_rule_count': sum(line.startswith('-A ') for line in raw.splitlines()) if code == 0 else None,
                             'effective_reachability_inferred': False}
    code, raw = read_command(['timedatectl', 'show', '--property=NTPSynchronized', '--property=NTP', '--property=Timezone'])
    clock = dict(line.split('=', 1) for line in raw.splitlines() if '=' in line) if code == 0 else None
    if clock is not None and set(clock) != {'NTPSynchronized', 'NTP', 'Timezone'}:
        raise RuntimeError('incomplete_clock_metadata')
    after = units()
    if before != after or site_digest != hashlib.sha256(site.read_bytes()).hexdigest():
        raise RuntimeError('environment_changed_during_inspection')
    return {
        'schema_version': 1, 'stage': 'AI-38', 'environment': 'linux_lab',
        'status': 'passed_read_only_inspection_not_release_acceptance',
        'started_at_utc': started, 'finished_at_utc': datetime.now(timezone.utc).isoformat(),
        'units_before': before, 'units_after': after, 'service_identity_unchanged': before == after,
        'listeners': sorted(listeners, key=lambda item: (item['port'], item['address'])),
        'nginx': nginx, 'firewall_metadata': firewall, 'clock_declared': clock,
        'effects': {'service_changes': 0, 'configured_SQL_writes': 0, 'provider_requests': 0,
                    'storage_requests': 0, 'remote_file_writes': 0, 'clock_changes': 0},
        'limits': ['filter_rule_counts_do_not_prove_packet_policy',
                   'local_listeners_do_not_prove_public_Internet_exposure',
                   'TLS_configuration_metadata_does_not_verify_a_certificate_or_public_origin',
                   'no_backup_rotation_journal_or_restore_acceptance',
                   'no_authentication_or_generation_acceptance'],
        'release_authorized': False,
    }


if __name__ == '__main__':
    try:
        print(json.dumps(inspect(), indent=2))
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as error:
        print(json.dumps({'stage': 'AI-38', 'status': 'inspection_failed',
                          'failure_class': type(error).__name__, 'private_details_emitted': False}))
        raise SystemExit(1)
