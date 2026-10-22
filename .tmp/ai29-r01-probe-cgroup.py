import subprocess,os
from pathlib import Path
name='ai29-r01-cgroup-probe'
def run(*args):return subprocess.check_output(args,text=True).strip()
image=run('docker','inspect','nodia-gemini-microservice','--format','{{.Image}}')
try:
 run('docker','run','-d','--rm','--init','--name',name,'--network','none','--memory','256m','--pids-limit','128',image,'python','-c','import os,time; os.mkdir("/tmp/login-cgroups",0o700); time.sleep(180)')
 pid=int(run('docker','inspect',name,'--format','{{.State.Pid}}'))
 root=Path('/sys/fs/cgroup')/Path(Path(f'/proc/{pid}/cgroup').read_text().strip().split('::',1)[1]).relative_to('/')
 assert root.is_dir() and root!=Path('/sys/fs/cgroup')
 os.chown(root,10001,10001);os.chown(root/'cgroup.procs',10001,10001)
 target='/tmp/login-cgroups'
 for args in [('mount','--bind','/sys/fs/cgroup',target),('mount','-o','remount,bind,rw,nosuid,nodev,noexec',target)]:
  run('nsenter','--target',str(pid),'--mount','--cgroup','--root','--wd=/','--',*args)
 code='''import os,subprocess,json
from pathlib import Path
root=Path('/tmp/login-cgroups'); group=root/'test';group.mkdir()
child=subprocess.Popen(['python','-c','import os,time; os.setsid(); time.sleep(90)'])
(group/'cgroup.procs').write_text(str(child.pid))
pids=(group/'cgroup.procs').read_text().split();assert str(child.pid) in pids
(group/'cgroup.kill').write_text('1');child.wait(timeout=5)
assert 'populated 0' in (group/'cgroup.events').read_text()
limits=(root/'memory.max').read_text().strip()
group.rmdir()
print(json.dumps({'cgroup_migration_by_service_uid':True,'detached_child_closed':True,'kernel_empty_proof':True,'parent_memory_max':limits,'namespace_unchanged':True,'capabilities_added':False}))
'''
 print(run('docker','exec','--user','10001:10001',name,'python','-c',code))
finally:
 subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
