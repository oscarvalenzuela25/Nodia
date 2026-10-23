"""Offline proof: retain native body checks while replacing observation admission."""
import argparse
import ast
import hashlib
import importlib.util
import json
from pathlib import Path

TRANSFORM_SHA = '3c3a28c6b280e1bfff9805f6ecfe853429b5b1899d8108b60cfc435b5ed51561'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def function(tree, name):
    matches = [node for node in ast.walk(tree) if isinstance(node, ast.AsyncFunctionDef) and node.name == name]
    assert len(matches) == 1
    return matches[0]


def dump(value):
    return ast.dump(value, include_attributes=False)


def check(diag, fix):
    transform = Path(__file__).with_name('nodia-ai-ai38-profile-reservation-fix-callers.py')
    assert sha(transform) == TRANSFORM_SHA
    spec = importlib.util.spec_from_file_location('canonical_offline_transform', transform)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    proofs = []
    for name, method, transform_function in (('main.py', 'agentic_status', module.patch_main),
                                               ('nodia_ai_chat.py', 'observe', module.patch_chat)):
        before, after = diag / name, fix / name
        old_text, new_text = before.read_text(encoding='utf-8'), after.read_text(encoding='utf-8')
        assert new_text == transform_function(old_text), 'Only the pinned canonical transformation is allowed'
        old_tree, new_tree = ast.parse(old_text), ast.parse(new_text)
        old_function, new_function = function(old_tree, method), function(new_tree, method)
        old_with = [n for n in old_function.body if isinstance(n, ast.AsyncWith)]
        assert len(old_with) == 1
        if name == 'main.py':
            new_with = [n for n in new_function.body if isinstance(n, ast.AsyncWith)]
            assert len(new_with) == 1
            assert dump(ast.Module(body=old_with[0].body, type_ignores=[])) == dump(ast.Module(body=new_with[0].body, type_ignores=[]))
            body_proof = 'agentic_status_AsyncWith_body_identical'
        else:
            original_try = old_with[0].body[0]
            assert isinstance(original_try, ast.Try)
            outer = [n for n in new_function.body if isinstance(n, ast.Try)]
            assert len(outer) == 1 and isinstance(outer[0].body[0], ast.AsyncWith)
            preserved_try = outer[0].body[0].body[0]
            assert isinstance(preserved_try, ast.Try) and dump(original_try) == dump(preserved_try)
            body_proof = 'observe_original_native_Try_identical_inside_new_admission_envelope'
        # The full class/module outside the named target keeps the same AST.
        old_function.body = [ast.Pass()]
        new_function.body = [ast.Pass()]
        assert dump(old_tree) == dump(new_tree)
        proofs.append(dict(file=name, diagnostic_sha256=sha(before), fixed_sha256=sha(after),
                           proof=body_proof, entire_remaining_module_AST_identical=True,
                           CLI_session_model_effort_MCP_and_modality_checks_preserved=True,
                           exact_pinned_transform_match=True))
    return dict(status='passed', scope='offline_canonical_FIX_callers_and_preserved_native_body_AST',
                source_sha256=sha(Path(__file__)), canonical_transform_sha256=TRANSFORM_SHA,
                proofs=proofs, HTTP_requests=0, VM_changes=0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--diag', type=Path, required=True)
    parser.add_argument('--fix', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(check(args.diag, args.fix), indent=2))
