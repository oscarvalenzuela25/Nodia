"""Verify immutable compiled candidate and prepare an isolated test directory only."""
import hashlib,json,os,pathlib,re,sys,tarfile
archive=pathlib.Path('/tmp/ai33-sql-stage.tar')
expected=sys.argv[1]
assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected
suffix=sys.argv[2]
assert re.fullmatch(r'attempt[0-9]{2}',suffix)
target=pathlib.Path('/opt/nodia/verification/ai33-compiled-'+suffix)
target.mkdir(mode=0o700,exist_ok=False)
with tarfile.open(archive) as t:
    for m in t.getmembers():
        p=pathlib.PurePosixPath(m.name)
        assert not p.is_absolute() and '..' not in p.parts and not m.issym() and not m.islnk()
        assert p.parts[0] in ('dist','package.json','package-lock.json','test','.tmp')
    t.extractall(target,filter='data')
manifest=json.loads((target/'.tmp/ai33-stage-manifest.json').read_text())
for relative,digest in manifest['files'].items():
    p=pathlib.PurePosixPath(relative)
    assert not p.is_absolute() and '..' not in p.parts
    assert hashlib.sha256((target/relative).read_bytes()).hexdigest()==digest
assert not (target/'.env').exists()
os.symlink('/opt/nodia/verification/ai32-r02-20261018/node_modules',target/'node_modules')
packages=['@nestjs/common','@nestjs/core','@nestjs/testing','@nestjs/typeorm','typeorm','pg','@aws-sdk/client-s3']
runtime=pathlib.Path('/opt/nodia/releases/nodia-server-ai15-20261016')
versions={}
for package in packages:
    item={}
    for label,folder in [('staging',target),('activated_runtime',runtime)]:
        p=folder/'node_modules'/package/'package.json'
        item[label]=json.loads(p.read_text())['version'] if p.exists() else None
    item['same_when_present']=item['activated_runtime'] is None or item['staging']==item['activated_runtime']
    assert item['same_when_present']
    versions[package]=item
report={'stage':'AI-33','scope':'compiled_disposable_sql_staging_setup','status':'passed','compiled_files_verified':manifest['compiled_files'],'manifest_sha256':hashlib.sha256((target/'.tmp/ai33-stage-manifest.json').read_bytes()).hexdigest(),'archive_sha256':expected,'test_sha256':manifest['files']['test/nodia-ai-ai33.integration.mjs'],'dependency_versions':versions,'configured_database_used':False,'production_deployed':False,'services_restarted':False,'provider_generations':0,'storage_operations':0}
print(json.dumps(report,indent=2))
