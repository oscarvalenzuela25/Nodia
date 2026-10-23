"""Apply the same bounded observation call-site change to local or frozen DIAG sources.

All other source bytes/text are retained, including the target's own CLI checks.
Does not import application modules, read credentials or execute an adapter.
"""
from pathlib import Path
import argparse


def patch_main(raw: str) -> str:
    before = 'async with application.state.profiles.operation("agentic", purpose="health_status"):'
    after = 'async with application.state.profiles.observation("agentic", purpose="health_status", timeout_seconds=12):'
    assert raw.count(before) == 1
    return raw.replace(before, after, 1)


def patch_chat(raw: str) -> str:
    before = '        async with self.profiles.operation(engine, purpose="eligibility"):\n'
    assert raw.count(before) == 1
    begin = raw.index(before)
    end = raw.index('\n        return observation\n', begin) + 1
    block = raw[begin:end]
    remaining = block[len(before):]
    # Preserve all existing session, model/effort, MCP and modality checks.
    indented = ''.join('    '+line if line.strip() else line for line in remaining.splitlines(keepends=True))
    replacement = ('        admission = (self.profiles.observation(engine, purpose="eligibility", timeout_seconds=18)\n'
                   '                     if engine == "agentic" else self.profiles.operation(engine, purpose="eligibility"))\n'
                   '        try:\n'
                   '            async with admission:\n'+indented+
                   '        except ServiceError as error:\n'
                   '            # The bounded preflight is non-generative. Preserve a typed\n'
                   '            # negative observation rather than a transport-unknown result.\n'
                   '            # Actual execution/login/quarantine conflicts remain HTTP409.\n'
                   '            if engine != "agentic" or error.code != "agentic_timeout":\n'
                   '                raise\n'
                   '            observation["reason"] = "agentic_timeout"\n')
    return raw[:begin]+replacement+raw[end:]


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('directory')
    args=parser.parse_args()
    root=Path(args.directory)
    for name, transform in (('main.py',patch_main),('nodia_ai_chat.py',patch_chat)):
        path=root/name
        path.write_text(transform(path.read_text(encoding='utf-8')),encoding='utf-8')
    print('Updated only Agentic observation admission at two call sites')
