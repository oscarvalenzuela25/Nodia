import json
from pathlib import Path
p=Path('.tmp/ai15-timeout-deploy');web=[json.loads(x) for x in (p/'web-events.jsonl').read_text(encoding='utf-8-sig').splitlines() if x];sock=[json.loads(x) for x in (p/'socket-observer.jsonl').read_text(encoding='utf-8-sig').splitlines() if x]
success=[x for x in web if x['event']=='web_success'];assert len(success)==1
assert sock[-1]['event']=='terminal'
print(json.dumps({'web_success':success[0],'watcher_events':len(sock),'watcher_terminal':sock[-1],'watcher_peak_established_per_process':max([v['tcp_states'].get('established',0) for s in sock for v in s.get('processes',[])],default=0)}))
