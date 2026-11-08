"""Fresh R08 MCP qualification after the exact UI Stop reconciliation.

No receipt/proof restoration, shared work reuse, inference retry or account
configuration changes. The historical R07 protocol remains authoritative.
"""
import argparse,hashlib,importlib.util,json,re,sys
from pathlib import Path
BASE=Path('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py')
BASE_SHA='753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58'
WORK=Path('/opt/nodia/verification/ai40-ui-stop-mcp-r01')
RELEASE=Path('/opt/nodia/releases/nodia-server-ai40-r08')
RELEASE_SHA='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'
sys.dont_write_bytecode=True
if not BASE.is_file()or BASE.is_symlink()or hashlib.sha256(BASE.read_bytes()).hexdigest()!=BASE_SHA:raise ValueError('immutable_MCP_protocol_changed')
spec=importlib.util.spec_from_file_location('immutable_r07_MCP_protocol',BASE);original=importlib.util.module_from_spec(spec);spec.loader.exec_module(original)
original.RELEASE,original.RELEASE_SHA=RELEASE,RELEASE_SHA
for name in('HELPER','HELPER_SHA','LEGACY_MANIFEST_SHA','EXPECTED_RUNTIME_FINGERPRINT','HARNESSES','private_file'):globals()[name]=getattr(original,name)
# Expose only the existing image protocol's required pure/IO guard interface.
def private_work():
 original.WORK=WORK;return original.private_work()
def write_once(path,value):
 original.WORK=WORK;return original.write_once(path,value)
def validate_release():return original.validate_release()
def run(a):
 original.WORK=WORK;original.__file__=str(Path(__file__).resolve())
 report,code=original.run(a)
 return {**report,'schema':'nodia-ai-ai40-ui-stop-r08-MCP-qualification-v1','inherited_MCP_protocol_sha256':BASE_SHA,'fresh_work':True,'historical_proofs_restored':False},code
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('phase',choices=['preflight','probe']);p.add_argument('--operator-sha256',required=True);p.add_argument('--authorize-one-real-generation',action='store_true');a=p.parse_args()
 try:
  v,code=run(a);print(json.dumps(v));sys.exit(code)
 except Exception as e:
  code=str(e);print(json.dumps({'status':'operator_failed','error_code':code if isinstance(e,ValueError)and re.fullmatch('[a-z][a-z0-9_]{1,95}',code)else'private_dependency_or_protocol_error','generation_may_have_started':(WORK/'intent-mcp.json').exists(),'no_replay':True,'private_details_emitted':False}));sys.exit(1)
