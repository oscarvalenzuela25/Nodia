"""Offline ownership barrier: cancel observe while shared refresh is closing its fake CLI."""
import asyncio
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import AsyncMock

root=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(root/'nodia-gemini-microservice'))
sys.path.insert(0,str(root/'nodia-gemini-microservice/tests'))
import test_support
from agentic_service import AntigravityAgentService
from agentic_cli import CliConfig
from nodia_ai_chat import ChatAdapter,ObserveRequest
from profile_admission import ProfileAdmission
from service_errors import ServiceError

async def main():
 with tempfile.TemporaryDirectory(prefix='nodia-offline-observe-cancel-') as directory:
  base=Path(directory);home=base/'agentic';home.mkdir()
  started,cleanup_started,cleanup_release=(asyncio.Event() for _ in range(3))
  async def blocked(*args,**kwargs):
   started.set()
   try:await asyncio.Event().wait()
   finally:
    cleanup_started.set()
    await cleanup_release.wait()
  runner=SimpleNamespace(config=CliConfig(Path(sys.executable),'',home),run=AsyncMock(side_effect=blocked))
  service=AntigravityAgentService(runner);service._available=True
  profiles=ProfileAdmission(base/'web',home,base/'state')
  adapter=ChatAdapter(None,service,profiles)
  task=asyncio.create_task(adapter.observe('agentic',ObserveRequest(model_id='synthetic-model',effort_id=None)))
  await asyncio.wait_for(started.wait(),1)
  task.cancel()
  await asyncio.wait_for(cleanup_started.wait(),1)
  busy=False
  try:profiles.reserve('agentic')
  except ServiceError as error:busy=error.code=='runtime_busy'
  pending=not task.done()
  cleanup_release.set()
  cancelled=False
  try:await task
  except asyncio.CancelledError:cancelled=True
  reservation=profiles.reserve('agentic');reservation.release()
  result={'scope':'offline_single_cancel_observe_waits_for_shared_refresh_cleanup_before_profile_release',
   'status':'passed','profile_still_busy_during_cleanup':busy,'observe_pending_during_cleanup':pending,
   'cancellation_propagated_after_cleanup':cancelled,'shared_refresh_done':service._refresh.done(),
   'profile_reacquired_after_cleanup':True,'fake_runner_calls':runner.run.await_count,
   'real_processes_started':0,'provider_CLI_executions':0,'network_requests':0,'production_source_changes':0,
   'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
   'source_hashes':{name:hashlib.sha256((root/'nodia-gemini-microservice'/name).read_bytes()).hexdigest() for name in ('agentic_service.py','nodia_ai_chat.py','profile_admission.py')},
   'interpretation':'Current single cancellation awaits refresh cleanup before releasing ownership. This does not prove repeated cancellation, uncooperative runner shutdown, or real metadata timing.'}
  assert busy and pending and cancelled and result['shared_refresh_done']
  assert runner.run.await_count==1
  print(json.dumps(result,indent=2))

if __name__=='__main__':asyncio.run(main())
