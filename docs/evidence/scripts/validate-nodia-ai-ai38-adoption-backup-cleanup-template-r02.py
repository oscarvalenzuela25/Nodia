"""Offline regression: frozen backup expiry template and the actual purge guard."""
import ast
import hashlib
from pathlib import Path, PurePosixPath

base = Path(__file__).resolve().parent
backup = base / 'nodia-ai-ai38-adoption-backup-r03.py'
helper = base / 'nodia-ai-ai38-adoption-backup-cleanup-template-r02.py'
old = base / 'nodia-ai-ai38-adoption-backup-cleanup-current.py'
root = PurePosixPath('/opt/nodia/verification/ai38-adoption-backup-r03')
assert hashlib.sha256(backup.read_bytes()).hexdigest() == 'f66e2a7643d4f04d738a0eb752f090dc2fb7828bf8c26973bc07dc63f729af57'
assert hashlib.sha256(helper.read_bytes()).hexdigest() == 'd624755ff65dcbf3ed4131f5a9ea0a34de0720fe11059262ff0eb8ca4170c1ea'
assert hashlib.sha256(old.read_bytes()).hexdigest() == '923add43cfc47e09b38e1c201847ab79b1b209c232feecf3deffb2874706ffc7'
a = ast.parse(backup.read_text(encoding='utf-8'))
call = next(n for n in ast.walk(a) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and isinstance(n.func.value, ast.Name) and n.func.value.id == 'cleanup' and n.func.attr == 'write_text')
actual = eval(compile(ast.Expression(call.args[0]), '<frozen-backup-template>', 'eval'), {'WORK': root})
t = ast.parse(helper.read_text(encoding='utf-8'))
assignment = next(n for n in ast.walk(t) if isinstance(n, ast.Assign) and any(isinstance(x, ast.Name) and x.id == 'expected_cleanup' for x in n.targets))
expected = eval(compile(ast.Expression(assignment.value), '<helper-template>', 'eval'), {'WORK': root})
guard = next(n for n in ast.walk(t) if isinstance(n, ast.Assert) and any(isinstance(q, ast.Call) and isinstance(q.func, ast.Attribute) and q.func.attr == 'read_text' for q in ast.walk(n)))
class FixturePath:
    def __init__(self, text, symlink=False):
        self.text, self.symlink = text, symlink
    def is_symlink(self):
        return self.symlink
    def read_text(self, **kwargs):
        return self.text

def accepted(text, symlink=False):
    try:
        exec(compile(ast.Module(body=[guard], type_ignores=[]), '<actual-helper-guard>', 'exec'), {'cleanup': FixturePath(text, symlink), 'expected_cleanup': expected})
        return True
    except AssertionError:
        return False

assert actual == expected
assert hashlib.sha256(actual.encode()).hexdigest() == 'd6b58603f59382404a4efad495b163ba81691317325edc0076f647fbccf141e4'
assert accepted(actual)
mutations = [actual.replace('from pathlib import Path', 'from pathlib import Path, PurePosixPath'), actual.replace('private-passphrase', 'other-secret'), actual.replace('backup-r03', 'backup-r04'), actual.replace('assert root.is_dir() and not root.is_symlink()', 'assert root.is_dir()'), actual + '\n']
assert all(not accepted(value) for value in mutations)
assert not accepted(actual, True)
print('passed_offline_only: valid template + 5 mutations rejected + symlink rejected')
