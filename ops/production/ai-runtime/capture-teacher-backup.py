#!/usr/bin/env python3
"""Explicit fresh backup bracketed by exact readonly fingerprints; default inert."""
from contextlib import ExitStack
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import sys

sys.dont_write_bytecode=True
LIB=Path('/usr/local/lib/nodia')
STATE=Path('/var/lib/nodia-updates')
CURRENT=Path('/opt/nodia/current')
REGISTRY=Path('/etc/nodia/ai-runtime/consumers.json')
INSTALL_LOCK=Path('/var/lib/nodia-backend-setup/installation.lock')
IO_SHA256='bdb432360273384c61c4d308bdd17fd689bc16be5dc8dd4ed57988c7755dc632'
PINS={'update-backend.py','backend_update.py','deploy-backend-receiver.py','update-backend-action.mjs','ai-runtime/codex-provision.py'}


def require(value,code):
    if not value:raise ValueError(code)


def io_policy():
    path=Path(__file__).resolve().with_name('upgrade-teacher-operators.py')
    require(path.resolve(strict=True)==path and path.stat().st_size<128*1024,'reviewed_capture_io_required')
    raw=path.read_bytes();require(hashlib.sha256(raw).hexdigest()==IO_SHA256,'reviewed_capture_io_digest_required')
    scope={'__name__':'teacher_capture_reviewed_io','__file__':str(path)};exec(compile(raw,str(path),'exec'),scope)
    from types import SimpleNamespace
    return SimpleNamespace(**scope)


def validate_plan(io,value):
    require(type(value) is dict and set(value)=={'schema','capture_id','current_release','current_manifest_sha256',
        'settings_sha256','receiver_settings_sha256','registry_sha256','fingerprint_sha256','operator_pins'},'capture_plan_shape_invalid')
    require(value['schema']=='teacher-backup-capture/1' and type(value['capture_id']) is str and
        re.fullmatch('[a-f0-9]{32}',value['capture_id']) and type(value['current_release']) is str and
        re.fullmatch('backend-[a-f0-9]{12}-[a-f0-9]{12}',value['current_release']),'capture_identity_invalid')
    for key in ('current_manifest_sha256','settings_sha256','receiver_settings_sha256','registry_sha256','fingerprint_sha256'):
        require(type(value[key]) is str and io.HEX.fullmatch(value[key]),'capture_digest_invalid')
    io.digest_map(value['operator_pins'],PINS)
    return value


def validate_fingerprint(io,value):
    require(type(value) is dict and set(value)=={'tables','aggregate_sha256'} and type(value['tables']) is list and
        len(value['tables'])<=256 and type(value['aggregate_sha256']) is str and io.HEX.fullmatch(value['aggregate_sha256']),
        'capture_fingerprint_shape_invalid')
    normalized=[];previous=None
    for row in value['tables']:
        require(type(row) is dict and set(row)=={'name','rows','md5'} and type(row['name']) is str and
            re.fullmatch('[A-Za-z_][A-Za-z0-9_]{0,62}',row['name']) and (previous is None or previous<row['name']) and
            type(row['rows']) is int and 0<=row['rows']<=1_000_000 and type(row['md5']) is str and
            re.fullmatch('[a-f0-9]{32}',row['md5']),'capture_fingerprint_row_invalid')
        previous=row['name'];normalized.append({'name':row['name'],'rows':row['rows'],'md5':row['md5']})
    require(io.sha(json.dumps(normalized,ensure_ascii=False,separators=(',',':')).encode())==value['aggregate_sha256'],
            'capture_fingerprint_digest_invalid')
    return value


