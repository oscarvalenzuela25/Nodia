"""Exact R01 protocol with the narrowly corrected historical-job SQL observer.

Preserves the failed read-only preflights and all original intents/receipts.
Only the pinned Node observer and this operator identity differ from R01.
"""
import argparse,hashlib,importlib.util,json,re,stat,sys
from pathlib import Path
BASE=Path('/opt/nodia/verification/ai40-gemini-chat-recovery-adopt-r01/nodia-ai-ai40-gemini-chat-recovery-operator-r01.py')
BASE_SHA='5b84e576d605f608388ce4c66988f40d1daecf2934bc4b2022e31406999ceeb1'
NATIVE=BASE.parent/'materials/nodia-ai-ai40-gemini-chat-recovery-native-r02.mjs'
NATIVE_SHA='659ebd09c97009a17088db4e5b18cc1a14b463551a5d57e514d66f4f07f28d1a'

def run(args):
    if not isinstance(NATIVE_SHA,str)or re.fullmatch('[a-f0-9]{64}',NATIVE_SHA)is None:raise ValueError('native_successor_not_frozen')
    info=BASE.lstat()
    if BASE.resolve()!=BASE or not stat.S_ISREG(info.st_mode)or info.st_uid!=0 or info.st_nlink!=1 or stat.S_IMODE(info.st_mode)!=0o600:raise ValueError('predecessor_identity_changed')
    if hashlib.sha256(BASE.read_bytes()).hexdigest()!=BASE_SHA:raise ValueError('predecessor_changed')
    sys.dont_write_bytecode=True
    spec=importlib.util.spec_from_file_location('immutable_recovery_r01',BASE)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    module.NATIVE,module.NATIVE_SHA,module.__file__=NATIVE,NATIVE_SHA,str(Path(__file__).resolve())
    result=module.run(args)
    return {**result,'predecessor_operator_sha256':BASE_SHA,'native_observer_successor_sha256':NATIVE_SHA,'historical_failed_preflights_preserved':True}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=('preflight','bind','adopt','reconcile-retire'));parser.add_argument('--operator-sha256',required=True);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    try:
        result=run(args);print(json.dumps(result));sys.exit(0 if result['status']in('ready_no_mutation','bound_pre_stop','adopted_claims_closed','reconciled_retired_claims_resumed')else 1)
    except Exception as error:
        value=str(error);print(json.dumps({'schema':'nodia-ai-ai40-gemini-chat-recovery-operation-v1','phase':args.phase,'status':'precondition_failed','failure_code':value if re.fullmatch('[A-Za-z_]{1,100}',value)else'private_dependency_or_protocol_failure','private_details_emitted':False,'no_automatic_replay':True}));sys.exit(1)
