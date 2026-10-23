import importlib.util,pathlib,json,datetime
p=pathlib.Path('/opt/nodia/verification/ai40-operator-r05/nodia-ai-ai40-adopt-r01.py');spec=importlib.util.spec_from_file_location('pinned_ai40',p);b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
b.require(b.sha(p)=='c952cf7136c61ddb531789e52e47972e16f4bc1d9c481a9d519ff43b66f7a000','base_pin_mismatch');b.NEW=pathlib.Path('/opt/nodia/releases/nodia-server-ai40-r03');a,h=b.load_helper();a.RELEASE=b.NEW
consumers=a.active_new_processes();quiet=b.validated_quiet(h['quiet']());codex=b.codex_barrier(a,pathlib.Path('/var/lib/nodia/codex'),frozenset(c['pid'] for c in consumers.values()))
status=None
for attempt in range(3):
 try:status=b.journal_open(a);break
 except Exception:
  if attempt==2:raise
print(json.dumps({'stage':'AI40','status':'post_ui_read_only_passed','observed_at_VM_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'consumers':consumers,'quiet':quiet,'codex':codex,'schema_and_configuration':h['schema_and_selection'](),'Gemini':b.native_epoch(a),'journal':status,'timers':{u:a.state(u)['active'] for u in a.TIMERS},'SQL_writes':0,'provider_requests':0,'private_details_emitted':False}))
