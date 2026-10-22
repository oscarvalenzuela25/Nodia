import sys, unittest, json, hashlib
from pathlib import Path
root=Path.cwd()
sys.path.insert(0,str(root));sys.path.insert(0,str(root/'tests'))
import test_support
excluded={'test_invoice_mcp_contract','test_agentic_cli_versions','test_agentic_observation_timeout'}
def flatten(suite):
    for item in suite:
        if isinstance(item,unittest.TestSuite):yield from flatten(item)
        else:yield item
all_cases=list(flatten(unittest.defaultTestLoader.discover(str(root/'tests'),pattern='test_*.py')))
cases=[case for case in all_cases if case.__class__.__module__ not in excluded]
result=unittest.TextTestRunner(verbosity=1).run(unittest.TestSuite(cases))
if not result.wasSuccessful():sys.exit(1)
hash_file=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
test_files={p.relative_to(root/'tests').as_posix():hash_file(p) for p in sorted((root/'tests').rglob('*')) if p.is_file() and p.suffix in ('.py','.json') and p.stem not in excluded}
report={'stage':'AI-38 MCP protocol diagnostics','status':'passed_local_offline_only','sources':{name:hash_file(root/name) for name in ('native_mcp_sessions.py','native_mcp_stdio.py')},'test_files':test_files,'excluded_test_modules':sorted(excluded),'expected_applicable_tests':len(cases),'discovered_complete_suite_tests':len(all_cases),'local_filtered_result':{'run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),'platform':sys.platform},'full_suite_result':{'run':473,'failures':0,'errors':0,'skipped':2,'log':'.tmp/ai38-mcp-rpc-tests-final03.log'},'provider_generations':0,'vm_changes':False}
target=root.parent/'.tmp/ai38-mcp-protocol-freeze-r02.json'
if target.exists():raise RuntimeError('Existing freeze not overwritten')
target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':report['status'],'expected_applicable_tests':len(cases),'test_files':len(test_files),'freeze':str(target)}))
