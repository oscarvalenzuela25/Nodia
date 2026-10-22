"""Linux root-only safety fixtures; no production backup paths or providers."""
import importlib.util,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('guard','/tmp/nodia-ai-ai38-legacy-backups-delete.py')
guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)

class Safety(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='ai38-delete-fixture-',dir='/root')
        self.root=Path(self.temp.name);self.base=self.root/'backups';self.base.mkdir(mode=0o700)
        self.work=self.root/'work';self.entries=[];self.neighbors=[]
        for index in range(3):
            parent=self.base/str(index);parent.mkdir(mode=0o700)
            dump=parent/'database.dump';dump.write_bytes(b'PGDMP synthetic fixture '+bytes([index]));dump.chmod(0o600)
            neighbor=parent/'evidence.json';neighbor.write_text('{"synthetic":true}');self.neighbors.append(neighbor)
            fd=os.open(dump,os.O_RDONLY)
            try:self.entries.append(dict(path=str(dump),identity=guard.stamp(os.fstat(fd)),sha256=guard.digest_fd(fd)))
            finally:os.close(fd)
        self.plan={'entries':self.entries}
    def tearDown(self):self.temp.cleanup()
    def run_guard(self):return guard.cleanup(self.plan,self.base,self.work)
    def all_exist(self):self.assertTrue(all(Path(e['path']).exists() for e in self.entries))
    def test_exact_removal_preserves_neighbors_and_refuses_replay(self):
        result=self.run_guard();self.assertEqual(result['removed_count'],3)
        self.assertEqual(result['neighbor_snapshot_sha256_before'],result['neighbor_snapshot_sha256_after'])
        self.assertTrue(all(p.exists() and p.read_text()=='{"synthetic":true}' for p in self.neighbors))
        with self.assertRaises(FileExistsError):self.run_guard()
    def test_changed_content_blocks_before_first_unlink(self):
        Path(self.entries[-1]['path']).write_bytes(b'changed')
        with self.assertRaises(ValueError):self.run_guard()
        self.all_exist()
    def test_missing_last_file_does_not_remove_earlier_files(self):
        Path(self.entries[-1]['path']).unlink()
        with self.assertRaises(FileNotFoundError):self.run_guard()
        self.assertTrue(all(Path(e['path']).exists() for e in self.entries[:-1]))
    def test_symlink_file_is_rejected(self):
        name=Path(self.entries[-1]['path']);name.unlink();name.symlink_to(self.neighbors[-1])
        with self.assertRaises(OSError):self.run_guard()
        self.assertTrue(Path(self.entries[0]['path']).exists())
    def test_symlink_parent_is_rejected(self):
        parent=Path(self.entries[-1]['path']).parent;new=parent.with_name('real');parent.rename(new);parent.symlink_to(new,target_is_directory=True)
        with self.assertRaises(OSError):self.run_guard()
        self.assertTrue(Path(self.entries[0]['path']).exists())
    def test_hardlinked_dump_is_rejected(self):
        os.link(self.entries[-1]['path'],self.root/'alias.dump')
        with self.assertRaises(ValueError):self.run_guard()
        self.all_exist()
    def test_open_descriptor_blocks_entire_run(self):
        fd=os.open(self.entries[-1]['path'],os.O_RDONLY)
        try:
            with self.assertRaisesRegex(ValueError,'dump_in_use'):self.run_guard()
            self.all_exist()
        finally:os.close(fd)
    def test_parent_writable_by_others_is_rejected(self):
        Path(self.entries[-1]['path']).parent.chmod(0o777)
        with self.assertRaises(ValueError):self.run_guard()
        self.all_exist()
    def test_path_outside_scope_blocks_before_mutation(self):
        self.entries[-1]['path']=str(self.root/'foreign.dump')
        with self.assertRaises(ValueError):self.run_guard()
        self.assertTrue(Path(self.entries[0]['path']).exists());self.assertFalse(self.work.exists())
    def test_partial_failure_preserves_durable_intent_and_refuses_blind_replay(self):
        unlink=guard.os.unlink;calls=0
        def failed(name,*,dir_fd=None):
            nonlocal calls
            calls+=1
            if calls==2:raise OSError('synthetic failure')
            return unlink(name,dir_fd=dir_fd)
        with patch.object(guard.os,'unlink',side_effect=failed):
            with self.assertRaises(OSError):self.run_guard()
        self.assertFalse(Path(self.entries[0]['path']).exists())
        self.assertTrue(Path(self.entries[1]['path']).exists())
        rows=[json.loads(line) for line in (self.work/'progress.jsonl').read_text().splitlines()]
        self.assertTrue(any(row['phase']=='unlink_intent' and row.get('index')==1 for row in rows))
        self.assertTrue(any(row['phase']=='absence_confirmed' and row.get('index')==0 for row in rows))
        self.assertEqual(rows[-1]['phase'],'stopped_for_reconciliation')
        with self.assertRaises(FileExistsError):self.run_guard()

if __name__=='__main__':
    require=guard.require;require(os.geteuid()==0,'root_required')
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(Safety)
    result=unittest.TestResult();suite.run(result)
    print(json.dumps({'scope':'isolated_root_private_synthetic_files_only','tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),
                      'failed_cases':[case.id() for case,_ in result.failures+result.errors],
                      'production_backup_paths_touched':False,'provider_requests':0}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
