"""Keep the existing public guards; retry only their read-only journal status."""
import hashlib
import importlib.util
from pathlib import Path

STATUS_SOURCE = Path('/opt/nodia/verification/ai40-availability-operator-r01/nodia-ai-ai40-availability-adopt-r01.py')
STATUS_SHA = 'd34a2d92fdadca4901282a4cc3ccf75d5948901e4a5c8a14e1915df1cf1f9b87'


def pinned_module(path, pin, name):
    if not path.is_file() or path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != pin:
        raise ValueError('status_read_source_pin_mismatch')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def observe(helper, base, status_factory, events, services):
    """Same public_preflight sequence and predicates, with a local status wrapper."""
    base.NEW = helper.ACTIVE
    operator, _ = base.load_helper()
    operator.RELEASE = helper.ACTIVE
    original = operator.journal
    operator.journal = status_factory(original, events)
    try:
        consumers = operator.active_new_processes()
        codex = base.codex_barrier(operator, helper.PROFILE, frozenset(c['pid'] for c in consumers.values()))
        journal = base.journal_open(operator)
        sql = helper.chat_projection(services['nodia-api']['pid'])
        helper.require(all(sql[key] == 0 for key in ('pending_jobs', 'open_attempts', 'retained_slots')), 'operational_sql_not_quiet')
        return {'consumers': consumers, 'codex': codex, 'journal': journal, 'SQL': sql}
    finally:
        operator.journal = original


def public_preflight(helper, services, events):
    base = pinned_module(helper.BASE, helper.BASE_SHA, 'immutable_status_read_base')
    status = pinned_module(STATUS_SOURCE, STATUS_SHA, 'immutable_status_read_policy')
    return observe(helper, base, status.StatusReadJournal, events, services)
