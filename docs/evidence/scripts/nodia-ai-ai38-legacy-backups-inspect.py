"""Read-only exact-file inspection. ROOT executes with BASELINE injected above.
No SQL restore, unlink, chmod, service restart, bucket listing or payload output.
BASELINE is generated from environment-retention-r02 and pinned by the caller.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, re, stat, subprocess

BASE = Path('/opt/nodia/verification-backups')
assert os.geteuid() == 0 and len(BASELINE) == 29
assert BASE.resolve() == BASE and BASE.is_dir() and not BASE.is_symlink()
PROPS = ('st_dev','st_ino','st_nlink','st_uid','st_gid','st_mode','st_size','st_mtime_ns','st_ctime_ns')
def stamp(info): return {k:getattr(info,k) for k in PROPS}
def unit_state():
    result={}
    for unit in ('nodia-api','nodia-ai-worker','nodia-gemini-lab','nginx','nodia-ai-backup.timer','nodia-ai-backup-rotate.timer'):
        raw=subprocess.check_output(['systemctl','show',unit,'--property=ActiveState,MainPID,ActiveEnterTimestampMonotonic','--no-pager']).decode()
        result[unit]=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
    return result

before=unit_state();rows=[];identities=set();parents={}
for old in BASELINE:
    path=Path(old['path'])
    assert path.is_relative_to(BASE) and len(path.relative_to(BASE).parts)==2 and path.suffix=='.dump'
    # Every ancestor must be the expected real directory, with no symlink traversal.
    for parent in (BASE,*path.parents):
        assert not parent.is_symlink() and parent.resolve()==parent
    directory=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        fd=os.open(path.name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=directory)
        try:
            first=os.fstat(fd);assert stat.S_ISREG(first.st_mode) and first.st_size<=16*1024*1024
            assert first.st_uid==0 and first.st_nlink==1 and stat.S_IMODE(first.st_mode)==0o600
            digest=hashlib.sha256();magic=os.read(fd,5);digest.update(magic)
            while True:
                part=os.read(fd,65536)
                if not part:break
                digest.update(part)
            assert stamp(os.fstat(fd))==stamp(first)
            listing=subprocess.run(['/usr/lib/postgresql/16/bin/pg_restore','--list',f'/proc/self/fd/{fd}'],
                pass_fds=(fd,),capture_output=True,timeout=5,env={'PATH':'/usr/bin:/bin','LANG':'C','TZ':'UTC'})
            assert len(listing.stdout)<=2*1024*1024 and len(listing.stderr)<=65536
            text=listing.stdout.decode('utf-8',errors='replace')
            def field(pattern):
                match=re.search(pattern,text,re.MULTILINE)
                return match.group(1).strip() if match else None
            created=field(r'^;\s*Archive created at ([-0-9 :A-Za-z+]+)$')
            matches_inventory=first.st_size==old['byte_count'] and datetime.fromtimestamp(first.st_mtime,timezone.utc).isoformat()==old['mtime_utc']
            identity=stamp(first);identities.add((first.st_dev,first.st_ino))
            rows.append(dict(path=str(path),sha256=digest.hexdigest(),identity=identity,
                matches_prior_size_and_mtime=matches_inventory,
                format='PostgreSQL_custom_PGDMP' if magic==b'PGDMP' else 'other_or_unknown',
                encrypted_envelope=False if magic==b'PGDMP' else None,
                pg_restore_list_exit=listing.returncode,
                catalog_readable=listing.returncode==0,
                embedded_created_at=created,
                embedded_time_is_archive_declaration_not_trusted_capture_proof=True,
                toc_entries=len(re.findall(r'^\d+;',text,re.MULTILINE)),
                dump_version=field(r'^;\s*Dump Version: ([0-9.\-]+)$'),
                source_database_major=field(r'^;\s*Dumped from database version: ([0-9]+)'),
                pg_dump_major=field(r'^;\s*Dumped by pg_dump version: ([0-9]+)'),
                validation='catalog_only_not_full_restore',contents_emitted=False))
            assert stamp(os.fstat(fd))==stamp(first)==stamp(os.stat(path.name,dir_fd=directory,follow_symlinks=False))
        finally:os.close(fd)
        siblings=[]
        for item in sorted(path.parent.iterdir()):
            info=item.lstat()
            siblings.append(dict(name=item.name,kind='symlink' if item.is_symlink() else 'directory' if stat.S_ISDIR(info.st_mode) else 'file' if stat.S_ISREG(info.st_mode) else 'other',
                                 size=info.st_size,mode=oct(stat.S_IMODE(info.st_mode)),contents_read=False))
        assert len(siblings)<=128
        parents[str(path.parent)]=siblings
    finally:os.close(directory)

opened={row['path']:0 for row in rows};fd_scan_incomplete=0
by_inode={(row['identity']['st_dev'],row['identity']['st_ino']):row['path'] for row in rows}
for process in Path('/proc').iterdir():
    if not process.name.isdigit():continue
    try:
        for descriptor in (process/'fd').iterdir():
            try:
                info=descriptor.stat();name=by_inode.get((info.st_dev,info.st_ino))
                if name:opened[name]+=1
            except FileNotFoundError:pass # exited descriptor/process
            except PermissionError:fd_scan_incomplete+=1
    except FileNotFoundError:pass
    except PermissionError:fd_scan_incomplete+=1

after=unit_state();assert after==before
for row in rows:
    assert stamp(Path(row['path']).lstat())==row['identity']
    row['open_descriptors_observed']=opened[row['path']]
groups={}
for row in rows:groups.setdefault(row['sha256'],[]).append(row['path'])
print(json.dumps(dict(schema_version=1,stage='AI-38-legacy-backups',status='review_only_no_deletion',
    observed_at_VM_utc=datetime.now(timezone.utc).isoformat(),base=str(BASE),count=len(rows),
    total_bytes=sum(row['identity']['st_size'] for row in rows),rows=rows,
    identical_content_groups=[paths for paths in groups.values() if len(paths)>1],siblings_metadata=parents,
    fd_scan_permission_failures=fd_scan_incomplete,open_descriptors_total=sum(opened.values()),
    services_before=before,services_after=after,services_unchanged=True,
    SQL_restore_performed=False,SQL_writes=0,provider_requests=0,R2_requests=0,
    dump_payload_values_emitted=False,backup_keys_read=False,files_deleted=0,
    limits=['catalog_readable_does_not_prove_complete_restore','file_absence_not_physical_erasure','scope_exact_29_paths_not_global_backup_inventory'])))
