"""Offline descriptor creation after final health; no provider or VM operations."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
health_path='docs/evidence/nodia-ai-ai32-r04-final-health.json'
health=json.loads((root/health_path).read_text(encoding='utf-8'))
files=sorted(str(p.relative_to(root)).replace('\\','/') for p in (root/'docs/evidence').glob('nodia-ai-ai32-r04-*.json') if p.name!='nodia-ai-ai32-r04-validation.json')
native=[]
mcp=[]
controls=[]
for file in files:
    value=json.loads((root/file).read_text(encoding='utf-8'))
    scope=value.get('scope')
    if scope=='real_gemini_web_text_control_no_attachments':
        controls.append(file)
    elif scope in ('individual_real_gemini_synthetic_native_canary','real_agentic_mcp_and_attachment_synthetic_canary'):
        item=value.get('probe',value)
        engine=item.get('engine','agentic')
        observed=health['native_observations'][engine]
        if value.get('status')=='passed' and all(item.get(key)==observed.get(key) for key in ('model_id','effort_id','configuration_generation')) and all(item.get('reference',{}).get(key)==observed.get(key) for key in ('resource_key','session_generation')):
            (native if scope.startswith('individual_') else mcp).append(file)
extras=['.tmp/ai32-r04-native-harness-offline.py','.tmp/ai32-r04-web-text-control-offline.py',
    'docs/evidence/scripts/test_nodia_ai_ai32_r04_mcp_probe.py']
builds=[file for file in files if json.loads((root/file).read_text(encoding='utf-8')).get('scope')=='candidate_staging_build_and_offline_tests']
matching=[file for file in builds if (lambda value: value.get('candidate_image')==health['gemini_image'] and value.get('linux_test_exit_code')==0)(json.loads((root/file).read_text(encoding='utf-8')))]
if len(matching)!=1:raise RuntimeError('select_one_successful_active_build')
for file in files:
    value=json.loads((root/file).read_text(encoding='utf-8'))
    if value.get('linux_test_log'):
        extras.append(value['linux_test_log'])
    for key in ('script_path','log_path'):
        if value.get(key):extras.append(value[key])
if (root/'.tmp/ai32-r04-sdk-analysis.json').is_file():extras.append('.tmp/ai32-r04-sdk-analysis.json')
if (root/'nodia-gemini-microservice/.tmp-ai32-r04-windows-tests.log').is_file():extras.append('nodia-gemini-microservice/.tmp-ai32-r04-windows-tests.log')
inputs={'artifact_paths':sorted(set(files+extras)), 'build_path':matching[0],'baseline_health_path':'docs/evidence/nodia-ai-ai32-r04-baseline-health.json',
    'gemini_activation_path':'docs/evidence/nodia-ai-ai32-r04-gemini-activation.json',
    'final_health_path':health_path,'native_manifest_path':'docs/evidence/nodia-ai-ai32-r04-native-manifest.json',
    'current_native_probe_paths':native,'mcp_probe_paths':mcp,'text_control_paths':controls,
    'python_linux_log':'nodia-server/.tmp/ai32-r04-linux-tests.log',
    'python_windows_log':'nodia-gemini-microservice/.tmp-ai32-r04-windows-tests-final.log',
    'offline_native_log':'.tmp/ai32-r04-native-harness-offline.log',
    'offline_text_log':'.tmp/ai32-r04-web-text-control-offline.log'}
target=root/'.tmp/ai32-r04-final-selection.json'
if target.exists():raise RuntimeError('preserve_existing_descriptor')
target.write_text(json.dumps(inputs,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'descriptor':str(target.relative_to(root)),'native':native,'mcp':mcp,'text':controls}))
