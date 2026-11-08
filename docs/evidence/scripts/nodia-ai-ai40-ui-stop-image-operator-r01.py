"""Fresh exact-MIME R08 qualifications; existing R07 fixtures are reused openly.

The pinned protocol includes bounded status-only read retries; each MIME uses
one new intent, no generation replay and no restoration of old acceptance.
"""
import argparse,hashlib,importlib.util,json,re,sys
from pathlib import Path
BASE=Path('/opt/nodia/verification/ai40-recovery-images-r01/nodia-ai-ai40-recovery-image-operator-r02.py')
BASE_SHA='f3a59940bff0ed23872142b9bdabb9a8dc164b4d4412eeea344637acab83b7b1'
WORK=Path('/opt/nodia/verification/ai40-ui-stop-images-r01')
GUARD=Path('/opt/nodia/verification/ai40-ui-stop-mcp-r01/nodia-ai-ai40-ui-stop-mcp-operator-r01.py')
GUARD_SHA='36d83e47acffd3e1a88a44666c7684bb0ba1ac953d7dc11bd1d5edd7bb65552b'
INSPECTOR=WORK/'nodia-ai-ai40-r08-image-native-inspect-r01.mjs'
INSPECTOR_SHA='d03b3483d9d289a245c4ebb6eef6c795c4b068681f3f90504c11e16374d071ce'
MIMES={'png':'image/png','jpeg':'image/jpeg','webp':'image/webp'}
def run(a):
 if not BASE.is_file()or BASE.is_symlink()or hashlib.sha256(BASE.read_bytes()).hexdigest()!=BASE_SHA:raise ValueError('immutable_image_protocol_changed')
 sys.dont_write_bytecode=True
 spec=importlib.util.spec_from_file_location('immutable_R07_image_protocol',BASE);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 for n in('WORK','GUARD','GUARD_SHA','INSPECTOR','INSPECTOR_SHA'):setattr(m,n,globals()[n])
 m.__file__=str(Path(__file__).resolve());result,code=m.run(a)
 return {**result,'schema':'nodia-ai-ai40-ui-stop-r08-image-qualification-v1','inherited_image_protocol_sha256':BASE_SHA,'R07_fixtures_reused':True,'historical_proofs_restored':False},code
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('phase',choices=['preflight','probe']);p.add_argument('--mime',choices=sorted(MIMES),required=True);p.add_argument('--operator-sha256',required=True);p.add_argument('--authorize-one-real-generation',action='store_true');a=p.parse_args()
 try:
  v,code=run(a);print(json.dumps(v));sys.exit(code)
 except Exception as e:
  code=str(e);print(json.dumps({'status':'operator_failed','mime':a.mime,'error_code':code if isinstance(e,ValueError)and re.fullmatch('[a-z][a-z0-9_]{1,95}',code)else'private_dependency_or_protocol_error','generation_may_have_started':(WORK/('intent-'+a.mime+'.json')).exists(),'no_replay':True,'private_details_emitted':False}));sys.exit(1)
