"""Stage the exact compiled release for disposable integration with existing test dependencies."""
import hashlib,json,os,shutil,time
from pathlib import Path
runtime=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
target=Path('/opt/nodia/verification/ai32-r06-compiled')
dependencies=Path('/opt/nodia/verification/ai32-r02-20261018')
data=Path('/tmp/nodia-ai32-r05-storage-candidate/dist-manifest.json').read_bytes()
manifest=json.loads(data)
assert hashlib.sha256(data).hexdigest()=='0293d34fe9d320be6b9f696ebdc094e839d5cf5919f25091aa480ee262dfc3b5'
assert len(manifest)==909
assert not target.exists()
packages=['@nestjs/common','@nestjs/core','@nestjs/typeorm','typeorm','reflect-metadata','pg','rxjs','class-validator','@aws-sdk/client-s3']
versions={}
for package in packages:
    left=json.loads((runtime/'node_modules'/package/'package.json').read_text())
    right=json.loads((dependencies/'node_modules'/package/'package.json').read_text())
    assert left['version']==right['version']
    versions[package]=left['version']
assert (dependencies/'node_modules/@nestjs/testing/package.json').is_file()
target.mkdir(mode=0o750)
for relative,expected in manifest.items():
    path=Path(relative)
    assert not path.is_absolute() and '..' not in path.parts and relative.startswith('dist/')
    source=runtime/path
    assert source.is_file() and not source.is_symlink()
    assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
    destination=target/path
    destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,destination)
for name in ['package.json','package-lock.json']:
    source=runtime/name
    if source.is_file():shutil.copy2(source,target/name)
os.symlink(dependencies/'node_modules',target/'node_modules',target_is_directory=True)
assert not (target/'.env').exists()
print(json.dumps({'stage':'AI-32-R06','scope':'compiled_verification_staging','status':'passed',
 'compiled_files_verified':len(manifest),'compiled_manifest_sha256':hashlib.sha256(data).hexdigest(),
 'compiled_source_root':str(runtime),'verification_root':str(target),'test_dependency_versions_compatible':True,
 'checked_package_versions':versions,'operational_env_copied':False,'production_source_modified':False,
 'services_restarted':False,'provider_generations':0,
 'observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())},indent=2))
