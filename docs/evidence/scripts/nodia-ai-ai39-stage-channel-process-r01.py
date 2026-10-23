"""Stage an immutable source snapshot for offline Node peer integration, not deployment."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys

ROOT = Path('/opt/nodia/verification/ai39-channel-process-r01')
SERVER = Path('/opt/nodia/releases/nodia-server-ai38-owner-r01')

def main():
    packet = json.load(sys.stdin)
    assert not ROOT.exists()
    assert set(packet) == {'sources', 'integration_script'}
    ROOT.mkdir(mode=0o700)
    for relative, item in packet['sources'].items():
        assert relative in {
            'common/ai/codex/codex-rpc.ts', 'common/ai/codex/codex-contract.ts',
            'common/ai/codex/codex-process-ownership.ts',
            'common/ai/codex/codex-chat-tool-channel.ts',
            'ai-provider/use-case/codex-chat-tool-channel.use-case.ts',
        }
        assert hashlib.sha256(item['text'].encode()).hexdigest() == item['sha256']
        target = ROOT / 'src' / relative
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        target.write_text(item['text'])
    assert len(packet['sources']) == 5
    integration = packet['integration_script']
    assert hashlib.sha256(integration['text'].encode()).hexdigest() == integration['sha256']
    (ROOT / 'integration.mjs').write_text(integration['text'])
    os.symlink(SERVER / 'node_modules', ROOT / 'node_modules', target_is_directory=True)
    (ROOT / 'package.json').write_text('{"type":"module"}\n')
    (ROOT / 'source-manifest.json').write_text(json.dumps({p: d['sha256'] for p, d in packet['sources'].items()}, indent=2) + '\n')
    compile_script = """import ts from 'typescript'; import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises'; import {join,dirname} from 'node:path';
const root=process.argv[1]; async function walk(base,relative='') {for(const entry of await readdir(join(base,relative),{withFileTypes:true})) {const rel=join(relative,entry.name);if(entry.isDirectory()) await walk(base,rel);else {const source=await readFile(join(base,rel),'utf8');const out=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}); const dest=join(root,'dist',rel.replace(/\\.ts$/,'.js'));await mkdir(dirname(dest),{recursive:true});await writeFile(dest,out.outputText);}}} await walk(join(root,'src'));"""
    env = {'PATH': '/usr/bin:/bin', 'HOME': str(ROOT)}
    subprocess.run(['/usr/local/bin/node', '--input-type=module', '-e', compile_script, str(ROOT)],
                   cwd=ROOT, env=env, capture_output=True, timeout=30, check=True)
    result = subprocess.run(['/usr/bin/unshare', '--net', '--', '/usr/local/bin/node',
                             str(ROOT / 'integration.mjs'), str(ROOT)],
                            cwd=ROOT, env=env, capture_output=True, timeout=60, check=True)
    observation = json.loads(result.stdout)
    observation['source_manifest'] = {p: d['sha256'] for p, d in packet['sources'].items()}
    observation['network_namespace'] = True
    observation['isolated_source_transpile_not_full_build'] = True
    observation['private_stderr_emitted'] = False
    print(json.dumps(observation, indent=2))

if __name__ == '__main__':
    main()
