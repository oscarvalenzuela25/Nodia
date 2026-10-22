"""Read-only Windows clock comparison; HTTP Date is a coarse independent observation, not an NTP certification."""
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from time import monotonic
from urllib.request import Request, urlopen
from uuid import uuid4
import hashlib
import json
import os
import subprocess

assert os.name == 'nt'
service = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command',
    '$clockService=Get-Service W32Time; [pscustomobject]@{name=$clockService.Name;status=$clockService.Status.ToString();start_type=$clockService.StartType.ToString()} | ConvertTo-Json -Compress'],
    capture_output=True, check=True, timeout=15)
source = subprocess.run(['w32tm', '/query', '/source'], capture_output=True, check=False, timeout=15)
before = datetime.now(timezone.utc)
started = monotonic()
with urlopen(Request('https://www.google.com/generate_204?nodia_ai38_time=' + uuid4().hex,
                     method='HEAD', headers={'Cache-Control': 'no-cache'}), timeout=12) as response:
    public_date = response.headers['Date']
    assert response.status == 204
elapsed = monotonic() - started
after = datetime.now(timezone.utc)
observed = parsedate_to_datetime(public_date)
midpoint = before + (after - before) / 2
report = {'stage': 'AI-38', 'scope': 'read_only_development_host_clock_independent_HTTP_Date_comparison',
          'local_UTC_before': before.isoformat(), 'local_UTC_after': after.isoformat(),
          'public_HTTPS_Date': public_date, 'HTTPS_origin': 'https://www.google.com',
          'round_trip_seconds': elapsed,
          'HTTP_Date_minus_Windows_midpoint_seconds': (observed - midpoint).total_seconds(),
          'comparison_uncertainty_seconds_at_least': elapsed / 2 + 1,
          'HTTP_Date_precision': 'whole_second_and_network_delay_not_authenticated_NTP',
          'Windows_Time_service': json.loads(service.stdout.decode('utf8').strip()),
          'w32tm_query_source_exit_code': source.returncode,
          'w32tm_raw_message_not_published': True,
          'interpretation': 'Compare with the guest NTP receipt. A VM-Windows difference alone does not identify the incorrect host.',
          'clock_or_services_modified': False, 'configured_database_used': False,
          'provider_inferences': 0,
          'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
print(json.dumps(report, indent=2))
