"""Controlled lab source update. Explicit archive allowlist, code backup and no credential/profile writes."""
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tarfile
import time
from uuid import uuid4


def main() -> None:
    archive, manifest_path = map(Path, sys.argv[1:3])
    target=Path('/opt/nodia/nodia-gemini-microservice')
    if target.is_symlink() or target.resolve()!=target:
        raise RuntimeError('Unexpected lab source root')
    manifest=json.loads(manifest_path.read_text())
    if manifest['kind']!='microservice':raise RuntimeError('Wrong release kind')
    expected={item['path']:item['sha256'] for item in manifest['files']}
    credential=target/'.env'
    original_credential=(hashlib.sha256(credential.read_bytes()).digest(),credential.stat().st_uid,
                         credential.stat().st_gid,credential.stat().st_mode)
    payloads={}
    with tarfile.open(archive,'r:gz') as incoming:
        members=incoming.getmembers()
        if len(members)!=len(expected):raise RuntimeError('Unexpected archive cardinality')
        for member in members:
            parts=Path(member.name).parts
            if member.name not in expected or not member.isfile() or member.size>2*1024*1024 or '..' in parts or Path(member.name).is_absolute():
                raise RuntimeError('Invalid release member')
            allowed=(len(parts)==1 and (member.name.endswith('.py') or member.name in {'Dockerfile','requirements.txt','antigravity-cli.lock.json','.dockerignore'})) or (parts[0] in {'scripts','experiments'} and member.name.endswith('.py'))
            if not allowed or any(part in {'.env','browser_profile','agentic_profile','session_state','node_modules','.venv'} for part in parts):
                raise RuntimeError('Operational data is not a release source')
            content=incoming.extractfile(member).read()
            if hashlib.sha256(content).hexdigest()!=expected[member.name]:raise RuntimeError('Release hash mismatch')
            destination=target/member.name
            if any(parent.is_symlink() for parent in [destination,*destination.parents] if parent!=Path('/')):
                raise RuntimeError('Symlink in destination')
            payloads[member.name]=content
    backup=Path('/opt/nodia/verification-backups')/f'ai11-ai12-{int(time.time())}'
    backup.mkdir(parents=True,mode=0o700)
    with tarfile.open(backup/'microservice-source.tar.gz','w:gz') as saved:
        for name in sorted(payloads):
            existing=target/name
            if existing.is_file():saved.add(existing,arcname=name,recursive=False)
    for name,content in payloads.items():
        destination=target/name
        destination.parent.mkdir(parents=True,exist_ok=True)
        existing=destination.stat() if destination.exists() else None
        temporary=destination.with_name(f'.ai11-{uuid4().hex}.tmp')
        with temporary.open('xb') as output:
            output.write(content);output.flush();os.fsync(output.fileno())
        os.chmod(temporary,0o644)
        if existing is not None:os.chown(temporary,existing.st_uid,existing.st_gid)
        os.replace(temporary,destination)
    preserved=original_credential==(hashlib.sha256(credential.read_bytes()).digest(),credential.stat().st_uid,
                                   credential.stat().st_gid,credential.stat().st_mode)
    if not preserved:raise RuntimeError('Credential preservation check failed')
    print(json.dumps({'files_updated':len(payloads),'backup':str(backup),'credential_bytes_owner_mode_preserved':preserved,
                      'profile_files_written':0,'expected_files':list(sorted(payloads))},indent=2))


if __name__=='__main__':main()
