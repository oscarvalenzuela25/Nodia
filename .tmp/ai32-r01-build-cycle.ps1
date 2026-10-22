python nodia-server/.tmp/ai32-r01-stage-native.py > nodia-server/.tmp/ai32-r01-native-build-final.log 2>&1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
ssh -i C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab -o UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts -o HostKeyAlias=nodia-vps-lab -o StrictHostKeyChecking=yes operador@172.31.209.214 "sudo -n docker run --rm --network none --read-only --tmpfs /tmp:rw,size=96m,nosuid,nodev,noexec --memory 512m --cpus 1 nodia-gemini-ai32-r01-candidate:20261018 python run_tests.py" > nodia-server/.tmp/ai32-r01-linux-final-tests.log 2>&1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
ssh -i C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab -o UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts -o HostKeyAlias=nodia-vps-lab -o StrictHostKeyChecking=yes operador@172.31.209.214 "sudo -n python3 /tmp/nodia-ai32-r01-native-candidate/ai32-r01-activate-gemini.py" > .tmp/ai32-r01-activation-final.json
exit $LASTEXITCODE
