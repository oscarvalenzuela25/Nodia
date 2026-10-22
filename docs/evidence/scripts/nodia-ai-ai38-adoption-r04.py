"""Second closed A→B→A window for authenticated UI; no historical reports overwritten.

Reuses pinned reviewed R03 helper definitions, never its entry point. Root runs
quiesce, fresh backup R04, adopt, UI, rollback and early backup purge serially.
No original DB restore, migrations, provider generation or Gemini restart here.
"""
import argparse
import ast
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import time

SOURCE_SHA256 = '703a068c6dcd1089b12c0961646d4768bc916d7b56c908ba389d902f2c4e2bee'
WORK = Path('/opt/nodia/verification/ai38-adoption-r04')
PRIOR = Path('/opt/nodia/verification/ai38-adoption-r02')
BACKUP = Path('/opt/nodia/verification/ai38-adoption-backup-r04/public-report.json')


def load_source(path):
    payload = Path(path).read_bytes()
    assert hashlib.sha256(payload).hexdigest() == SOURCE_SHA256
    tree = ast.parse(payload)
    # Explicitly omit the historical main; no source top-level execution guard.
    nodes = [node for node in tree.body if isinstance(node, (ast.Import, ast.ImportFrom, ast.Assign, ast.FunctionDef, ast.Expr))
             and not (isinstance(node, ast.FunctionDef) and node.name == 'main')]
    assert len(nodes) == len(tree.body) - 2 and isinstance(tree.body[-1], ast.If)
    namespace = {'__file__': __file__, '__name__': 'pinned_adoption_helpers_r03'}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), 'pinned_adoption_helpers_r03', 'exec'), namespace)
    return namespace


