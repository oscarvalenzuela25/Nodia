from pathlib import Path
import subprocess,json,os,time
subprocess.run(['systemctl','start','nodia-api','nodia-ai-worker'],check=True,capture_output=True,timeout=45)
time.sleep(2)
rows={}
for unit in ['nodia-api','nodia-ai-worker']:
 raw=subprocess.check_output(['systemctl','show',unit,'--property=ActiveState,MainPID,WorkingDirectory','--no-pager']).decode()
 row=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
 pid=int(row['MainPID']); proc=Path('/proc')/str(pid)
 env=dict(p.split(b'=',1) for p in (proc/'environ').read_bytes().rstrip(b'\0').split(b'\0') if b'=' in p)
 argv=(proc/'cmdline').read_bytes().rstrip(b'\0').split(b'\0')
 entry='main.js' if unit=='nodia-api' else 'nodia-ai-worker.js'
 root='/opt/nodia/releases/nodia-server-ai38-journal-r01'
 rows[unit]={**row,'cwd':os.readlink(proc/'cwd'),'argv_count':len(argv),'argv_node_exact':argv[0]==b'/usr/local/bin/node','argv_entry_exact':argv[1]==(root+'/dist/'+entry).encode(),'recovery_env_exact':env.get(b'NODIA_AI_RECOVERY_CONFIG_FILE')==b'/etc/nodia-ai-recovery/recovery.json','dotenv_env_exact':env.get(b'DOTENV_CONFIG_PATH')==b'/opt/nodia/releases/nodia-server-ai15-20261016/.env'}
print(json.dumps({'scope':'controlled_new_package_restart_and_selected_process_diagnostics','rows':rows,'provider_requests':0}))
