"""Resume the journaled package after lexical systemd drop-in precedence failure.
Does not bootstrap, change application sources or roll back external coverage.
"""
import importlib.util
import json
from pathlib import Path
import os
import subprocess
from datetime import datetime, timezone

source = Path('/tmp/nodia-ai-ai38-journal-activate.py')
import hashlib
assert hashlib.sha256(source.read_bytes()).hexdigest() == '56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
spec = importlib.util.spec_from_file_location('activation', source)
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
assert os.geteuid() == 0
before = json.loads((a.WORK / 'activation-before.json').read_bytes())
_, helpers = a.load_helpers()
assert not (a.WORK / 'activation-resumed.json').exists()
try:
    a.checked(['systemctl', 'stop', 'nodia-api'], timeout=60)
    assert a.stopped('nodia-api')
    a.wait_quiet(helpers)
    a.checked(['systemctl', 'stop', 'nodia-ai-worker'], timeout=60)
    assert all(a.stopped(unit) for unit in a.CONSUMERS)
    for unit, old in a.DROPINS.items():
        new = old.with_name('zz-ai38-journal.conf')
        assert old.is_file() and not old.is_symlink() and not new.exists()
        # Exact existing, owned file is moved within its verified systemd directory.
        assert old.parent.resolve() == old.parent and old.stat().st_uid == 0
        old.rename(new)
    a.checked(['systemctl', 'daemon-reload'])
    a.checked(['systemctl', 'start', *a.CONSUMERS], timeout=45)
    consumers = a.wait_health()
    package = a.manifest()
    assert package == before['package']
    pre = before['runtime']
    assert helpers['native_epoch']() == pre['Gemini']
    assert helpers['schema_and_selection']() == pre['SQL_schema_and_selection']
    assert helpers['original_files']() == pre['frozen_original_Node']['manifest_sha256']
    assert a.sha(a.NGINX) == a.NGINX_SHA
    for unit in a.UNCHANGED:
        assert a.state(unit)['pid'] == pre['units'][unit]['MainPID']
        assert a.state(unit)['active'] == 'active'
    quiet = a.wait_quiet(helpers)
    status = a.journal('status')
    assert status['entries'] == status['unconfirmed'] == status['backups'] == 0
    installed = a.install_units()
    assert a.active_new_processes() == consumers
    result = dict(stage='AI-38', status='journaled_package_activated_timers_enabled_not_started',
                  finished_at_utc=datetime.now(timezone.utc).isoformat(),
                  cause='99 prefix sorted before existing ai15-release.conf; API cwd overridden',
                  correction='same exact overrides renamed zz-ai38-journal.conf',
                  bootstrap_replayed=False, external_era_interrupted=False,
                  package=package, consumers=consumers, quiet=quiet,
                  external_status=status, backup_units=installed,
                  Gemini_unchanged=True, nginx_unchanged=True,
                  original_932_outputs_unchanged=True, schema_and_selection_unchanged=True,
                  provider_requests=0, business_effects=0, migrations=0,
                  backup_timers_started=False, release_authorized=False)
    a.freeze('activation-resumed.json', result)
    print(json.dumps(result))
except Exception:
    subprocess.run(['systemctl','stop','nodia-api','nodia-ai-worker'],capture_output=True,timeout=60)
    print(json.dumps(dict(status='resume_failed_consumers_stopped_no_legacy_rollback', raw_details_emitted=False)))
    raise SystemExit(1)
