"""Bounded metadata from exactly access.log.1 and access.log across the observed rotation."""
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat

SOURCE=Path('/opt/nodia/verification/ai38-live-ui-r01/http-observer.py')
CURSOR=Path('/opt/nodia/verification/ai38-live-ui-r01/private/http-cursor.json')
SOURCE_SHA='1587fd82495866362cc77d88b469ff4a0bc789bbc80d83356eb4223eeff63e9d'
CUTOFF=datetime.fromisoformat('2026-10-21T03:03:26+00:00')
MAX_BYTES=16*1024*1024
CHAT='a160f615-ea41-4a05-831d-acdbb413ec4d'
PROPOSAL='e73f0a17-62d5-41e9-97dd-20d9b30dcc58'
EXECUTION='57c70fda-56e5-4456-82b2-2d6aa5794079'

def sha(data):return hashlib.sha256(data).hexdigest()

def main():
    assert sha(SOURCE.read_bytes())==SOURCE_SHA
    spec=importlib.util.spec_from_file_location('ai38_http_frozen_r03',SOURCE)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    info=CURSOR.lstat()
    assert stat.S_ISREG(info.st_mode) and info.st_uid==os.geteuid() and stat.S_IMODE(info.st_mode)==0o600
    assert info.st_size<=16384 and info.st_nlink==1
    raw=CURSOR.read_bytes();cursor=json.loads(raw)
    assert cursor['source_sha256']==SOURCE_SHA and cursor['conversation_id']==CHAT
    assert cursor['log_path']=='/var/log/nginx/access.log'
    identities=[];old_data=b'';old_verified=False
    old=Path('/var/log/nginx/access.log.1');current=Path('/var/log/nginx/access.log')
    # No glob, rotated-file search, compressed-log reads or logfile mutations.
    for role,target in (('previous_explicit',old),('current_explicit',current)):
        st=target.lstat()
        assert stat.S_ISREG(st.st_mode) and not stat.S_ISLNK(st.st_mode)
        identities.append({'role':role,'device':st.st_dev,'inode':st.st_ino,'bytes':st.st_size})
    with module.open_log(old)[0] as handle:
        before=os.fstat(handle.fileno())
        if (before.st_dev,before.st_ino)==(cursor['device'],cursor['inode']):
            assert before.st_size>=cursor['offset'] and before.st_size-cursor['offset']<=MAX_BYTES
            assert module.anchor(handle,cursor['offset'])==cursor['anchor']
            module.boundary(handle,before.st_size);handle.seek(cursor['offset'])
            old_data=handle.read(before.st_size-cursor['offset'])
            after=os.fstat(handle.fileno());again=old.lstat()
            assert (after.st_dev,after.st_ino,after.st_size)==(before.st_dev,before.st_ino,before.st_size)
            assert (again.st_dev,again.st_ino)==(before.st_dev,before.st_ino)
            assert module.anchor(handle,cursor['offset'])==cursor['anchor']
            old_verified=True
    with module.open_log(current)[0] as handle:
        before=os.fstat(handle.fileno());assert before.st_size<=MAX_BYTES
        module.boundary(handle,before.st_size);handle.seek(0);current_data=handle.read(before.st_size)
        after=os.fstat(handle.fileno());again=current.lstat()
        assert len(current_data)==before.st_size and after.st_size>=before.st_size
        assert (again.st_dev,again.st_ino)==(before.st_dev,before.st_ino)
    combined=old_data+current_data
    assert len(combined)<=MAX_BYTES
    start=datetime.fromisoformat(cursor['began_at_utc']) if old_verified else datetime.fromisoformat('2026-10-21T03:00:00+00:00')
    selected=[];outside=unparseable=0
    for line in combined.splitlines(keepends=True):
        match=module.LINE.match(line)
        if not match:
            unparseable+=1;continue
        stamp=datetime.strptime(match[1].decode('ascii'),'%d/%b/%Y:%H:%M:%S %z').astimezone(timezone.utc)
        if start<=stamp<=CUTOFF:selected.append(line)
        else:outside+=1
    result={'schema':'ai38-live-ui-http-observer-v1','action':'end','status':'bounded_metadata_observed_not_Google_or_UI_acceptance',
        'scope':'explicit_two_file_rotation_metadata_continuation' if old_verified else 'new_current_file_exact_time_metadata_no_original_cursor_continuity',
        'source_sha256':sha(Path(__file__).read_bytes()),'frozen_parser_sha256':SOURCE_SHA,
        'began_at_utc':start.isoformat(),'finished_at_utc':CUTOFF.isoformat(),
        'observed_at_VM_utc':datetime.now(timezone.utc).isoformat(),'explicit_log_metadata':identities,
        'old_inode_and_cursor_anchor_verified':old_verified,'cursor_sha256':sha(raw),
        'start_anchor_verified':old_verified,'original_cursor_full_continuity_claimed':False,
        'acceptance_conversation_sha256':sha(CHAT.encode()),'acceptance_proposal_sha256':sha(PROPOSAL.encode()),
        'acceptance_execution_sha256':sha(EXECUTION.encode()),'acceptance_movement_sha256':sha(b'1'),
        **module.project(b''.join(selected),CHAT,PROPOSAL,EXECUTION,'1'),
        'read_bytes':len(combined),'selected_bytes':sum(map(len,selected)),
        'outside_time_window_lines_excluded':outside,'unparseable_lines_not_projected':unparseable,
        'raw_log_saved':False,'credentials_emitted':False,'provider_requests':0,'source_modified':False,
        'earlier_failed_observations_preserved':['nodia-ai-ai38-live-http-final-r01.json','nodia-ai-ai38-live-http-final-r02.json'],
        'limits':['Frozen original observer correctly refused a changed inode; these are separate successor metadata observations.',
                  'Only the explicitly named previous/current files were read, bounded to 16 MiB combined and the closed timestamp window.',
                  'Old inode plus unchanged prefix anchor is checked if present; no claim excludes every rotation/copytruncate loss or unseen duplicate.',
                  'Counts correlate known resource IDs and SQL; neither physical UI gesture nor HTTP bodies/tokens are observed.',
                  'Requests after 2026-10-21T03:03:26Z are excluded; earlier 401 responses remain counted honestly.']}
    print(json.dumps(result,indent=2))

if __name__=='__main__':
    try:main()
    except Exception:
        print(json.dumps({'schema':'ai38-live-http-diagnostic-r03','status':'failed_observation','details_withheld':True}))
        raise SystemExit(1)
