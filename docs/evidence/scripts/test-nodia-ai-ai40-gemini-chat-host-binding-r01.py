"""Offline unit checks; synthetic witness documents, no Docker/profile/SDK I/O."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch


def load(name):
    path = Path(__file__).with_name(name + '.py')
    module = importlib.util.module_from_spec(importlib.util.spec_from_loader(name, loader=None))
    # fcntl is used by CLI only. Windows offline tests do not invoke host locking.
    with patch.dict(sys.modules, {'fcntl': SimpleNamespace()}):
        exec(compile(path.read_bytes(), str(path), 'exec'), module.__dict__)
    return module


p = load('nodia-ai-ai40-gemini-chat-host-binding-r01')
h = load('attach-nodia-gemini-chat-cgroup-r01')


def fixture():
    """Explicit synthetic representation of the approved receipt shape."""
    generation = {'container_id': p.CONTAINER, 'started_at': '2026-10-24T16:27:29Z',
        'boot': '4030022f-2641-40bc-b62d-79928876b867', 'device': 30, 'parent_inode': 504022,
        'host_device': 30, 'host_inode': 504022, 'cgroup_path': '/sys/fs/cgroup/fixture-only'}
    proof = {'schema_version': 1, 'engine': 'agentic', 'attempt_id': p.ATTEMPT,
        'resource_key': p.RESOURCE, 'session_generation': p.SESSION, 'operation_ref': p.ATTEMPT,
        'state': 'dispatch_armed', 'process_closed': False, 'terminal_proof_id': None,
        'observed_at': '2026-10-24T20:03:59.233150+00:00'}
    public = {'version': 1, 'kind': 'legacy_chat_pre_stop', 'binding_id': '1678700c-efdb-49aa-8dbe-9145b5309a03',
        'engine': 'agentic', 'attempt_id': p.ATTEMPT, 'resource_key': p.RESOURCE,
        'session_generation': p.SESSION, 'operation_ref': p.ATTEMPT, 'record_sha256': p.RECORD_SHA,
        'record_bytes': 441, 'record_observed_at': proof['observed_at'], 'bound_at': '2026-10-24T20:40:00+00:00',
        'generation': {k: generation[k] for k in ('container_id', 'started_at', 'boot', 'device', 'parent_inode')},
        'lineage_sha256': 'a' * 64}
    documents = {
        'qualified-final-state-r01.json': {'Gemini_container_public_descriptor': p.CONTAINER + p.IMAGE + generation['started_at'],
            'proofs': {'fixture-only': {'verified_at': '2026-10-24T19:00:00Z'}}},
        'Gemini-host-containment-readonly-r01.json': {'host_state': {'generations': [generation], 'sha256': p.STATE_SHA, 'mtime_utc': '2026-10-24T16:28:00Z'}, 'container': {'image': p.IMAGE}},
        'Gemini-exact-unknown-readonly-r01.json': {'selection': {'jobs': [{'recovery_descriptor': {'runtime': {k: proof[k] for k in ('engine', 'attempt_id', 'resource_key', 'session_generation', 'operation_ref')}}}],
            'current_authority_verified': True, 'run': {'state': 'unknown', 'provider_dispatches_used': 1}}},
        'Gemini-legacy-owner-witness-readonly-r01.json': {'record': {'sha256': p.RECORD_SHA}, 'session_volume': {'single_running_RW_container': True, 'source_sha256': p.VOLUME_SHA}},
    }
    return generation, proof, public, documents


class BindingTests(unittest.TestCase):
    def test_valid_binding_does_not_itself_claim_closure(self):
        _, _, public, _ = fixture()
        self.assertIs(p.validate_public(public), public)
        self.assertNotIn('process_closed', public)
        self.assertNotIn('outcome', public)

    def test_closed_schema_scope_and_numbers(self):
        _, _, public, _ = fixture()
        invalid = [dict(public, unknown=True), dict(public, engine='web'), dict(public, record_bytes=True),
            dict(public, operation_ref='5d6ec119-5667-47c7-a243-0cbac5163625'), dict(public, resource_key='foreign'),
            dict(public, session_generation='bad'), dict(public, bound_at='2026-10-24T19:00:00Z')]
        bad = deepcopy(public)
        bad['generation']['parent_inode'] = True
        invalid.append(bad)
        for value in invalid:
            with self.subTest(value=value), self.assertRaises((RuntimeError, ValueError, TypeError)):
                p.validate_public(value)

    def check_lineage(self, *, mutate=None, record_mutate=None, generation_mutate=None, pin_mutate=False):
        generation, proof, _, documents = fixture()
        if mutate:
            mutate(documents)
        if record_mutate:
            record_mutate(proof)
        raw = json.dumps(proof, separators=(',', ':')).encode()
        # Production validates immutable 441 bytes; pad synthetic JSON only.
        raw += b' ' * (441 - len(raw))
        self.assertEqual(len(raw), 441)
        docs = {k: json.dumps(v).encode() for k, v in documents.items()}
        pins = {k: p.sha(v) for k, v in docs.items()}
        if pin_mutate:
            pins[next(iter(pins))] = '0' * 64
        if generation_mutate:
            generation_mutate(generation)
        with patch.object(p, 'RECEIPTS', pins), patch.object(p, 'RECORD_SHA', p.sha(raw)), patch.object(p, 'STATE_SHA', p.sha(b'synthetic-state')):
            # Keep independent document self-pins aligned to test the rule, not hashes.
            documents['Gemini-host-containment-readonly-r01.json']['host_state']['sha256'] = p.STATE_SHA
            documents['Gemini-legacy-owner-witness-readonly-r01.json']['record']['sha256'] = p.RECORD_SHA
            docs = {k: json.dumps(v).encode() for k, v in documents.items()}
            pins.update({k: p.sha(v) for k, v in docs.items()})
            if pin_mutate:
                pins[next(iter(pins))] = '0' * 64
            return p.validate_lineage(docs, b'synthetic-state', raw, generation)

    def test_complete_prior_witness_chain(self):
        self.assertEqual(self.check_lineage()['attempt_id'], p.ATTEMPT)

    def test_foreign_sql_scope_rejected(self):
        def mutate(docs):
            docs['Gemini-exact-unknown-readonly-r01.json']['selection']['jobs'][0]['recovery_descriptor']['runtime']['session_generation'] = 'f' * 32
        with self.assertRaisesRegex(RuntimeError, 'sql_witness_scope_mismatch'):
            self.check_lineage(mutate=mutate)

    def test_missing_prior_admission_authority_rejected(self):
        def mutate(docs):
            docs['Gemini-exact-unknown-readonly-r01.json']['selection']['current_authority_verified'] = False
        with self.assertRaisesRegex(RuntimeError, 'sql_witness_scope_mismatch'):
            self.check_lineage(mutate=mutate)

    def test_generation_created_after_dispatch_rejected(self):
        def mutate(docs):
            docs['Gemini-host-containment-readonly-r01.json']['host_state']['mtime_utc'] = '2026-10-24T21:00:00Z'
        with self.assertRaisesRegex(RuntimeError, 'generation_not_pre_dispatch'):
            self.check_lineage(mutate=mutate)

    def test_missing_original_container_snapshot_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'pre_dispatch_container_missing'):
            self.check_lineage(mutate=lambda d: d['qualified-final-state-r01.json'].update(Gemini_container_public_descriptor='foreign'))

    def test_shared_session_writer_witness_rejected(self):
        def mutate(docs):
            docs['Gemini-legacy-owner-witness-readonly-r01.json']['session_volume']['single_running_RW_container'] = False
        with self.assertRaisesRegex(RuntimeError, 'owner_witness_invalid'):
            self.check_lineage(mutate=mutate)

    def test_changed_witness_pin_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'witness_pin_mismatch'):
            self.check_lineage(pin_mutate=True)


class ClosureTests(unittest.TestCase):
    def setUp(self):
        self.old = fixture()[0]
        self.current = dict(self.old, parent_inode=604022, host_inode=604022, started_at='2026-10-24T21:00:00Z')
        self.container = {'id': p.CONTAINER}

    def test_same_live_generation_cannot_be_closed(self):
        self.assertFalse(h.generation_closed(self.old, self.old, self.container))

    def test_namespace_or_restart_alone_without_kernel_identity_change_rejects(self):
        current = dict(self.current, host_inode=self.old['host_inode'])
        observed = {'id': p.CONTAINER, 'state': {'Running': True, 'StartedAt': current['started_at']}}
        with patch.object(h, 'inspect_container', return_value=observed):
            self.assertFalse(h.generation_closed(self.old, current, self.container))

    def test_foreign_old_container_still_running_rejects(self):
        observed = {'id': 'b' * 64, 'state': {'Running': True, 'StartedAt': self.old['started_at']}}
        with patch.object(h, 'inspect_container', return_value=observed):
            self.assertFalse(h.generation_closed(self.old, self.current, self.container))

    def test_stopped_container_with_populated_exact_cgroup_rejects(self):
        class Cgroup:
            def stat(self):
                return SimpleNamespace(st_dev=30, st_ino=504022)
            def __truediv__(self, _):
                return SimpleNamespace(read_text=lambda: 'populated 1\nfrozen 0\n')
        with patch.object(h, 'inspect_container', return_value={'state': {'Running': False, 'Pid': 0}}), patch.object(h, 'safe_cgroup_path', return_value=Cgroup()):
            self.assertFalse(h.generation_closed(self.old, self.current, self.container))

    def test_kernel_empty_exact_old_cgroup_allows_physical_closure(self):
        class Cgroup:
            def stat(self):
                return SimpleNamespace(st_dev=30, st_ino=504022)
            def __truediv__(self, _):
                return SimpleNamespace(read_text=lambda: 'populated 0\nfrozen 0\n')
        with patch.object(h, 'inspect_container', return_value={'state': {'Running': False, 'Pid': 0}}), patch.object(h, 'safe_cgroup_path', return_value=Cgroup()):
            self.assertTrue(h.generation_closed(self.old, self.current, self.container))

    def test_chat_binding_retains_old_root_without_login_reference(self):
        with patch.object(h, 'safe_cgroup_path'):
            refs = h.bound_references([self.old, self.current], [{'generation': self.old}])
        self.assertEqual(refs, {h.tuple_key(self.old)})
        retained = [g for g in [self.old, self.current] if h.tuple_key(g) in refs and h.tuple_key(g) != h.tuple_key(self.current)]
        self.assertEqual(retained, [self.old])

    def test_missing_old_generation_is_not_reconstructed_from_binding(self):
        with self.assertRaisesRegex(RuntimeError, 'chat_binding_generation_not_retained'):
            h.bound_references([self.current], [{'generation': self.old}])


if __name__ == '__main__':
    unittest.main()
