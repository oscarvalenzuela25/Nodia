"""Offline descriptor creation after final health; no provider or VM operations."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
health_path='docs/evidence/nodia-ai-ai32-r03-final-health.json'
health=json.loads((root/health_path).read_text(encoding='utf-8'))
files=sorted(str(p.relative_to(root)).replace('\\','/') for p in (root/'docs/evidence').glob('nodia-ai-ai32-r03-*.json') if p.name!='nodia-ai-ai32-r03-validation.json')
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
extras=['.tmp/ai32-r03-native-harness-offline.py','.tmp/ai32-r03-web-text-control-offline.py',
    'docs/evidence/scripts/test_nodia_ai_ai32_r03_mcp_probe.py']
inputs={'artifact_paths':files+extras,'baseline_health_path':'docs/evidence/nodia-ai-ai32-r03-baseline-health.json',
    'gemini_activation_path':'docs/evidence/nodia-ai-ai32-r03-gemini-activation.json',
    'final_health_path':health_path,'native_manifest_path':'docs/evidence/nodia-ai-ai32-r03-native-manifest.json',
    'current_native_probe_paths':native,'mcp_probe_paths':mcp,'text_control_paths':controls,
    'python_linux_log':'nodia-server/.tmp/ai32-r03-linux-tests.log',
    'python_windows_log':'nodia-gemini-microservice/.tmp-ai32-r03-windows-tests.log',
    'offline_native_log':'.tmp/ai32-r03-native-harness-offline.log',
    'offline_text_log':'.tmp/ai32-r03-web-text-control-offline.log'}
target=root/'.tmp/ai32-r03-final-selection.json'
if target.exists():raise RuntimeError('preserve_existing_descriptor')
target.write_text(json.dumps(inputs,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'descriptor':str(target.relative_to(root)),'native':native,'mcp':mcp,'text':controls}))
