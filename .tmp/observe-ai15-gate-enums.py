"""Read only the bounded enum sidecar of the known Gemini Agentic profile; no app imports."""
import argparse
import json
import os
import stat
import signal
import tempfile
import time
from pathlib import Path

ROOT = Path('/opt/nodia/nodia-gemini-microservice/agentic_profile')
CATEGORIES = frozenset({'allowed_finish','finish_arguments','dispatcher_envelope','dispatcher_extra_fields','foreign_server','unregistered_tool','arguments_type','arguments_json','arguments_shape','allowed_registered','unregistered_native','payload_shape','invalid_json'})
KINDS = frozenset({'finish','dispatcher','registered','other'})

def pairs(items):
    result = {}
    for key,value in items:
        if key in result: raise ValueError('duplicate')
        result[key]=value
    return result

def project(raw):
    if len(raw)>65536: return None
    lines=raw.splitlines()
    if len(lines)>128: return None
    events=[]
    for line in lines:
        try: value=json.loads(line,object_pairs_hook=pairs)
        except (ValueError,UnicodeError): continue
        if (isinstance(value,dict) and set(value)=={'category','call_kind'}
            and isinstance(value['category'],str) and value['category'] in CATEGORIES
            and isinstance(value['call_kind'],str) and value['call_kind'] in KINDS):
            events.append((value['category'],value['call_kind']))
    return events

def sidecars(root):
    count=0
    root_fd=None
    try:
        root_fd=os.open(root,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
        with os.scandir(root_fd) as entries:
            for index,entry in enumerate(entries):
                if index>=256: break
                if not entry.name.startswith('nodia-mcp-') or not entry.is_dir(follow_symlinks=False): continue
                directory_fd=bridge_fd=descriptor=None
                try:
                    directory_fd=os.open(entry.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=root_fd)
                    bridge_fd=os.open('bridge',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=directory_fd)
                    descriptor=os.open('gate-diagnostic.jsonl',os.O_RDONLY|os.O_NOFOLLOW,dir_fd=bridge_fd)
                    info=os.fstat(descriptor)
                    if not stat.S_ISREG(info.st_mode) or info.st_size>65536: continue
                    raw=os.read(descriptor,65537)
                    value=project(raw)
                    if value is not None: yield (info.st_dev,info.st_ino),value
                except OSError: continue
                finally:
                    for owned in (descriptor,bridge_fd,directory_fd):
                        if owned is not None: os.close(owned)
                count+=1
                if count>=8: break
    except OSError: return
    finally:
        if root_fd is not None: os.close(root_fd)

def self_test():
    assert project(b'{"category":"arguments_type","call_kind":"registered"}\n')==[('arguments_type','registered')]
    for raw in [b'{"category":"secret","call_kind":"registered"}', b'{"category":"arguments_type","call_kind":"tool-secret"}',b'{"category":"arguments_type","call_kind":"registered","payload":"SECRET"}',b'{"category":"arguments_type","category":"allowed_finish","call_kind":"registered"}']:
        assert project(raw)==[]
    assert project(b'x'*65537) is None
    with tempfile.TemporaryDirectory() as name:
        root=Path(name);bridge=root/'nodia-mcp-synthetic'/'bridge';bridge.mkdir(parents=True)
        (bridge/'gate-diagnostic.jsonl').write_text('{"category":"arguments_type","call_kind":"registered"}\n')
        assert [x[1] for x in sidecars(root)]==[[('arguments_type','registered')]]
        (bridge/'gate-diagnostic.jsonl').unlink();target=root/'secret';target.write_text('SECRET')
        (bridge/'gate-diagnostic.jsonl').symlink_to(target)
        assert list(sidecars(root))==[]
    print(json.dumps({'self_test':True,'whitelist_categories':len(CATEGORIES),'whitelist_call_kinds':len(KINDS),'secret_or_proof_files_read':False}))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--seconds',type=int,default=150);parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
    if args.self_test: self_test();return
    if not 1<=args.seconds<=150: raise SystemExit('bounded_duration_required')
    if ROOT.is_symlink() or ROOT.resolve()!=ROOT: raise SystemExit('invalid_profile_root')
    output=Path(tempfile.mkdtemp(prefix='nodia-ai15-gate-observer-',dir='/tmp'));os.chmod(output,0o700)
    target=output/'events.json';started=time.monotonic();snapshots={};stopping=[False]
    signal.signal(signal.SIGTERM,lambda *_: stopping.__setitem__(0,True))
    print(json.dumps({'observer_ready':True,'observer_pid':os.getpid(),'private_output':str(target),'maximum_seconds':args.seconds,'inference_performed':False}),flush=True)
    try:
        while not stopping[0] and time.monotonic()-started<args.seconds:
            for identity,events in sidecars(ROOT):
                if identity in snapshots or len(snapshots)<8: snapshots[identity]=events
            time.sleep(min(0.05,max(0,args.seconds-(time.monotonic()-started))))
    finally:
        counts={}
        for events in snapshots.values():
            for category,kind in events: counts[(category,kind)]=counts.get((category,kind),0)+1
        report={'read_only':True,'inference_performed':False,'maximum_seconds':args.seconds,'observed_sidecars':len(snapshots),'events':[{'category':category,'call_kind':kind,'count':count} for (category,kind),count in sorted(counts.items())]}
        descriptor=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(descriptor,'w') as stream: json.dump(report,stream);stream.write('\n')
        print(json.dumps(report),flush=True)

if __name__=='__main__':main()


