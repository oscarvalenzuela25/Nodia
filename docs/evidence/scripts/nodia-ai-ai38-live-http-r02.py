"""Read-only invocation of the frozen observer; emit only enumerated failure reasons."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

source=Path('/opt/nodia/verification/ai38-live-ui-r01/http-observer.py')
expected='1587fd82495866362cc77d88b469ff4a0bc789bbc80d83356eb4223eeff63e9d'
allowed={'log_not_regular','partial_log_line_at_window_boundary','log_truncated_during_read',
         'cursor_must_be_owned_private_0600','invalid_cursor','log_rotated_identity_changed',
         'log_truncated','log_prefix_changed_possible_copytruncate','observer_window_too_large',
         'log_rotated_during_read'}
try:
    assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
    spec=importlib.util.spec_from_file_location('ai38_frozen_http_observer',source)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    args=argparse.Namespace(cursor='/opt/nodia/verification/ai38-live-ui-r01/private/http-cursor.json',
         proposal_id='e73f0a17-62d5-41e9-97dd-20d9b30dcc58',execution_id='57c70fda-56e5-4456-82b2-2d6aa5794079',movement_id='1')
    try:
        result=module.end(args)
        result['wrapper_source_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
        result['earlier_failed_observation_preserved']='nodia-ai-ai38-live-http-final-r01.json'
        print(json.dumps(result,indent=2))
    except (OSError,ValueError,KeyError,TypeError,OverflowError) as error:
        reason=str(error) if isinstance(error,ValueError) and str(error) in allowed else 'unclassified_safe_failure'
        print(json.dumps({'schema':'ai38-live-http-diagnostic-r02','status':'failed_observation',
              'source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'frozen_observer_sha256':expected,'failure_reason':reason,'failure_class':type(error).__name__,
              'raw_log_or_credentials_emitted':False,'provider_requests':0,'source_modified':False},indent=2))
        raise SystemExit(1)
except Exception:
    print(json.dumps({'schema':'ai38-live-http-diagnostic-r02','status':'failed_wrapper','details_withheld':True}))
    raise SystemExit(1)
