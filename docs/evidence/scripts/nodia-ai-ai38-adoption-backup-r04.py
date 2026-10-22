"""Fresh backup window R04; execute the exact reviewed R03 algorithm with new ownership."""
import ast
import hashlib
from pathlib import Path

SOURCE_SHA256 = 'f66e2a7643d4f04d738a0eb752f090dc2fb7828bf8c26973bc07dc63f729af57'


def load_source(path):
    payload = Path(path).read_bytes()
    assert hashlib.sha256(payload).hexdigest() == SOURCE_SHA256
    tree = ast.parse(payload)
    allowed = (ast.Import, ast.ImportFrom, ast.Assign, ast.FunctionDef, ast.Expr)
    nodes = [node for node in tree.body if isinstance(node, allowed)]
    assert len(nodes) == len(tree.body) - 1 and isinstance(tree.body[-1], ast.If)
    namespace = {'__file__': __file__, '__name__': 'pinned_backup_r03'}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), 'pinned_backup_r03', 'exec'), namespace)
    namespace['WORK'] = Path('/opt/nodia/verification/ai38-adoption-backup-r04')
    namespace['UNIT'] = 'nodia-ai38-backup-expiry-r04'
    return namespace


if __name__ == '__main__':
    raise SystemExit(load_source('/tmp/nodia-ai-ai38-adoption-backup-r03.py')['main']())
