"""Bounded read-only HTTP route metadata; no response/body/query/identity output."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess

BEGIN = datetime(2026, 10, 22, 17, 59, tzinfo=timezone.utc)
END = datetime.fromisoformat("2026-10-22T18:07:33.508683+00:00")  # Closed R01 window
MAX_BYTES = 4 * 1024 * 1024
CONTAINER = 'nodia-gemini-microservice'
NGINX_LINE = re.compile(rb'^\S+ \S+ \S+ \[([^\]\r\n]+)\] "((?:[^"\\\r\n]|\\.)*)" ([0-9]{3}) (?:[0-9]+|-)(?: |$)')
REQUEST = re.compile(rb'^(GET) ([^ ]+) HTTP/[0-9.]+$')
DOCKER_ACCESS = re.compile(rb'^([^ ]+) .*?"(GET) ([^ ]+) HTTP/[0-9.]+" ([0-9]{3})(?: |$)')
STATIC = {'/api/v1/nodia-ai/attachments/capabilities': 'attachment_capabilities'}
for prefix in ('/api/v1/ai-provider/', '/api/v1/ai-providers/'):
    for suffix in ('health', 'health-check', 'verify-all'):
        STATIC[prefix + suffix] = 'ai_providers_health'
    for suffix in ('gemini-engines', 'gemini/engines'):
        STATIC[prefix + suffix] = 'ai_provider_gemini_engines'
    for suffix in ('models', 'selectable-models'):
        STATIC[prefix + suffix] = 'ai_provider_models'
NATIVE = {'/health': 'native_health', '/agentic/status': 'native_agentic_status',
          '/agentic/models': 'native_agentic_models', '/engines/status': 'native_engines_status',
          '/ready': 'native_web_readiness', '/agentic/ready': 'native_agentic_readiness',
          '/auth/status': 'native_web_status', '/web/status': 'native_web_status',
          '/models': 'native_web_models', '/web/models': 'native_web_models'}


def label(target, native=False):
    try:
        path = target.partition(b'?')[0].decode('ascii')
    except UnicodeDecodeError:
        return None
    if native:
        return NATIVE.get(path)
    if path in STATIC:
        return STATIC[path]
    if re.fullmatch(r'/api/v1/nodia-ai/connections/[0-9]+/eligibility', path):
        return 'connection_eligibility'
    if re.fullmatch(r'/api/v1/ai-providers?/[0-9]+/session', path):
        return 'ai_connection_session'
    return None


rows = []
counts = Counter()


def add(source, stamp, method, target, status):
    name = label(target, source == 'docker_native_access')
    if name is None or not BEGIN <= stamp <= END:
        return
    rows.append(dict(source=source, timestamp_utc=stamp.isoformat(), method=method.decode('ascii'),
                     endpoint=name, status=int(status)))
    counts[(source, name, int(status))] += 1


log = Path('/var/log/nginx/access.log')
descriptor = os.open(log, os.O_RDONLY | os.O_NOFOLLOW)
with os.fdopen(descriptor, 'rb') as stream:
    before = os.fstat(stream.fileno())
    if not stat.S_ISREG(before.st_mode):
        raise ValueError('log_not_regular')
    start = max(0, before.st_size - MAX_BYTES)
    stream.seek(start)
    payload = stream.read(before.st_size - start)
    if start:
        payload = payload.partition(b'\n')[2]
    after = os.fstat(stream.fileno())
    current = log.stat(follow_symlinks=False)
    if before.st_ino != after.st_ino or before.st_ino != current.st_ino or after.st_size < before.st_size:
        raise ValueError('log_changed_during_read')
oldest = None
for line in payload.splitlines():
    match = NGINX_LINE.match(line)
    if not match:
        continue
    stamp = datetime.strptime(match[1].decode('ascii'), '%d/%b/%Y:%H:%M:%S %z').astimezone(timezone.utc)
    oldest = stamp if oldest is None else min(oldest, stamp)
    request = REQUEST.fullmatch(match[2])
    if request:
        add('nginx', stamp, request[1], request[2], match[3])

# docker logs is a local read operation. Output is parsed in memory only and
# never copied to an artifact; fixed interval/tail and byte ceiling bound it.
completed = subprocess.run(['docker', 'logs', '--timestamps', '--since', BEGIN.isoformat(),
                            '--until', END.isoformat(), '--tail', '10000', CONTAINER],
                           capture_output=True, timeout=25, check=False)
if completed.returncode or len(completed.stdout) + len(completed.stderr) > MAX_BYTES:
    raise ValueError('bounded_docker_observation_failed')
docker_lines = 0
for payload in (completed.stdout, completed.stderr):
    for line in payload.splitlines():
        docker_lines += 1
        match = DOCKER_ACCESS.match(line)
        if not match:
            continue
        stamp = datetime.fromisoformat(match[1].decode('ascii').replace('Z', '+00:00')).astimezone(timezone.utc)
        add('docker_native_access', stamp, match[2], match[3], match[4])

rows.sort(key=lambda row: (row['timestamp_utc'], row['source']))
print(json.dumps(dict(scope='bounded_read_only_probe_HTTP_metadata_not_causal_attribution',
    window_begin_utc=BEGIN.isoformat(), window_end_utc=END.isoformat(), timeline=rows,
    counts=[dict(source=k[0], endpoint=k[1], method='GET', status=k[2], count=v) for k, v in sorted(counts.items())],
    nginx=dict(inode=before.st_ino, device=before.st_dev, size_at_read=before.st_size, start_offset=start,
               max_bytes=MAX_BYTES, full_window_scanned=oldest is not None and oldest <= BEGIN),
    docker=dict(max_lines=10000, max_bytes=MAX_BYTES, scanned_lines=docker_lines,
                tail_ceiling_reached=docker_lines >= 10000, stdout_stderr_persisted=False),
    timestamp_precision='nginx_seconds; Docker timestamp describes log delivery and need not equal request start',
    source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    code_route_sources=['nodia-server/src/ai-provider/ai-provider.controller.ts',
                        'nodia-server/src/nodia-ai-attachment/nodia-ai-attachment.controller.ts',
                        'nodia-gemini-microservice/main.py'],
    raw_logs_queries_values_identities_headers_bodies_emitted=False, response_reasons_observed=False,
    concurrency_or_cause_proven_by_timestamps=False, HTTP_requests=0, provider_requests=0,
    services_changed=False, configurations_changed=False), indent=2))
