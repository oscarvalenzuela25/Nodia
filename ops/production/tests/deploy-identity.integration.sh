#!/usr/bin/env bash
# Run only inside a disposable root Ubuntu container. Never on the VPS/host.
set -Eeuo pipefail
[[ -f /.dockerenv && $(id -u) == 0 && -f /input/bootstrap-deploy-identity.py ]]
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends python3 openssh-server openssh-client >/tmp/install.log 2>&1
mkdir -p /run/sshd
ssh-keygen -q -t ed25519 -N '' -f /tmp/fixture-key
ssh-keygen -q -t ed25519 -N '' -f /tmp/unrelated-key
cat >/tmp/sshd_config <<'EOF'
Port 2222
ListenAddress 127.0.0.1
HostKey /etc/ssh/ssh_host_ed25519_key
PidFile /tmp/test-sshd.pid
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
UsePAM yes
AuthorizedKeysFile .ssh/authorized_keys
LogLevel ERROR
EOF
/usr/sbin/sshd -f /tmp/sshd_config
printf '[127.0.0.1]:2222 %s\n' "$(cat /etc/ssh/ssh_host_ed25519_key.pub)" >/tmp/fixture-known-hosts
python3 -I - <<'PY'
import hashlib,json,os,pathlib,subprocess
script='/input/bootstrap-deploy-identity.py'
original_key=pathlib.Path('/tmp/fixture-key.pub')
key=pathlib.Path('/tmp/fixture-key-crlf.pub')
key.write_bytes(original_key.read_bytes().removesuffix(b'\n')+b'\r\n')
command=['python3','-I',script,'--public-key',str(key),'--public-key-sha256',hashlib.sha256(key.read_bytes()).hexdigest()]
checks=0
def check(condition):
    global checks
    assert condition
    checks+=1
def run(arguments):
    return subprocess.run(arguments,capture_output=True,text=True,timeout=15)
first=run(command)
assert first.returncode==0,(first.stdout,first.stderr)
check(first.returncode==0)
check(json.loads(first.stdout)['sudo_grant_created'] is False)
again=run(command)
check(again.returncode==0 and json.loads(again.stdout)==json.loads(first.stdout))
check(key.read_bytes().endswith(b'\r\n'))
lf_command=command.copy();lf_command[lf_command.index(str(key))]=str(original_key)
lf_command[-1]=hashlib.sha256(original_key.read_bytes()).hexdigest()
check(run(lf_command).returncode==0)
ssh=['ssh','-T','-i','/tmp/fixture-key','-p','2222','-o','BatchMode=yes','-o','IdentitiesOnly=yes',
    '-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile=/tmp/fixture-known-hosts','nodia-deploy@127.0.0.1']
result=run([*ssh,'status'])
check(result.returncode==0)
status=json.loads(result.stdout)
check(status['status']=='identity_verified' and status['deployment_implemented'] is False)
for original in ['whoami','id','status; id','status\nid','sudo -n true','sh','', '/usr/lib/openssh/sftp-server']:
    denied=run([*ssh,original])
    check(denied.returncode==64 and json.loads(denied.stderr)['error_code']=='only_status_is_enabled')
other=ssh.copy();other[other.index('/tmp/fixture-key')]='/tmp/unrelated-key'
check(run([*other,'status']).returncode==255)
check(run(['runuser','-u','nodia-deploy','--','sh','-c','echo tamper >> /var/lib/nodia-deploy/.ssh/authorized_keys']).returncode!=0)
check(run(['runuser','-u','nodia-deploy','--','sh','-c','echo tamper >> /usr/local/lib/nodia/deploy-gateway.py']).returncode!=0)
check(run(['id','-Gn','nodia-deploy']).stdout.strip()=='nodia-deploy')
for path in ['/var/lib/nodia-deploy','/var/lib/nodia-deploy/.ssh','/usr/local/lib/nodia']:
    info=pathlib.Path(path).stat()
    check(info.st_uid==info.st_gid==0 and info.st_mode&0o777==0o755)
for path in ['/var/lib/nodia-deploy/.ssh/authorized_keys','/usr/local/lib/nodia/deploy-gateway.py']:
    check(pathlib.Path(path).stat().st_uid==0)
authorized=pathlib.Path('/var/lib/nodia-deploy/.ssh/authorized_keys').read_text()
check(authorized.startswith('restrict,command="/usr/bin/python3 -I /usr/local/lib/nodia/deploy-gateway.py" ssh-ed25519 '))
wrong=command.copy();wrong[-1]='0'*64
check(run(wrong).returncode==1)
wrong=command.copy();wrong[wrong.index(str(key))]='/tmp/unrelated-key.pub'
wrong[-1]=hashlib.sha256(pathlib.Path('/tmp/unrelated-key.pub').read_bytes()).hexdigest()
check(run(wrong).returncode==1)
check(pathlib.Path('/var/lib/nodia-deploy/.ssh/authorized_keys').read_text()==authorized)
print(json.dumps({'status':'passed','checks':checks,'real_loopback_ssh_tested':True,'production_accessed':False}))
PY
