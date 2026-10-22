import json,subprocess,os
from urllib.parse import urlsplit
p=subprocess.run(['sudo','docker','inspect','nodia-gemini-microservice'],capture_output=True,text=True,check=True)
d=json.loads(p.stdout)[0];h=d['HostConfig']
info=json.loads(subprocess.run(['sudo','docker','info','--format','{{json .}}'],capture_output=True,text=True,check=True).stdout)
def shape(v):
 if not v:return {'present':False}
 try:
  u=urlsplit(v)
  return {'present':True,'scheme':u.scheme if u.scheme in ('http','https','socks5','socks5h') else 'other','userinfo_present':u.username is not None}
 except ValueError:return {'present':True,'scheme':'invalid'}
print(json.dumps({'container_network':{'network_mode':h['NetworkMode'],'dns':h.get('Dns'),'dns_options':h.get('DnsOptions'),'dns_search_count':len(h.get('DnsSearch') or []),'networks':[{'name':k,'ipv6_assigned':bool(v.get('GlobalIPv6Address'))} for k,v in d['NetworkSettings']['Networks'].items()],'container_restart_count':d['RestartCount'],'started_at':d['State']['StartedAt'],'oom_killed':d['State']['OOMKilled']},'daemon_proxy':{k:shape(info.get(k,'')) for k in ('HTTPProxy','HTTPSProxy','NoProxy')}}))
