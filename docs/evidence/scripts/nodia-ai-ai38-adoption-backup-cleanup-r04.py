"""Owned R04 backup/key purge, reusing the exact reviewed cleanup algorithm."""
import ast
import hashlib
from pathlib import Path

SOURCE_SHA256 = 'd624755ff65dcbf3ed4131f5a9ea0a34de0720fe11059262ff0eb8ca4170c1ea'


def load_source(path):
    payload = Path(path).read_bytes()
    assert hashlib.sha256(payload).hexdigest() == SOURCE_SHA256
    tree = ast.parse(payload)
    nodes = [node for node in tree.body if isinstance(node, (ast.Import, ast.ImportFrom, ast.Assign, ast.FunctionDef, ast.Expr))]
    assert len(nodes) == len(tree.body) - 1 and isinstance(tree.body[-1], ast.If)
    namespace = {'__file__': __file__, '__name__': 'pinned_cleanup_r02'}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), 'pinned_cleanup_r02', 'exec'), namespace)
    namespace['DRILL'] = Path('/opt/nodia/verification/ai38-adoption-r04')
    return namespace


if __name__ == '__main__':
    raise SystemExit(load_source('/tmp/nodia-ai-ai38-adoption-backup-cleanup-template-r02.py')['main']())
