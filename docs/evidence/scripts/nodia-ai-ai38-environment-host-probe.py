"""Windows-to-local-VM TCP checks only; no credentials or application payloads.

The VM is on the user's Hyper-V network, not a public Internet target. A TCP
acceptance is not HTTP authorization, TLS acceptance or provider readiness.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import socket


HOST = '172.31.209.214'
PORTS = (22, 80, 443, 3000, 5432, 6379, 8000, 8080)


def probe(port):
    try:
        with socket.create_connection((HOST, port), timeout=3):
            return {'port': port, 'TCP': 'accepted', 'application_bytes_sent': 0}
    except ConnectionRefusedError:
        return {'port': port, 'TCP': 'refused', 'application_bytes_sent': 0}
    except TimeoutError:
        return {'port': port, 'TCP': 'timeout', 'application_bytes_sent': 0}
    except OSError:
        return {'port': port, 'TCP': 'unavailable', 'application_bytes_sent': 0}


started = datetime.now(timezone.utc).isoformat()
with ThreadPoolExecutor(max_workers=8) as pool:
    observations = list(pool.map(probe, PORTS))
print(json.dumps({
    'schema_version': 1, 'stage': 'AI-38', 'environment': 'linux_lab',
    'status': 'host_to_private_VM_TCP_observation_not_public_exposure_acceptance',
    'started_at_host_clock': started, 'finished_at_host_clock': datetime.now(timezone.utc).isoformat(),
    'clock_source': 'development_host_not_trusted_cross_host_ordering',
    'target': 'private_local_HyperV_VM', 'observations': observations,
    'effects': {'TCP_connections': len(PORTS), 'application_bytes_sent': 0, 'SQL_writes': 0,
                'provider_requests': 0, 'configuration_changes': 0},
    'limits': ['timeouts_are_not_proof_of_a_particular_firewall_rule',
               'private_host_to_VM_path_does_not_test_public_Internet_or_IPv6_reachability',
               'no_HTTP_TLS_authentication_or_generation_acceptance'],
    'release_authorized': False,
}, indent=2))
