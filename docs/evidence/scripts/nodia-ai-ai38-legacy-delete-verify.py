"""Independent process verifies absence and preserved metadata-only inventory."""
from pathlib import Path
from collections import Counter
import hashlib,importlib.util,json,os
source=Path('/tmp/nodia-ai-ai38-legacy-backups-delete.py')
assert hashlib.sha256(source.read_bytes()).hexdigest()=='94c1e2540208952571fb1f464d6df9a8aaf09f3ca6467a89ba48d632f9c24a1e'
spec=importlib.util.spec_from_file_location('guard',source);g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
raw=Path('/tmp/nodia-ai-ai38-legacy-cleanup-plan-r01.json').read_bytes()
assert hashlib.sha256(raw).hexdigest()==g.PLAN_SHA
entries=json.loads(raw)['entries'];work=g.WORK;parents={}
try:
    for entry in entries:
        path=Path(entry['path']);assert not os.path.lexists(path)
        if str(path.parent) not in parents:parents[str(path.parent)]=g.secure_directory(path.parent)
    before=json.loads((work/'neighbors-before.json').read_bytes())
    after,digest=g.snapshot_neighbors(parents,{e['path'] for e in entries})
    assert before==after
    lines=[json.loads(line) for line in (work/'progress.jsonl').read_text().splitlines()]
    intents=[row['index'] for row in lines if row['phase']=='unlink_intent']
    absences=[row['index'] for row in lines if row['phase']=='absence_confirmed']
    assert intents==absences==list(range(29)) and lines[-1]['phase']=='complete'
    result=json.loads((work/'result.json').read_bytes())
    assert result['neighbor_snapshot_sha256_before']==result['neighbor_snapshot_sha256_after']==digest
    assert result['removed_count']==29 and result['removed_bytes']==7561623
    g.assert_not_in_use({(e['identity']['st_dev'],e['identity']['st_ino']) for e in entries},set())
    counts=dict(Counter(row['kind'] for row in after.values()))
    print(json.dumps(dict(status='independent_post_deletion_verification_passed',selected_paths_absent=29,
          selected_bytes=7561623,parent_directories_preserved=len(parents),
          neighbor_entries_preserved=len(after),neighbor_kinds=counts,neighbor_snapshot_sha256=digest,
          durable_intents=29,durable_absence_receipts=29,ledger_complete=True,
          ledger_sha256=hashlib.sha256((work/'progress.jsonl').read_bytes()).hexdigest(),
          dump_file_descriptors_or_maps_observed=0,additional_files_deleted=0,
          SQL_queries=0,provider_requests=0,physical_erasure_claimed=False)))
finally:
    for fd in parents.values():os.close(fd)
