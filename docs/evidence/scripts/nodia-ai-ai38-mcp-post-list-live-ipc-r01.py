"""Bounded read-only observer of transient MCP IPC; never invokes application code."""
from datetime import datetime, timezone
import argparse
import json
import os
from pathlib import Path
import re
import time

METHODS={'initialize','notifications_initialized','tools_list','tools_call','ping','other'}
RESPONSES={None,'success','error','notification'}
ERRORS={-32700,-32600,-32601,-32602,-32603,-32000}

class ClosedObservationError(Exception):
    pass

def require(ok, code):
    if not ok: raise ClosedObservationError(code)

def project(value, ordinal):
    require(isinstance(value,dict), 'invalid_IPC_object')
    kind=value.get('kind')
    require(kind in {'rpc','tool_request'},'invalid_IPC_kind')
    sequence=value.get('rpc_messages');tools=value.get('tool_requests')
    require(type(sequence) is int and sequence==ordinal and type(tools) is int and 0<=tools<=ordinal,'invalid_IPC_counters')
    d=value.get('rpc_diagnostic')
    if d is not None:
        require(isinstance(d,dict) and set(d)=={'method','response','error_code'},'invalid_diagnostic_shape')
        require(type(d['method']) is str and d['method'] in METHODS and (d['response'] is None or type(d['response']) is str) and d['response'] in RESPONSES,'invalid_diagnostic_enum')
        code=d['error_code']
        require(code is None or type(code) is int,'invalid_error_type')
        require((d['response']=='error')==(type(code) is int),'invalid_error_consistency')
        d={'method':d['method'],'response':d['response'],'error_code':code if code in ERRORS else None,'unrecognized_error_code':code is not None and code not in ERRORS}
    else:
        require(kind=='tool_request','missing_RPC_diagnostic')
    return {'ordinal':ordinal,'kind':kind,'rpc_messages':sequence,'tool_requests':tools,'rpc_diagnostic':d}

def sample(home):
    require(home.is_dir() and not home.is_symlink(),'invalid_configured_home')
    candidates=list(home.glob('nodia-mcp-*'))
    require(len(candidates)<=1,'multiple_candidates_abort')
    if not candidates:return None,[]
    root=candidates[0]
    require(root.is_dir() and not root.is_symlink(),'unsafe_candidate')
    bridge=root/'bridge';requests=bridge/'requests'
    if not requests.exists():return root,[]
    require(bridge.is_dir() and not bridge.is_symlink() and requests.is_dir() and not requests.is_symlink(),'unsafe_IPC_directory')
    paths=list(requests.glob('*.json'))
    require(len(paths)<=128,'IPC_file_budget')
    events=[]
    for p in sorted(paths):
        require(re.fullmatch(r'\d{4}\.json',p.name) is not None and p.is_file() and not p.is_symlink(),'unsafe_IPC_member')
        try:
            with p.open('rb') as stream:raw=stream.read(65537)
        except FileNotFoundError:
            continue # TemporaryDirectory may disappear between listing and read.
        require(len(raw)<=65536,'IPC_byte_budget')
        try:value=json.loads(raw)
        except (ValueError,UnicodeError):raise ClosedObservationError('invalid_IPC_JSON') from None
        events.append(project(value,int(p.stem)))
    return root,events

def observe(home, seconds=180, interval=0.1):
    require(0<seconds<=180 and .05<=interval<=.1,'invalid_observer_bounds')
    start=time.monotonic();seen_root=None;seen={};updates=[]
    status='deadline_without_candidate'
    while time.monotonic()-start<seconds:
        root,events=sample(home)
        if root is None:
            if seen_root is not None:status='candidate_removed';break
        else:
            require(seen_root is None or seen_root==root,'candidate_replaced_abort')
            seen_root=root;status='deadline_with_candidate'
            for item in events:
                ordinal=item['ordinal'];fingerprint=json.dumps(item,sort_keys=True)
                if seen.get(ordinal)!=fingerprint:
                    require(len(updates)<256,'transition_budget')
                    updates.append({'observed_relative_ms':round((time.monotonic()-start)*1000),'observed_VM_utc':datetime.now(timezone.utc).isoformat(),**item})
                    seen[ordinal]=fingerprint
        time.sleep(interval)
    return {'schema':'ai38-mcp-post-list-live-IPC-v1','status':status,'elapsed_ms':round((time.monotonic()-start)*1000),'candidate_seen':seen_root is not None,'updates':updates,'update_count':len(updates),'unique_ordinals':len(seen),'snapshot_poll_interval_ms':round(interval*1000),'polling_cannot_prove_unobserved_intermediate_states':True,'raw_method_names_not_retained_by_current_bridge':True,'only_bridge_request_files_opened':True,'profile_or_session_bytes_opened':False,'payload_names_arguments_or_raw_logs_emitted':False,'HTTP_requests':0,'provider_generation_requests':0,'service_changes':0}

def main():
    p=argparse.ArgumentParser();p.add_argument('--observe-live-ipc',action='store_true',required=True);p.parse_args()
    value=os.environ.get('ANTIGRAVITY_CLI_HOME');require(isinstance(value,str) and Path(value).is_absolute(),'configured_home_required')
    print(json.dumps({'event':'observer_ready','maximum_seconds':180,'poll_interval_ms':100}),flush=True)
    print(json.dumps(observe(Path(value)),separators=(',',':')),flush=True)

if __name__=='__main__':
    try:main()
    except ClosedObservationError as e:
        print(json.dumps({'schema':'ai38-mcp-post-list-live-IPC-v1','status':'aborted','reason':str(e),'private_paths_or_payloads_emitted':False}),flush=True)
        raise SystemExit(1)
    except Exception:
        print(json.dumps({'schema':'ai38-mcp-post-list-live-IPC-v1','status':'aborted','reason':'unexpected_observer_error','private_paths_or_payloads_emitted':False}),flush=True)
        raise SystemExit(1)
