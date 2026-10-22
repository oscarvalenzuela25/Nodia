"""Read seven public source files for exact review; never enumerate account data."""
import json
import subprocess

names = ('agentic_cli.py', 'agentic_service.py', 'main.py', 'native_mcp_sessions.py',
         'native_mcp_stdio.py', 'nodia_ai_chat.py', 'request_guard.py')
projection = "import json,pathlib,sys;print(json.dumps({n:pathlib.Path('/app',n).read_bytes().hex() for n in sys.argv[1:]}))"
result = subprocess.run(['docker', 'exec', 'nodia-gemini-microservice', 'python',
                         '-B', '-c', projection, *names], capture_output=True,
                        check=True, timeout=45)
print(result.stdout.decode('utf-8'))
