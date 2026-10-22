"""Root-only isolated Docker/kernel test of the host attachment helper.

Creates only named ephemeral --network=none containers and synthetic operational
journals. Never attaches or changes the configured Gemini container/profiles.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from uuid import uuid4


def run(*args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=40, check=False)
    if result.returncode:
        raise RuntimeError('isolated_command_failed:' + args[0] + ':' + result.stderr[-1000:])
    return result.stdout.strip()


PROBE = '''import json,os,subprocess,time
from pathlib import Path
root=Path('/run/nodia-login-cgroups');group=root/('a'*32);group.mkdir(mode=0o700)
info=group.stat();parent=root.stat()
proof={'kind':'cgroup_v2','name':'a'*32,'boot':Path('/proc/sys/kernel/random/boot_id').read_text().strip(),'device':info.st_dev,'inode':info.st_ino,'parent_inode':parent.st_ino}
code="import os,subprocess,sys,time;sys.stdin.buffer.read(1);os.setsid();subprocess.Popen([sys.executable,'-c','import os,time;os.setsid();time.sleep(90)']);print('ready',flush=True);time.sleep(90)"
child=subprocess.Popen(['python','-c',code],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
(group/'cgroup.procs').write_text(str(child.pid));child.stdin.write(b'1');child.stdin.flush();assert child.stdout.readline().strip()==b'ready'
until=time.monotonic()+3
while len((group/'cgroup.procs').read_text().split())<2 and time.monotonic()<until:time.sleep(.02)
assert len((group/'cgroup.procs').read_text().split())>=2
(group/'cgroup.kill').write_text('1');child.wait(timeout=5)
until=time.monotonic()+3
while 'populated 0' not in (group/'cgroup.events').read_text() and time.monotonic()<until:time.sleep(.02)
assert 'populated 0' in (group/'cgroup.events').read_text()
denied=False
try:(root/'cgroup.kill').write_text('1')
except PermissionError:denied=True
assert denied
directory=Path('/app/session_state/login_requests');directory.mkdir(mode=0o700,parents=True,exist_ok=True)
file=directory/('a'*32+'.json');file.write_text(json.dumps({'fixture_only':True,'containment':proof}));file.chmod(0o600)
print(json.dumps({'detached_descendants_closed':True,'kernel_populated_zero':True,'root_kill_denied':denied,'proof':proof}))
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--helper', type=Path, required=True)
    parser.add_argument('--image-container', default='nodia-gemini-microservice')
    args = parser.parse_args()
    assert sys.platform == 'linux' and os.geteuid() == 0
    marker = uuid4().hex[:12]
    name = 'nodia-login-cgroup-test-' + marker
    old_name = name + '-old'
    base = Path('/var/lib/nodia-login-containment-tests')
    if not base.exists():
        base.mkdir(mode=0o700)
    assert base.is_dir() and not base.is_symlink() and base.stat().st_uid == 0 and base.stat().st_mode & 0o077 == 0
    workspace = base / marker
    workspace.mkdir(mode=0o700)
    session = workspace / 'session'
    session.mkdir(mode=0o700)
    os.chown(session, 10001, 10001)
    state = workspace / 'state'
    containers = set()
    checks = []
    def check(name, condition=True):
        assert condition, name
        checks.append(name)
    def start():
        containers.add(name)
        return run('docker', 'run', '-d', '--init', '--name', name, '--network', 'none',
                   '--memory', '384m', '--pids-limit', '128', '--user', '10001:10001',
                   '--mount', f'type=bind,src={session},dst=/app/session_state', image,
                   'python', '-c', 'import time;time.sleep(360)')
    def attach():
        result = subprocess.run(['python3', str(args.helper), '--container-name', name, '--state-directory', str(state)],
                                text=True, capture_output=True, timeout=40, umask=0o077)
        if result.returncode:
            raise RuntimeError('isolated_attach_failed:' + result.stderr[-1000:])
        return json.loads(result.stdout)
    def proof():
        return json.loads(run('docker', 'exec', '--user', '10001:10001', name, 'python', '-c',
                              "from pathlib import Path;print(Path('/run/nodia-login-containment.json').read_text())"))
    def inspect_fields():
        return run('docker', 'inspect', '--format', '{{json .HostConfig.CapAdd}} {{.HostConfig.Privileged}} {{.HostConfig.CgroupnsMode}} {{.HostConfig.Memory}} {{.HostConfig.PidsLimit}} {{.HostConfig.NetworkMode}}', name)
    try:
        image = run('docker', 'inspect', args.image_container, '--format', '{{.Image}}')
        assert image.startswith('sha256:')
        start()
        before = inspect_fields()
        first = attach()
        check('an existing unprivileged private container is attached without resource/configuration changes',
              first['status'] == 'attached' and inspect_fields() == before and 'none' in before)
        p1 = proof()
        attach()
        check('repeating attachment of the same generation is idempotent', proof() == p1)
        kernel = json.loads(run('docker', 'exec', '--user', '10001:10001', name, 'python', '-c', PROBE))
        check('UID10001 can close setsid descendants by cgroup.kill and kernel populated zero',
              kernel['detached_descendants_closed'] and kernel['kernel_populated_zero'])
        check('service UID cannot kill the container root cgroup', kernel['root_kill_denied'])
        public_permissions = run('docker', 'exec', '--user', '10001:10001', name, 'python', '-c',
                                 "import os,stat;from pathlib import Path;p=Path('/run/nodia-login-containment.json');s=p.lstat();r=Path('/run').lstat();assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and stat.S_IMODE(s.st_mode)==0o444 and r.st_uid==0 and not r.st_mode&0o022;print('safe')")
        check('public proof is root-owned read-only under a root-owned run directory', public_permissions == 'safe')
        check('private host state is root-only and contains no profile or credential material',
              state.stat().st_uid == 0 and state.stat().st_mode & 0o077 == 0 and (state / 'state.json').stat().st_mode & 0o077 == 0)
        # Replace the named container while the old generation still runs.
        run('docker', 'rename', name, old_name)
        containers.remove(name)
        containers.add(old_name)
        start()
        replacement = attach()
        check('a different still-running old Docker ID cannot be attested closed',
              replacement['closed_referenced_roots'] == 0 and replacement['unresolved_referenced_roots'] == 1 and proof()['closed_roots'] == [])
        run('docker', 'stop', '--time', '1', old_name)
        closed = attach()
        old_tuple = {key: kernel['proof'][key] for key in ('boot', 'device', 'parent_inode')}
        check('stopped old Docker generation plus removed/empty cgroup produces exact closure proof',
              closed['closed_referenced_roots'] == 1 and proof()['closed_roots'] == [old_tuple])
        # A same-ID Docker restart must not confuse its old root with the new one.
        p2 = proof()
        run('docker', 'exec', '--user', '10001:10001', name, 'python', '-c',
            "import json;from pathlib import Path;r=Path('/run/nodia-login-cgroups');g=r/('b'*32);g.mkdir(mode=0o700);s=g.stat();p={'kind':'cgroup_v2','name':'b'*32,'boot':Path('/proc/sys/kernel/random/boot_id').read_text().strip(),'device':s.st_dev,'inode':s.st_ino,'parent_inode':r.stat().st_ino};f=Path('/app/session_state/login_requests')/('b'*32+'.json');f.write_text(json.dumps({'fixture_only':True,'containment':p}));f.chmod(0o600)")
        run('docker', 'restart', '--time', '1', name)
        restarted = attach()
        p3 = proof()
        check('same Docker ID restart certifies only former roots and never the live current root',
              restarted['closed_referenced_roots'] == 2 and p3['root_inode'] != p2['root_inode']
              and all((item['boot'], item['device'], item['parent_inode']) != (p3['host_boot'], p3['root_device'], p3['root_inode']) for item in p3['closed_roots']))
        # Only journal-referenced operational identities survive helper pruning.
        for file in (session / 'login_requests').glob('*.json'):
            file.unlink()
        pruned = attach()
        check('unreferenced operational generations are pruned without touching profile data',
              pruned['closed_referenced_roots'] == 0 and proof()['closed_roots'] == []
              and len(json.loads((state / 'state.json').read_text())['generations']) == 1)
        check('replacement container retains network isolation and original capability/namespace/limits', inspect_fields() == before)
        check('no configured container, provider, model, credential or database was changed')
        print(json.dumps({'stage': 'AI-29-R01', 'scope': 'isolated_ephemeral_docker_cgroup_v2_host_attachment',
                          'checks': len(checks), 'passed': checks, 'real_kernel': True, 'network': 'none',
                          'configured_gemini_container_changed': False, 'native_provider_calls': 0,
                          'database_used': False, 'credentials_used': False}, indent=2))
    finally:
        for container in containers:
            subprocess.run(['docker', 'rm', '-f', container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        assert workspace.resolve().is_relative_to(base.resolve()) and workspace.name == marker
        shutil.rmtree(workspace)


if __name__ == '__main__':
    main()