def capture(plan_file,expected,fingerprint_file):
    require(sys.platform=='linux' and os.geteuid()==0,'linux_root_required')
    io=io_policy();raw=io.read_source(Path(plan_file).absolute(),bound=32768)
    require(io.HEX.fullmatch(expected or '') and io.sha(raw)==expected,'reviewed_capture_plan_required')
    plan=validate_plan(io,io.unique_json(raw))
    fingerprint=io.read_source(Path(fingerprint_file).absolute())
    require(io.sha(fingerprint)==plan['fingerprint_sha256'] and b'\r' not in fingerprint,'reviewed_fingerprint_source_required')
    record=STATE/('teacher-backup-capture-'+plan['capture_id'])
    import fcntl
    with ExitStack() as stack:
        for path in (STATE/'receiver.lock',INSTALL_LOCK):
            require(io.protected(path,0o600).st_size==0,'empty_capture_lock_required')
            handle=stack.enter_context(path.open('r+b'));fcntl.flock(handle.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        require(not record.exists() and not record.is_symlink(),'capture_already_reserved_no_replay')
        require(CURRENT.is_symlink() and CURRENT.resolve(strict=True).name==plan['current_release'],'capture_current_changed')
        current=CURRENT.resolve(strict=True)
        manifest_raw=io.read_source(current/'release-manifest.json',installed=True,bound=32*1024*1024)
        require(io.sha(manifest_raw)==plan['current_manifest_sha256'],'capture_manifest_changed')
        manifest=io.unique_json(manifest_raw)
        metadata={}
        for name,key,path in [('settings','settings_sha256',STATE/'settings.json'),
                              ('receiver','receiver_settings_sha256',STATE/'receiver-settings.json'),('registry','registry_sha256',REGISTRY)]:
            metadata[name]=io.read_source(path,installed=True,mode=0o600,bound=16384)
            require(io.sha(metadata[name])==plan[key],'capture_metadata_CAS_changed')
        settings=io.unique_json(metadata['settings']);io.digest_map(settings['service_hashes'],io.BASE_UNITS)
        mappings=[io.digest_map(settings['assets'],io.ASSETS),
                  io.digest_map(io.unique_json(metadata['receiver'])['assets'],{'deploy-backend-receiver.py','deploy-gateway.py'}),plan['operator_pins']]
        code={}
        for mapping in mappings:
            for name,pin in mapping.items():
                content=io.read_source(LIB/name,installed=True,mode=0o755 if name=='deploy-gateway.py' else 0o644)
                require(io.sha(content)==pin,'capture_operator_pin_changed');code[name]=content
        loaded=lambda name:io.load_bytes(code[name],LIB/name,'teacher_capture_'+name.replace('/','_').replace('.','_'))
        updater,policy,receiver,safe=[loaded(name) for name in ['update-backend.py','backend_update.py','deploy-backend-receiver.py','ai-runtime/codex-provision.py']]
        status=io.ready(receiver)
        require(status['current']['release_id']==current.name and not updater.MAINTENANCE.exists() and
                not updater.MAINTENANCE.is_symlink(),'capture_backend_not_ready')
        runtime=io.snapshot(receiver,settings)
        host=updater.Host(policy,None,settings);host.current=current;host.candidate=current
        host.verify_writers(current)
        record.mkdir(mode=0o700);io.sync_directory(STATE);host.attempt=record
        phase='reserved';backup=None
        try:
            io.exclusive(record/'plan.json',raw)
            io.exclusive(record/'intent.json',(json.dumps({'plan_sha256':expected,'automatic_retry_allowed':False})+'\n').encode())
            target=LIB/('teacher-fingerprint-'+plan['fingerprint_sha256']+'.mjs')
            safe.install_file(target,fingerprint,0o644)
            require(io.sha(io.read_source(target,installed=True))==plan['fingerprint_sha256'],'installed_fingerprint_changed')
            identity=[manifest['source_sha'],plan['current_manifest_sha256'],current.name,manifest['package_tree_sha256']]
            phase='fingerprint_before'
            before=validate_fingerprint(io,host.node_job(target,['--capture',*identity],180))
            before_raw=(json.dumps(before,sort_keys=True,indent=2)+'\n').encode();io.exclusive(record/'source-fingerprint.json',before_raw)
            phase='backup_requested'
            io.exclusive(record/'backup-intent.json',b'{"automatic_retry_allowed":false}\n')
            backup=host.backup()
            require(type(backup) is dict and re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',backup.get('backup_id','')) and
                    io.HEX.fullmatch(backup.get('cipher_sha256','')),'fresh_backup_receipt_invalid')
            io.exclusive(record/'backup.json',(json.dumps(backup,sort_keys=True)+'\n').encode())
            phase='fingerprint_after'
            after=validate_fingerprint(io,host.node_job(target,['--capture',*identity],180))
            io.exclusive(record/'after-fingerprint.json',(json.dumps(after,sort_keys=True)+'\n').encode())
            require(after==before,'source_changed_across_backup')
            require(CURRENT.resolve(strict=True)==current and io.sha(io.read_source(current/'release-manifest.json',installed=True,bound=32*1024*1024))==plan['current_manifest_sha256'],'capture_current_changed_after_backup')
            for name,key,path in [('settings','settings_sha256',STATE/'settings.json'),('receiver','receiver_settings_sha256',STATE/'receiver-settings.json'),('registry','registry_sha256',REGISTRY)]:
                require(io.read_source(path,installed=True,mode=0o600,bound=16384)==metadata[name],'capture_metadata_changed_after_backup')
            require(io.ready(receiver)==status,'capture_backend_status_changed')
            final=io.snapshot(receiver,settings)
            require(final['base_units_sha256']==runtime['base_units_sha256'],'capture_runtime_changed')
            for unit,previous in runtime['units'].items():
                keys=('ActiveState','UnitFileState') if unit.endswith('.timer') else tuple(previous)
                require(all(final['units'][unit].get(k)==previous.get(k) for k in keys),'capture_runtime_changed')
            result={'schema':'teacher-backup-capture-receipt/1','status':'captured_source_equal',**backup,
                'source_sha':manifest['source_sha'],'release_id':current.name,'release_manifest_sha256':plan['current_manifest_sha256'],
                'package_tree_sha256':manifest['package_tree_sha256'],'fingerprint_helper_sha256':plan['fingerprint_sha256'],
                'source_fingerprint_file_sha256':io.sha(before_raw),'source_fingerprint_sha256':before['aggregate_sha256'],
                'source_fingerprint_private_path':str(record/'source-fingerprint.json'),'capture_id':plan['capture_id'],
                'plan_sha256':expected,'public_tables':len(before['tables']),'SQL_writes':0,'provider_calls':0,
                'API_worker_stopped':False,'maintenance_created':False,'restore_performed':False,'runtime_recovery_authorized':False,
                'automatic_retry_allowed':False}
            io.exclusive(record/'receipt.json',(json.dumps(result,sort_keys=True)+'\n').encode());return result
        except BaseException as error:
            code=str(error) if isinstance(error,ValueError) and re.fullmatch('[a-z_]{1,100}',str(error)) else 'capture_private_reconciliation_required'
            io.exclusive(record/'failure.json',(json.dumps({'phase':phase,'error_code':code,'backup_result_known':backup is not None,
                'backup_side_effects_possible':phase in ('backup_requested','fingerprint_after'),'backup_delete_or_retry_attempted':False,
                'automatic_retry_allowed':False})+'\n').encode())
            raise


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--execute',action='store_true')
    parser.add_argument('--plan',type=Path);parser.add_argument('--plan-sha256');parser.add_argument('--fingerprint-source',type=Path);args=parser.parse_args()
    if not args.execute:print('{"inert":true,"backup_created":false,"production_writes":0}');return
    def interrupted(_signal,_frame):raise ValueError('capture_interrupted')
    for number in (signal.SIGINT,signal.SIGTERM):signal.signal(number,interrupted)
    require(args.plan and args.plan_sha256 and args.fingerprint_source,'explicit_capture_inputs_required')
    print(json.dumps(capture(args.plan,args.plan_sha256,args.fingerprint_source)))


if __name__=='__main__':
    try:main()
    except BaseException as error:
        code=str(error) if isinstance(error,ValueError) and re.fullmatch('[a-z_]{1,100}',str(error)) else 'capture_private_reconciliation_required'
        print('{"status":"failed","error_code":"'+code+'","automatic_retry_allowed":false,"provider_calls":0}')
        raise SystemExit(1) from None
