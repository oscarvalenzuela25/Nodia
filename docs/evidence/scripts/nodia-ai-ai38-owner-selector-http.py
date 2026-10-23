"""Bounded read-only nginx metadata projection: never emit request target/identity."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import stat
from urllib.parse import unquote_to_bytes

BEGIN = datetime(2026, 10, 22, 17, 40, tzinfo=timezone.utc)
ADOPT_BEGAN = datetime(2026, 10, 22, 17, 47, 5, tzinfo=timezone.utc)
ADOPT_COMPLETED = datetime(2026, 10, 22, 17, 47, 25, 609039, tzinfo=timezone.utc)
END = datetime.now(timezone.utc)
MAX_BYTES = 4 * 1024 * 1024
LINE = re.compile(rb'^\S+ \S+ \S+ \[([^\]\r\n]+)\] "((?:[^"\\\r\n]|\\.)*)" ([0-9]{3}) (?:[0-9]+|-)(?: |$)')
REQUEST = re.compile(rb'^GET ([^ ]+) HTTP/[0-9.]+$')


def read_tail(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as stream:
        before = os.fstat(stream.fileno())
        if not stat.S_ISREG(before.st_mode):
            raise ValueError('log_not_regular')
        offset = max(0, before.st_size - MAX_BYTES)
        stream.seek(offset)
        payload = stream.read(before.st_size - offset)
        after = os.fstat(stream.fileno())
        if before.st_ino != after.st_ino or before.st_dev != after.st_dev or after.st_size < before.st_size:
            raise ValueError('log_changed_while_reading')
    if offset:
        payload = payload.partition(b'\n')[2]
    return payload, dict(name=path.name, inode=before.st_ino, device=before.st_dev,
                        size_at_read=before.st_size, read_start_offset=offset, bytes_read=len(payload))


counts = Counter()
times = {}
sources = []
oldest_scanned = None
for path in (Path('/var/log/nginx/access.log'), Path('/var/log/nginx/access.log.1')):
    # Current log covers the complete time window: no rotated-file read needed.
    if sources and oldest_scanned is not None and oldest_scanned <= BEGIN:
        break
    if not path.exists():
        continue
    payload, metadata = read_tail(path)
    sources.append(metadata)
    for item in payload.splitlines():
        match = LINE.match(item)
        if not match:
            continue
        timestamp = datetime.strptime(match[1].decode('ascii'), '%d/%b/%Y:%H:%M:%S %z').astimezone(timezone.utc)
        oldest_scanned = timestamp if oldest_scanned is None else min(oldest_scanned, timestamp)
        request = REQUEST.fullmatch(match[2])
        if not request or not BEGIN <= timestamp <= END:
            continue
        target, _, query = request[1].partition(b'?')
        if target not in (b'/api/v1/users', b'/api/v1/user'):
            continue
        # Only inspect parameter names; discard all values without decoding them.
        names = [unquote_to_bytes(part.partition(b'=')[0]) for part in query.split(b'&')]
        present = b'q[id_eq]' in names or b'id_eq' in names
        phase = 'before_adoption_R02' if timestamp < ADOPT_BEGAN else (
            'adoption_transition' if timestamp <= ADOPT_COMPLETED else 'after_adoption_owner_fix')
        key = (phase, int(match[3]), present)
        counts[key] += 1
        first, last = times.get(key, (timestamp, timestamp))
        times[key] = (min(first, timestamp), max(last, timestamp))

result = dict(scope='bounded_read_only_nginx_users_metadata_only',
              window_begin_utc=BEGIN.isoformat(), window_end_utc=END.isoformat(),
              adoption_began_utc=ADOPT_BEGAN.isoformat(), adoption_completed_utc=ADOPT_COMPLETED.isoformat(),
              maximum_bytes_per_log=MAX_BYTES, maximum_log_files=2, sources=sources,
              full_window_scanned=oldest_scanned is not None and oldest_scanned <= BEGIN,
              counts=[dict(phase=key[0], method='GET', endpoint='users', status=key[1],
                           id_eq_filter_present=key[2], count=value,
                           first_matched_utc=times[key][0].isoformat(), last_matched_utc=times[key][1].isoformat())
                      for key, value in sorted(counts.items())],
              timestamp_precision='nginx_seconds; transition classification conservative at boundary',
              source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              raw_logs_queries_parameter_values_identities_credentials_emitted=False,
              network_requests=0, services_changed=False, log_files_modified=False)
print(json.dumps(result, indent=2))
