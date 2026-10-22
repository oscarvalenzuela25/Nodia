import importlib.util,json,re,subprocess,sys
from pathlib import Path
reader=Path('docs/evidence/scripts/read-nodia-ai-worker-diagnostics.py');spec=importlib.util.spec_from_file_location('reader',reader);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
source=Path('nodia-server/src/nodia-ai-runtime/types/nodia-ai-failure-diagnostic.ts').read_text()
def enum(name):return set(re.findall(r"'([^']+)'",re.search(r'const '+name+r' = new Set\(\[(.*?)\]\)',source,re.S)[1]))
assert m.ERROR_TYPES==enum('errorTypes')|{'Other'};assert m.ERROR_CODES==enum('errorCodes');assert m.SQL_STATES==enum('sqlStates')
tools=Path('nodia-server/src/nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.ts').read_text();assert m.TOOL_PHASES==set(re.findall(r"'([^']+)'",re.search(r'type ToolPhase =(.*?);',tools,re.S)[1]))
base={'phase':'validate_input','error_type':'Error','error_code':'nodia_ai:invalid_tool_input','sql_state':None};cases=[]
def case(raw,want):cases.append((raw.encode() if isinstance(raw,str) else raw,want))
def line(marker,value):return marker+' '+json.dumps(value)
for phase in m.TOOL_PHASES:case(line(m.TOOL_EVENT,{**base,'phase':phase}),1)
for marker,phase in m.STAGE_EVENTS.items():case(line(marker,{**base,'phase':phase,'dispatched':True,'signal_aborted':False,'lost_lease':False}),1)
valid=line(m.TOOL_EVENT,base)
case('[Nest] WARN '+valid,1);case('\x1b[33m[Nest] WARN '+valid+'\x1b[0m',1);case(json.dumps({'MESSAGE':valid}),1);case(json.dumps({'MESSAGE':list(valid.encode())}),1)
case(line(m.TOOL_EVENT,{**base,'error_type':'Other','error_code':None}),1);case(line(m.TOOL_EVENT,{**base,'sql_state':'23505'}),1)
for key,val in [('extra','synthetic_secret'),('id','synthetic_secret'),('phase','synthetic_secret'),('error_type','synthetic_secret'),('error_code','synthetic_secret'),('sql_state','SELECT secret'),('phase',[]),('error_code',True)]:
 d={**base,key:val};case(line(m.TOOL_EVENT,d),0)
for missing in base:case(line(m.TOOL_EVENT,{k:v for k,v in base.items() if k!=missing}),0)
case(line('nodia_ai_unknown_event',base),0);case(valid+' synthetic_secret',0);case('synthetic_secret',0);case(b'\xff'+valid.encode(),0)
case(m.TOOL_EVENT+' {"phase":"native_read","phase":"validate_input","error_type":"Error","error_code":null,"sql_state":null}',0)
case(json.dumps({'MESSAGE':True}),0);case(json.dumps({'MESSAGE':[True]}),0)
case('x'*131073+'\n'+valid,0);case('\n'*1024+valid,0)
for raw,want in cases:
 p=subprocess.run([sys.executable,str(reader)],input=raw,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True);output=p.stdout.decode();assert 'synthetic_secret' not in output and 'SELECT secret' not in output;assert len(output.splitlines())==want,(want,output)
 if output:
  for row in output.splitlines():json.loads(row)
print(json.dumps({'privacy_and_parser_cases_passed':len(cases),'closed_vocab_matches_server_source':True,'application_imports':0,'external_calls':0}))