def require_receipt(receipt, quiesced, backup_sha):
    assert backup_sha and len(backup_sha) == 64
    assert receipt['status'] == 'passed' and receipt['configured_database_backup'] is True
    assert receipt['disposable_restore_verified'] is True and receipt['original_database_restored'] is False
    assert receipt['encryption'] == {'format': 'openpgp', 'cipher': 'AES256', 'integrity': 'MDC'}
    assert receipt['backup_retained_for_closed_drill'] and receipt['passphrase_retained_privately']
    assert receipt['owned_containers_remaining'] == 0 and receipt['expiry_timer_active_after'] is True
    assert datetime.fromisoformat(receipt['source_snapshot_finished_at_utc']) >= datetime.fromisoformat(quiesced['finished_at_utc'])
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(receipt['source_snapshot_finished_at_utc'])).total_seconds()
    assert 0 <= age <= 3600, 'fresh_backup_required_for_new_window'
    assert datetime.fromisoformat(receipt['backup_expires_at_utc']) > datetime.now(timezone.utc)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=('quiesce', 'adopt', 'rollback'))
    parser.add_argument('--prior-rollback-sha256')
    parser.add_argument('--backup-receipt-sha256')
    parser.add_argument('--backup-source-sha256')
    args = parser.parse_args()
    assert os.name == 'posix' and os.geteuid() == 0
    os.umask(0o077)
    h = load_source('/tmp/nodia-ai-ai38-adoption-r03.py')
    lock = Path('/run/lock/nodia-ai38-adoption.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    sha, checked = h['sha'], h['checked']
    if args.phase == 'quiesce':
        assert args.prior_rollback_sha256 and sha(PRIOR / 'rollback.json') == args.prior_rollback_sha256
        previous = json.loads((PRIOR / 'rollback.json').read_text())
        assert previous['status'] == 'passed' and previous['phase'] == 'rollback'
        assert previous['script_sha256'] == SOURCE_SHA256
        assert previous['rollback_descriptors_byte_exact'] and previous['only_owned_IPv4_IPv6_fences_removed']
        assert h['states']() == dict.fromkeys(h['UNITS'], 'active')
        h['require_processes'](False)
        assert not any(value.exists() for value in h['DROPINS'].values())
        assert not any(h['fence_present'](binary) for binary in ('/usr/sbin/iptables', '/usr/sbin/ip6tables'))
        assert not WORK.exists() and not WORK.is_symlink()
        baseline = json.loads((PRIOR / 'prepare.json').read_text())
        assert baseline['status'] == 'passed' and baseline['script_sha256'] == '10df76eabd6c068a6e3ae033333c6807e082d4c34b5dcc6deb0b614eaf487749'
        assert previous['epoch'] == baseline['epoch'] == h['native_epoch']()
        assert h['schema_and_selection']() == baseline['SQL_baseline']
        assert sha(h['ORIGINAL'] / '.env') == baseline['original_env_sha256']
        assert all(sha(path) == baseline['descriptors'][str(path)] for path in h['DESCRIPTORS'])
        h['quiet']()
        WORK.mkdir(mode=0o700)
        (WORK / 'private').mkdir(mode=0o700)
        for index, path in enumerate(h['DESCRIPTORS']):
            snapshot = PRIOR / 'private' / ('descriptor-' + str(index))
            assert sha(snapshot) == baseline['descriptors'][str(path)]
            (WORK / 'private' / snapshot.name).write_bytes(snapshot.read_bytes())
        (WORK / 'prepare.json').write_bytes((PRIOR / 'prepare.json').read_bytes())
        h['freeze'](WORK / 'continuation.json', {'status': 'new_authenticated_UI_window_after_verified_original_restore',
            'source_sha256': sha(Path(__file__)), 'pinned_helpers_sha256': SOURCE_SHA256,
            'prior_rollback_sha256': args.prior_rollback_sha256, 'prepare_sha256': sha(PRIOR / 'prepare.json'),
            'staging_reexecuted': False, 'historical_reports_overwritten': False})
    assert WORK.is_dir() and not WORK.is_symlink() and not (WORK / (args.phase + '.json')).exists()
    private = WORK / 'private'
    baseline = json.loads((WORK / 'prepare.json').read_text())
    continuation = json.loads((WORK / 'continuation.json').read_text())
    assert continuation['source_sha256'] == sha(Path(__file__)) and continuation['pinned_helpers_sha256'] == SOURCE_SHA256
    report = {'stage': 'AI-38', 'scope': 'restricted_loopback_authenticated_UI_adoption_reversal_window',
        'phase': args.phase, 'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
        'script_sha256': sha(Path(__file__)), 'pinned_helpers_sha256': SOURCE_SHA256,
        'provider_generations': 0, 'Gemini_restarts': 0, 'migrations_executed': 0, 'database_restores': 0,
        'direct_business_SQL_writes': 0, 'public_traffic_opened': False, 'full_environment_release_authorized': False,
        'existing_proxy_body_limit_MiB': 11, 'attachment_limit_acceptance': False}
    try:
        report['epoch'] = h['native_epoch']()
        assert report['epoch'] == baseline['epoch']
        report['original_Node_manifest_sha256'] = h['original_files']()
        assert sha(h['ORIGINAL'] / '.env') == baseline['original_env_sha256']
        for path in h['DESCRIPTORS']:
            if path != h['NGINX']:
                assert sha(path) == baseline['descriptors'][str(path)]
        h['validate_manifest'](h['SERVER'], h['SERVER_MANIFEST_SHA'])
        h['validate_manifest'](h['CLIENT'], h['CLIENT_MANIFEST_SHA'])
        assert not (h['SERVER'] / '.env').exists() and not (h['CLIENT'] / '.env').exists()
        assert h['dependencies_hash'](h['SERVER'] / 'node_modules') == baseline['Server']['fresh_dependencies_sha256']
        if args.phase == 'quiesce':
            h['insert_fences']()
            report['quiescence'] = h['stop_quiet'](private)
            h['require_fences']()
        elif args.phase == 'adopt':
            h['require_fences']()
            quiesced = json.loads((WORK / 'quiesce.json').read_text())
            assert quiesced['status'] == 'passed' and quiesced['script_sha256'] == sha(Path(__file__))
            assert quiesced['epoch'] == report['epoch']
            assert all(h['states']()[unit] == 'inactive' for unit in h['CONSUMERS'])
            assert h['NGINX'].read_bytes() == h['nginx_bytes'](private, True)
            assert BACKUP.resolve() == BACKUP and not BACKUP.is_symlink()
            assert args.backup_receipt_sha256 and sha(BACKUP) == args.backup_receipt_sha256
            receipt = json.loads(BACKUP.read_text())
            require_receipt(receipt, quiesced, args.backup_receipt_sha256)
            backup_source = Path('/tmp/nodia-ai-ai38-adoption-backup-r04.py')
            assert args.backup_source_sha256 and sha(backup_source) == args.backup_source_sha256 == receipt['source_sha256']
            report['backup_receipt_sha256'] = args.backup_receipt_sha256
            report['backup_source_sha256'] = args.backup_source_sha256
            report['quiet'] = h['quiet']()
            assert h['schema_and_selection']() == baseline['SQL_baseline']
            for unit, target in h['DROPINS'].items():
                target.parent.mkdir(exist_ok=True)
                with target.open('xb') as output:
                    output.write(h['dropin'](unit))
            checked(['systemctl', 'daemon-reload'])
            checked(['systemctl', 'start', *h['CONSUMERS']], timeout=90)
            h['wait_API']()
            assert h['states']() == dict.fromkeys(h['UNITS'], 'active')
            h['require_processes'](True)
            assert h['schema_and_selection']() == baseline['SQL_baseline']
            report['quiet'] = h['quiet']()
            h['write_nginx'](h['nginx_bytes'](private, False))
            assert h['http_status']('http://127.0.0.1:8080/tools/nodia-ai')[0] == 200
            assert h['http_status']('http://127.0.0.1:8080/api/v1')[0] == 200
            report['restricted_UI_available_for_separate_authenticated_acceptance'] = True
        else:
            assert h['NGINX'].read_bytes() in ((private / 'descriptor-3').read_bytes(), h['nginx_bytes'](private, True), h['nginx_bytes'](private, False))
            for binary in ('/usr/sbin/iptables', '/usr/sbin/ip6tables'):
                if not h['fence_present'](binary):
                    checked([binary, '-w', '5', '-I', *h['fence_arguments']()])
            h['require_fences']()
            report['quiescence'] = h['stop_quiet'](private)
            assert h['schema_and_selection']() == baseline['SQL_baseline']
            for unit, target in h['DROPINS'].items():
                if target.exists():
                    assert not target.is_symlink() and target.read_bytes() == h['dropin'](unit)
                    target.unlink()
            checked(['systemctl', 'daemon-reload'])
            checked(['systemctl', 'start', *h['CONSUMERS']], timeout=90)
            h['wait_API']()
            h['require_processes'](False)
            h['write_nginx']((private / 'descriptor-3').read_bytes())
            report['rollback_descriptors_byte_exact'] = all(sha(path) == baseline['descriptors'][str(path)] for path in h['DESCRIPTORS'])
            assert report['rollback_descriptors_byte_exact']
            report['quiet'] = h['quiet']()
            h['remove_fences']()
            report['only_owned_IPv4_IPv6_fences_removed'] = True
        report['services'] = h['states']()
        assert h['native_epoch']() == report['epoch']
        assert h['original_files']() == report['original_Node_manifest_sha256']
        report['status'] = 'passed'
    except Exception as error:
        report['status'] = 'failed_requires_review_no_automatic_replay_or_database_restore'
        report['failure_class'] = type(error).__name__
        raise
    finally:
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        h['freeze'](WORK / (args.phase + '.json'), report)
        print(json.dumps(report))


if __name__ == '__main__':
    main()
