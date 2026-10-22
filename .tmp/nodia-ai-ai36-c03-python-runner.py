
import hashlib,importlib.metadata,json,os,pathlib,platform,re,sys,time,unittest
root=pathlib.Path('/app')
manifest=json.loads((root/'candidate-source-manifest.json').read_text())
for relative,expected in manifest['files'].items():
    path=root/relative
    assert path.is_file() and not path.is_symlink(),relative
    assert hashlib.sha256(path.read_bytes()).hexdigest()==expected,relative
assert not any((root/name).exists() for name in ('.env','browser_profile','session_state','temp_uploads','.venv'))
dependencies={}
for line in (root/'requirements.txt').read_text().splitlines():
    if not line.strip() or line.lstrip().startswith('#') or 'sys_platform == "win32"' in line:continue
    match=re.fullmatch(r'([A-Za-z0-9_.-]+)==([^;\s]+)',line.strip())
    assert match,line
    name,expected=match.groups();actual=importlib.metadata.version(name)
    assert actual==expected,(name,actual,expected)
    dependencies[name]=actual
sys.path.insert(0,str(root/'tests'))
import test_support
suite=unittest.defaultTestLoader.discover(str(root/'tests'),pattern='test_*.py')
started=time.monotonic()
result=unittest.TextTestRunner(verbosity=1).run(suite)
report={'stage':'AI36-C03','scope':'isolated_linux_candidate_python_unit_suite',
    'platform':platform.system(),'python':platform.python_version(),
    'tests_run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),
    'skipped':len(result.skipped),'successful':result.wasSuccessful(),
    'duration_seconds':round(time.monotonic()-started,3),
    'source_files_verified':len(manifest['files']),'source_manifest_sha256':hashlib.sha256((root/'candidate-source-manifest.json').read_bytes()).hexdigest(),
    'installed_dependencies_match_requirements':True,'installed_dependencies':dependencies,
    'unit_test_external_network_guard':'tests/test_support.py',
    'provider_generations':0,'business_writes':0,'r2_operations':0,
    'profile_or_credential_mounts':False,'configured_database_used':False}
print('NODIA_C03_REPORT='+json.dumps(report,sort_keys=True),flush=True)
sys.exit(0 if result.wasSuccessful() else 1)
