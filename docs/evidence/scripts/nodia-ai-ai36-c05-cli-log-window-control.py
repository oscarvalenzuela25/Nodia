"""Offline classifier control with synthetic logs; no CLI or application import."""
import datetime
import hashlib
import json
from pathlib import Path
import sys
import tempfile

root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root / 'nodia-gemini-microservice'))
from native_cli_diagnostics import capture_cli_log_diagnostic


def main():
    harmless = 'synthetic harmless structural line'
    indicator = 'HTTP status 503 RESOURCE_EXHAUSTED'
    cases = {
        'head': [indicator] + [harmless] * 130,
        'middle': [harmless] * 65 + [indicator] + [harmless] * 65,
        'tail': [harmless] * 130 + [indicator],
    }
    results = {}
    with tempfile.TemporaryDirectory(prefix='nodia-c05-log-window-control-') as directory:
        path = Path(directory) / 'synthetic-cli.log'
        for label, lines in cases.items():
            path.write_text('\n'.join(lines), encoding='utf-8')
            results[label] = capture_cli_log_diagnostic(path)
    assert results['head']['http_statuses'] == [503]
    assert results['tail']['http_statuses'] == [503]
    assert results['middle']['http_statuses'] == []
    assert results['middle']['provider_error_indicators'] == []
    assert results['middle']['truncated'] is True
    assert results['middle']['bytes_read'] < 131072
    sources = [Path(__file__).resolve(), root / 'nodia-gemini-microservice/native_cli_diagnostics.py']
    print(json.dumps({
        'stage': 'AI-36-C05-R01',
        'scope': 'offline_real_cli_log_classifier_synthetic_logs_not_provider_acceptance',
        'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'middle_error_omitted_by_line_sampling': True,
        'cases': results,
        'source_hashes': [{'path': path.relative_to(root).as_posix(),
                           'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in sources],
        'application_or_operational_profiles_imported': False,
        'real_cli_or_provider_requests': 0,
        'limitations': ['Synthetic indicator omission does not prove the real log contained an omitted error.',
                        'Indicators classify text and do not establish the cause of a provider failure.'],
    }, indent=2))


if __name__ == '__main__':
    main()
