"""One-shot, exact-manifest removal after explicit human authorization.
No recursive deletion, SQL, backup upload, service change or shell file operations.
An existing workdir blocks replay; partial failures retain a durable intent ledger.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import fcntl
import hashlib
import json
import os
import stat
import subprocess
import sys

PLAN_SHA = 'dd9421d7339e13408c972f3fbd4424bae2253eb85141789fe01081fc9433526b'
BASE = Path('/opt/nodia/verification-backups')
WORK = Path('/opt/nodia/verification/ai38-legacy-delete-r01')
FIELDS = ('st_dev','st_ino','st_nlink','st_uid','st_gid','st_mode','st_size','st_mtime_ns','st_ctime_ns')

def require(condition, code):
    if not condition: raise ValueError(code)

def stamp(info): return {key:getattr(info,key) for key in FIELDS}

def stable_dir(info):
    return {key:getattr(info,key) for key in ('st_dev','st_ino','st_uid','st_gid','st_mode')}

def secure_directory(path):
    """Walk from / through no-follow directory descriptors, never a path symlink."""
    path=Path(path)
    require(path.is_absolute() and '..' not in path.parts,'unsafe_directory')
    fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        for part in path.parts[1:]:
            next_fd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
            os.close(fd);fd=next_fd
            info=os.fstat(fd)
            require(info.st_uid==0 and not info.st_mode&0o022,'directory_not_exclusive_root')
        return fd
    except BaseException:
        os.close(fd);raise

def digest_fd(fd):
    os.lseek(fd,0,os.SEEK_SET);digest=hashlib.sha256()
    while True:
        chunk=os.read(fd,65536)
        if not chunk: break
        digest.update(chunk)
    return digest.hexdigest()

def snapshot_neighbors(parents, excluded):
    """Hash regular neighbors without following symlinks or emitting their contents."""
    result={};count=0
    def visit(directory,prefix):
        nonlocal count
        for name in sorted(os.listdir(directory)):
            key=prefix+'/'+name
            if key in excluded: continue
            count+=1;require(count<=200000,'neighbor_inventory_limit')
            before=os.stat(name,dir_fd=directory,follow_symlinks=False)
            if stat.S_ISDIR(before.st_mode):
                child=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=directory)
                try:
                    require(stable_dir(os.fstat(child))==stable_dir(before),'neighbor_directory_changed')
                    result[key]={'kind':'directory',**stable_dir(before)}
                    visit(child,key)
                finally: os.close(child)
            elif stat.S_ISREG(before.st_mode):
                require(before.st_size<=128*1024*1024,'neighbor_file_limit')
                fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=directory)
                try:
                    require(stamp(os.fstat(fd))==stamp(before),'neighbor_identity_changed')
                    digest=digest_fd(fd)
                    require(stamp(os.fstat(fd))==stamp(before),'neighbor_changed_during_read')
                    result[key]={'kind':'file',**stamp(before),'sha256':digest}
                finally: os.close(fd)
            elif stat.S_ISLNK(before.st_mode):
                result[key]={'kind':'symlink',**stamp(before),'target':os.readlink(name,dir_fd=directory)}
            else: raise ValueError('unsupported_neighbor_kind')
            require(stamp(os.stat(name,dir_fd=directory,follow_symlinks=False))==stamp(before),'neighbor_name_changed')
    for path,fd in sorted(parents.items()):
        result[path]={'kind':'directory',**stable_dir(os.fstat(fd))}
        visit(fd,path)
    body=json.dumps(result,sort_keys=True,separators=(',',':')).encode()
    return result,hashlib.sha256(body).hexdigest()

def assert_not_in_use(identities, own_fds):
    for process in Path('/proc').iterdir():
        if not process.name.isdigit(): continue
        try:
            for descriptor in (process/'fd').iterdir():
                if process.name==str(os.getpid()) and int(descriptor.name) in own_fds: continue
                try:
                    info=descriptor.stat()
                    require((info.st_dev,info.st_ino) not in identities,'dump_in_use')
                except FileNotFoundError: pass
            # Memory-mapped files can survive closure of their originating FD.
            for line in (process/'maps').read_text().splitlines():
                parts=line.split(None,5)
                if len(parts)<5 or parts[4]=='0': continue
                major,minor=(int(value,16) for value in parts[3].split(':'))
                require((os.makedev(major,minor),int(parts[4])) not in identities,'dump_memory_mapped')
        except FileNotFoundError: pass
        # Any permission failure is a failed preflight, never proof of absence.

def append(ledger,value):
    ledger.write((json.dumps(value,sort_keys=True)+'\n').encode());ledger.flush();os.fsync(ledger.fileno())

def fsync_directory(path):
    fd=secure_directory(path)
    try:os.fsync(fd)
    finally:os.close(fd)

def cleanup(plan,base,work):
    """Reusable only for isolated safety fixtures; production main pins base and plan."""
    base=Path(base);work=Path(work);entries=plan['entries']
    require(entries and len({e['path'] for e in entries})==len(entries),'duplicate_or_empty_selection')
    require(all(Path(e['path']).is_relative_to(base) and len(Path(e['path']).relative_to(base).parts)==2
                and Path(e['path']).suffix=='.dump' for e in entries),'selection_outside_scope')
    root=secure_directory(base);parents={};fds={};ledger=None;removed=[];began=False
    try:
        # Refuse an existing run, including a partial intent ledger.
        work.mkdir(mode=0o700,exist_ok=False)
        require(work.resolve()==work and work.stat().st_uid==0,'unsafe_workdir')
        fsync_directory(work.parent)
        lock=os.open(work/'operation.lock',os.O_RDWR|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        ledger=open(work/'progress.jsonl','xb',buffering=0)
        os.chmod(work/'progress.jsonl',0o600)
        fsync_directory(work)
        append(ledger,{'phase':'authorized_plan_selected','plan_sha256':PLAN_SHA,'count':len(entries),'at':datetime.now(timezone.utc).isoformat()})
        for entry in entries:
            path=Path(entry['path']);parent=str(path.parent)
            if parent not in parents: parents[parent]=secure_directory(path.parent)
            fd=os.open(path.name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=parents[parent]);fds[entry['path']]=fd
            info=os.fstat(fd)
            require(stat.S_ISREG(info.st_mode) and info.st_nlink==1 and info.st_uid==0 and stat.S_IMODE(info.st_mode)==0o600,'dump_identity_not_private_regular')
            require(stamp(info)==entry['identity'] and digest_fd(fd)==entry['sha256'],'dump_changed_since_authorized_review')
            require(stamp(os.stat(path.name,dir_fd=parents[parent],follow_symlinks=False))==entry['identity'],'dump_name_changed')
        identities={(e['identity']['st_dev'],e['identity']['st_ino']) for e in entries}
        assert_not_in_use(identities,set(fds.values()))
        before,before_hash=snapshot_neighbors(parents,set(fds))
        # Preserve metadata-only evidence for reconciliation, never another dump.
        with open(work/'neighbors-before.json','xb') as file:
            os.chmod(file.name,0o600);file.write(json.dumps(before,sort_keys=True).encode());file.flush();os.fsync(file.fileno())
        fsync_directory(work)
        append(ledger,{'phase':'all_preconditions_verified','neighbors_sha256':before_hash,'neighbors':len(before)})
        # Refresh after the potentially longer neighbor inventory and before any removal.
        assert_not_in_use(identities,set(fds.values()))
        began=True
        for index,entry in enumerate(entries):
            path=Path(entry['path']);parent=parents[str(path.parent)];fd=fds[entry['path']]
            # Revalidate every live pathname and descriptor immediately before unlinkat.
            require(stamp(os.fstat(fd))==entry['identity'] and digest_fd(fd)==entry['sha256'],'dump_changed_before_unlink')
            require(stamp(os.stat(path.name,dir_fd=parent,follow_symlinks=False))==entry['identity'],'replacement_at_dump_name')
            require(stable_dir(os.fstat(parent))=={key:before[str(path.parent)][key] for key in stable_dir(os.fstat(parent))},'parent_identity_changed')
            require(os.path.realpath(path.parent)==str(path.parent) and
                    stable_dir(os.stat(path.parent,follow_symlinks=False))==stable_dir(os.fstat(parent)),'parent_name_changed')
            assert_not_in_use({(entry['identity']['st_dev'],entry['identity']['st_ino'])},set(fds.values()))
            append(ledger,{'phase':'unlink_intent','index':index,'path':entry['path'],'sha256':entry['sha256']})
            os.unlink(path.name,dir_fd=parent);os.fsync(parent)
            require(os.fstat(fd).st_nlink==0,'unexpected_remaining_hardlink')
            os.close(fd);fds.pop(entry['path'])
            try:os.stat(path.name,dir_fd=parent,follow_symlinks=False)
            except FileNotFoundError: pass
            else:raise ValueError('dump_path_reappeared')
            removed.append(entry['path'])
            append(ledger,{'phase':'absence_confirmed','index':index,'path':entry['path']})
        after,after_hash=snapshot_neighbors(parents,set(e['path'] for e in entries))
        require(before==after and before_hash==after_hash,'preserved_neighbors_changed')
        for entry in entries:
            require(not os.path.lexists(entry['path']),'selected_dump_still_present')
        # Removed inodes must no longer be held by any process or map, including us.
        assert_not_in_use(identities,set())
        result={'status':'authorized_29_exact_dumps_removed_and_verified','removed_count':len(removed),
                'removed_bytes':sum(e['identity']['st_size'] for e in entries),'paths':removed,
                'plan_sha256':PLAN_SHA,'preserved_neighbor_entries':len(before),
                'neighbor_snapshot_sha256_before':before_hash,'neighbor_snapshot_sha256_after':after_hash,
                'directories_and_neighbors_preserved':True,'open_or_mapped_removed_inodes':0,
                'physical_erasure_claimed':False,'observed_at_VM_utc':datetime.now(timezone.utc).isoformat()}
        append(ledger,{'phase':'complete',**result})
        with open(work/'result.json','xb') as file:
            os.chmod(file.name,0o600);file.write(json.dumps(result).encode());file.flush();os.fsync(file.fileno())
        fsync_directory(work)
        return result
    except BaseException as error:
        if ledger:append(ledger,{'phase':'stopped_for_reconciliation','removed_paths':removed,
                                'unlink_phase_began':began,'failure_class':type(error).__name__})
        raise
    finally:
        if ledger:ledger.close()
        for fd in fds.values():os.close(fd)
        for fd in parents.values():os.close(fd)
        os.close(root)
        if 'lock' in locals():os.close(lock)

def main():
    require(os.geteuid()==0,'root_required')
    parser=argparse.ArgumentParser();parser.add_argument('--execute-authorized-plan',required=True)
    parser.add_argument('--plan',required=True);args=parser.parse_args()
    require(args.execute_authorized_plan==PLAN_SHA,'authorization_plan_mismatch')
    raw=Path(args.plan).read_bytes();require(hashlib.sha256(raw).hexdigest()==PLAN_SHA,'plan_digest_mismatch')
    plan=json.loads(raw)
    require(plan['scope_root']==str(BASE) and plan['count']==len(plan['entries'])==29 and plan['total_bytes']==7561623,'pinned_plan_scope_mismatch')
    # New run directory is outside every protected backup directory.
    parent=secure_directory(WORK.parent);os.close(parent)
    print(json.dumps(cleanup(plan,BASE,WORK)))

if __name__=='__main__':
    try:main()
    except BaseException as error:
        print(json.dumps({'status':'stopped_no_blind_replay','failure_class':type(error).__name__,
                          'private_progress_directory':str(WORK),'raw_details_emitted':False}))
        sys.exit(1)
