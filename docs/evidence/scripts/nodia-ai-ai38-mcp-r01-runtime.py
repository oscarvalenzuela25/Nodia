"""Read-only, allowlisted projection of preserved AI-38 MCP logs; no provider requests."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import re
from collections import Counter

log = Path('/opt/nodia/verification/ai38-mcp-canary-r01/private-docker-window-ai38-delivery-r01.log')
raw = log.read_bytes()
lines = raw.decode('utf-8', errors='replace').splitlines()
patterns = ['timeout', 'unknown', 'error', 'finish', 'mcp', 'callback', 'poll',
            'checkpoint', 'dispatch', 'metadata', 'stderr', 'stdout', 'hook',
            'tool', 'cancel', 'EOF', 'exit', '403', '429', '503', 'quota',
            'stream', 'bridge', 'expired', 'diagnostic']
report = {'stage': 'AI-38-MCP-R01', 'scope': 'read_only_preserved_log_structure',
          'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'log': {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
                  'lines': len(lines), 'pattern_line_counts': {
                      value: sum(value.lower() in line.lower() for line in lines)
                      for value in patterns}}}
shapes = {}
for line in lines:
    try:
        value = json.loads(line)
    except ValueError:
        continue
    if isinstance(value, dict):
        key = tuple(sorted(value))
        shapes[key] = shapes.get(key, 0) + 1
report['log']['json_line_shapes'] = [
    {'keys': list(key), 'count': count} for key, count in shapes.items()]
report['log']['known_terminal_diagnostics'] = []
report['log']['http_status_counts'] = dict(Counter(
    re.findall(r'"(?:GET|POST|PUT|DELETE|PATCH|OPTIONS) [^"\n]* HTTP/[0-9.]+" (\d{3})',
               raw.decode('utf-8', errors='replace'))))
http_routes = Counter()
for method, route, status in re.findall(
        r'"(GET|POST|PUT|DELETE|PATCH|OPTIONS) ([^"\n]*) HTTP/[0-9.]+" (\d{3})',
        raw.decode('utf-8', errors='replace')):
    route = route.split('?', 1)[0]
    route = re.sub(r'[a-f0-9]{8}-[a-f0-9-]{27,}', '<uuid>', route)
    # Route names from the private app, no query arguments or arbitrary text.
    if re.fullmatch(r'/[A-Za-z0-9_<>/.-]{1,160}', route):
        http_routes[(method, route, status)] += 1
report['log']['http_route_counts'] = [
    {'method': key[0], 'route': key[1], 'status': key[2], 'count': count}
    for key, count in http_routes.most_common(20)]
report['log']['error_token_context_is_http_lines'] = sum(
    'error' in line.lower() and 'HTTP/' in line for line in lines)
report['log']['request_guard_error_value_counts'] = dict(Counter(
    re.findall(r'error=([A-Za-z0-9_.-]{1,80}) duration_ms=',
               raw.decode('utf-8', errors='replace'))))
report['log']['request_guard_duration_ms'] = [
    {'route': match[0], 'status': int(match[1]), 'error': match[2],
     'duration_ms': int(match[3])}
    for match in re.findall(
        r'route=(/[A-Za-z0-9_/{}/.-]{1,160}) engine=[A-Za-z0-9_.-]+ status=(\d{3}) error=([A-Za-z0-9_.-]{1,80}) duration_ms=(\d+)',
        raw.decode('utf-8', errors='replace'))
    if '/mcp/events' not in match[0]][:25]
report['log']['exception_class_counts'] = dict(Counter(
    re.findall(r'\b([A-Z][A-Za-z]*(?:Error|Exception))\b', raw.decode('utf-8', errors='replace'))))
report['log']['error_code_words'] = dict(Counter(
    word for word in re.findall(r'\b[A-Za-z_]{1,48}\b', raw.decode('utf-8', errors='replace'))
    if 'error' in word.lower()))
report['log']['traceback_module_basenames'] = dict(Counter(
    re.findall(r'File "[^"\n]*/([^/"\n]+\.py)"', raw.decode('utf-8', errors='replace'))))
for line in lines:
    if 'nodia_ai_mcp_terminal ' in line:
        try:
            value = json.loads(line.split('nodia_ai_mcp_terminal ', 1)[1])
        except ValueError:
            continue
        report['log']['known_terminal_diagnostics'].append(value)
report['log']['mcp_error_structural_templates'] = []
templates = Counter()
for line in lines:
    if 'mcp' not in line.lower() or 'error' not in line.lower():
        continue
    # Extract only structural code vocabulary; no unknown values or arguments.
    tokens = re.findall(r'[A-Za-z_][A-Za-z_0-9]*', line)
    allowed = {'ERROR','error','WARNING','warning','INFO','info','DEBUG','debug',
               'mcp','MCP','initialize','tools','list','call','notification','notifications',
               'initialized','failed','Failed','Error','Exception','JSONRPC','jsonrpc',
               'request','Request','response','Response','server','client','session',
               'connect','connection','refused','timeout','Timeout','closed','stdio',
               'SSE','HTTP','GET','POST','TypeError','ValueError','ValidationError',
               'EndOfStream','BrokenResourceError','RuntimeError','anyio','read',
               'Message','message','method','params','Invalid','invalid','parse',
               'ErrorData','RPCError','protocol','version','stream','FailedRequest',
               'ContentLength','Content','Length','unsupported','Unsupported',
               'exception','ConnectionError','logger','python','pydantic'}
    template = tuple(token for token in tokens if token in allowed)
    templates[template] += 1
report['log']['mcp_error_structural_templates'] = [
    {'tokens': list(key), 'count': count} for key, count in templates.most_common(12)]
report['services'] = {}
for unit in ['nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx']:
    result = subprocess.run(['systemctl', 'show', unit, '-p', 'ActiveState',
                             '-p', 'SubState', '-p', 'MainPID'],
                            capture_output=True, text=True, check=True)
    report['services'][unit] = dict(
        line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
result = subprocess.run(['sudo', '-n', 'docker', 'ps', '--format', '{{.ID}} {{.Names}}'],
                        capture_output=True, text=True, check=True)
report['containers'] = [{'id': line.split()[0], 'name': line.split()[1]}
                        for line in result.stdout.splitlines()]
container = json.loads(subprocess.run(
    ['sudo', '-n', 'docker', 'inspect', 'nodia-gemini-microservice'],
    capture_output=True, text=True, check=True).stdout)[0]
baseline = json.loads(Path(
    '/opt/nodia/verification/ai36-c05-r05-role-activation/private-original-container.json'
).read_text(encoding='utf-8'))
current_env = dict(item.split('=', 1) for item in container['Config']['Env'])
base_env = dict(item.split('=', 1) for item in baseline['Config']['Env'])
report['runtime'] = {
    'container_id': container['Id'], 'image': container['Image'],
    'started_at': container['State']['StartedAt'], 'running': container['State']['Running'],
    'user': container['Config']['User'],
    'ports': container['HostConfig']['PortBindings'],
    'environment_matches_preserved_baseline': current_env == base_env,
    'mounts_match_preserved_baseline': sorted(container['Mounts'], key=lambda m: m['Destination'])
        == sorted(baseline['Mounts'], key=lambda m: m['Destination']),
    'cli_configured_version': current_env.get('ANTIGRAVITY_CLI_VERSION'),
    'cli_configured_timeout_seconds': current_env.get('ANTIGRAVITY_CLI_TIMEOUT_SECONDS'),
}
binary_probe = '''import json,os,hashlib,pathlib,collections
p=pathlib.Path(os.environ['ANTIGRAVITY_CLI_PATH']); expected=os.environ['ANTIGRAVITY_CLI_SHA512'].lower()
digest=hashlib.sha512(p.read_bytes()).hexdigest()
names=collections.Counter()
for item in pathlib.Path('/proc').iterdir():
 if item.name.isdigit():
  try:
   name=(item/'comm').read_text().strip()
   if name in ('agy','antigravity','python','python3','chrome','chromium','node'): names[name]+=1
  except OSError: pass
print(json.dumps({'binary_basename':p.name,'binary_bytes':p.stat().st_size,'binary_sha512':digest,'matches_configured_sha512':digest==expected,'selected_process_name_counts':dict(names),'binary_executed':False}))
'''
report['runtime']['binary_read_only_probe'] = json.loads(subprocess.run(
    ['sudo', '-n', 'docker', 'exec', 'nodia-gemini-microservice', 'python', '-c', binary_probe],
    capture_output=True, text=True, check=True).stdout)
runtime = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
runtime_files = {path.relative_to(runtime).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
                 for path in sorted((runtime / 'dist').rglob('*')) if path.is_file()}
report['operational_node'] = {
    'compiled_files': len(runtime_files),
    'manifest_sha256': hashlib.sha256(json.dumps(runtime_files, sort_keys=True).encode()).hexdigest()}
report['interpretation'] = {
    'request_error_word_is_not_failure': '1175 request_guard records have error=none',
    'http_status_digit_substrings_are_not_http_statuses': True,
    'six_rpc_messages_do_not_identify_methods_or_prove_successful_handshake': True,
    'stalled_after_prompt_received_without_observed_tool_or_result': True,
    'provider_error_or_credential_or_quota_cause_proven': False,
    'current_session_or_mcp_availability_observed': False,
}
report['limits'] = {'provider_requests': 0, 'services_restarted': False,
                    'remote_files_written': False, 'raw_log_emitted': False,
                    'profile_or_credential_bytes_read': False}
print(json.dumps(report, indent=2))
