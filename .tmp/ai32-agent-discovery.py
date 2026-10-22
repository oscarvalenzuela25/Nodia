"""Non-generative custom-agent discovery with private, temporary CLI home."""
import importlib.util
import json
import subprocess

spec = importlib.util.spec_from_file_location('ai32_probe', '/tmp/nodia-ai-ai32-native-probe.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
selection = module.configuration()['selections']['agentic']
code = r'''
import json,os,subprocess,tempfile
from pathlib import Path
from agentic_cli import cli_environment,prepare_cli_home
import sys
selection=json.loads(sys.argv[1])
profile=Path(os.environ['ANTIGRAVITY_CLI_HOME'])
with tempfile.TemporaryDirectory(prefix='nodia-ai32-agent-discovery-',dir=profile) as directory:
    root=Path(directory);home=root/'profile';workspace=root/'workspace';workspace.mkdir()
    prepare_cli_home(home)
    for name in ('antigravity-oauth-token','installation_id'):
        source=profile/'.gemini/antigravity-cli'/name
        if source.is_file():(home/'.gemini/antigravity-cli'/name).symlink_to(source)
    agents=workspace/'.agents/agents/nodia-attachment-reader';agents.mkdir(parents=True)
    (agents/'agent.md').write_text('---\nname: nodia-attachment-reader\ndescription: Read only the exact native attachments supplied by Nodia.\nmainAgent: true\nsubagent: false\ntools:\n  - view_file\n  - finish\n---\nRead the exact supplied files using view_file and return the required structured answer with finish. No other tools are permitted.\n',encoding='utf-8')
    options=['--model',selection['model_id']]
    if selection['effort_id'] is not None:options+=['--effort',selection['effort_id']]
    result=subprocess.run(['/opt/nodia/antigravity-cli/1.3.1/agy','-p','/model','--agent','nodia-attachment-reader','--output-format','stream-json','--print-timeout','10s',*options],cwd=workspace,env=cli_environment(home),capture_output=True,text=True,timeout=15)
    records=[]
    for line in result.stdout.splitlines():
        try:value=json.loads(line)
        except ValueError:continue
        if isinstance(value,dict):records.append(value)
    init=[value.get('init') for value in records if value.get('event')=='init']
    command=[value.get('command') for value in records if isinstance(value.get('command'),dict)]
    output={'exit_code':result.returncode,'record_count':len(records),'init_count':len(init),'command_count':len(command),'generation_requested':False}
    if init:
        value=init[-1];agent=value.get('agent')
        output.update(agent_type=type(agent).__name__,agent_name_matches=agent=='nodia-attachment-reader' if isinstance(agent,str) else agent.get('name')=='nodia-attachment-reader' if isinstance(agent,dict) else False,model_matches=value.get('model')==selection['model_id'])
        tools=value.get('tools');output['tools_type']=type(tools).__name__
        if isinstance(tools,list):output['recognized_tools']=sorted(name for name in ('view_file','finish') if name in tools);output['other_tools_count']=sum(name not in ('view_file','finish') for name in tools)
    if command:output['model_command_matches']=command[-1].get('name')=='model' and command[-1].get('data',{}).get('id')==selection['model_id']
    output['cli_error_present']=bool(result.stderr.strip())
    print(json.dumps(output))
'''
result = subprocess.run(['sudo','-n','docker','exec','-i','--user','10001:10001','nodia-gemini-microservice','python','-',json.dumps(selection)],input=code,text=True,capture_output=True,timeout=25)
if result.returncode:
    print(json.dumps({'discovery_failed':True,'exit_code':result.returncode,'generation_requested':False}))
else:
    print(result.stdout.strip())
