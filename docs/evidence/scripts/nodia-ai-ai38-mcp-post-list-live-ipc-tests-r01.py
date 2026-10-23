"""Synthetic safety/ordering checks for the read-only IPC observer, no operational imports."""
import importlib.util,json,tempfile,threading,time,unittest
from pathlib import Path
SOURCE=Path(__file__).with_name('nodia-ai-ai38-mcp-post-list-live-ipc-r01.py')
spec=importlib.util.spec_from_file_location('observer',SOURCE);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def event(n=1,method='other',response=None,code=None):return {'kind':'rpc','rpc_messages':n,'tool_requests':0,'rpc_diagnostic':{'method':method,'response':response,'error_code':code}}
class Checks(unittest.TestCase):
 def test_projection_excludes_payload(self):
  v=event();v.update(arguments={'private':'MUST_NOT_ESCAPE'},name='MUST_NOT_ESCAPE');self.assertNotIn('MUST_NOT_ESCAPE',json.dumps(m.project(v,1)))
 def test_exact_error_retained(self):self.assertEqual(m.project(event(response='error',code=-32602),1)['rpc_diagnostic']['error_code'],-32602)
 def test_unknown_error_closed(self):self.assertIsNone(m.project(event(response='error',code=123456),1)['rpc_diagnostic']['error_code'])
 def test_counter_invalid(self):
  with self.assertRaises(m.ClosedObservationError):m.project(event(),2)
 def test_method_invalid(self):
  with self.assertRaises(m.ClosedObservationError):m.project(event(method='private-method'),1)
 def test_candidates_abort(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);(p/'nodia-mcp-a').mkdir();(p/'nodia-mcp-b').mkdir()
   with self.assertRaises(m.ClosedObservationError):m.sample(p)
 def test_oversize_abort(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);q=p/'nodia-mcp-a'/'bridge'/'requests';q.mkdir(parents=True);(q/'0001.json').write_bytes(b' '*65537)
   with self.assertRaises(m.ClosedObservationError):m.sample(p)
 def test_transitions_and_removed(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);root=p/'nodia-mcp-a';q=root/'bridge'/'requests';q.mkdir(parents=True);f=q/'0001.json';f.write_text(json.dumps(event(method='tools_list')))
   def writer():
    time.sleep(.07);tmp=q/'one.tmp';tmp.write_text(json.dumps(event(method='tools_list',response='success')));tmp.replace(f)
    time.sleep(.12);f.unlink();q.rmdir();q.parent.rmdir();root.rmdir()
   t=threading.Thread(target=writer);t.start()
   try:r=m.observe(p,seconds=.6,interval=.05)
   finally:t.join()
   self.assertEqual(r['status'],'candidate_removed');self.assertEqual(r['update_count'],2);self.assertEqual([x['rpc_diagnostic']['response'] for x in r['updates']],[None,'success'])
 def test_no_candidate_bounded(self):
  with tempfile.TemporaryDirectory() as d:self.assertEqual(m.observe(Path(d),seconds=.1,interval=.05)['status'],'deadline_without_candidate')
if __name__=='__main__':unittest.main(verbosity=2)
