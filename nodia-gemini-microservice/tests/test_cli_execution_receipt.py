"""Actual runner/receipt with synthetic kernel containment and subprocess IO."""
import test_support
import asyncio
from pathlib import Path
import tempfile
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from uuid import uuid4

from agentic_cli import CliConfig, CliRunner
from cli_execution_receipt import CliExecutionReceipt
from service_errors import ServiceError
from manual_invoice_dispatch import ManualInvoiceDispatches
from profile_admission import ProfileAdmission


class Input:
    def __init__(self, started):
        self.started = started
        self.writes = []
    def write(self, chunk):
        self.writes.append(chunk)
        self.started.set()
    async def drain(self):
        pass
    def close(self):
        pass


class Process:
    def __init__(self):
        self.pid = 999999998
        self.returncode = None
        self.started = asyncio.Event()
        self.exited = asyncio.Event()
        self.stdin = Input(self.started)
        self.stdout = self.stderr = self
    async def read(self, _):
        await self.exited.wait()
        return b""
    async def wait(self):
        await self.exited.wait()
        self.returncode = -9
        return self.returncode


class Containment:
    def __init__(self, process, root):
        self.process = process
        self.root = root
        self.root.mkdir()
        self.attached = False
        self.close_started = asyncio.Event()
        self.allow_close = asyncio.Event()
        self.proved = True
        self.removed = []
    def create(self, key):
        (self.root / key).mkdir()
        return {"name": key}
    def attach(self, proof, pid):
        assert not self.process.stdin.writes
        assert pid == self.process.pid
        self.attached = True
    async def close(self, proof):
        self.close_started.set()
        await self.allow_close.wait()
        self.process.exited.set()
        self.process.returncode = -9
        return self.proved
    def remove(self, proof):
        self.removed.append(proof)
        (self.root / proof["name"]).rmdir()


class CliExecutionReceiptTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.runner = CliRunner(CliConfig(self.root / "synthetic-cli", "", self.root))
        self.process = Process()
        self.containment = Containment(self.process, self.root / "cgroups")
        self.runner._receipt_containment = self.containment
        self.receipt = CliExecutionReceipt(str(uuid4()))
        self.spawn_commands = []
        async def spawn(*command, **options):
            self.spawn_commands.append(command)
            return self.process
        self.enterContext(patch("agentic_cli.sys.platform", "linux"))
        self.enterContext(patch.dict(sys.modules, {"windows_process_job": SimpleNamespace(
            WindowsProcessJob=lambda _: SimpleNamespace(close=lambda: None))}))
        self.enterContext(patch("agentic_cli.asyncio.create_subprocess_exec", side_effect=spawn))

    async def test_second_cancel_waits_for_owned_kernel_empty_and_drained_io_before_receipt(self):
        self.runner.prepare_closure(self.receipt)
        task = asyncio.create_task(self.runner.run(["synthetic"], stdin=b"untrusted document request",
            timeout=2, closure_receipt=self.receipt))
        await asyncio.wait_for(self.process.started.wait(), 2)
        self.assertTrue(self.containment.attached)
        self.assertEqual(self.process.stdin.writes, [b"\x01untrusted document request"])
        self.assertIn("agentic_process_launcher.py", self.spawn_commands[0][1])
        task.cancel()
        await asyncio.wait_for(self.containment.close_started.wait(), 2)
        task.cancel()
        self.assertFalse(self.receipt.local_closed)
        self.containment.allow_close.set()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(self.receipt.local_closed)
        self.assertFalse(self.runner._processes)
        self.assertFalse(self.runner._io_tasks)
        self.assertEqual(len(self.containment.removed), 1)

    async def test_leader_exit_without_containment_proof_never_certifies_or_discards_handles(self):
        self.containment.proved = False
        self.containment.allow_close.set()
        self.runner.prepare_closure(self.receipt)
        task = asyncio.create_task(self.runner.run(["synthetic"], timeout=2, closure_receipt=self.receipt))
        await asyncio.wait_for(self.process.started.wait(), 2)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(self.process.returncode, -9)
        self.assertFalse(self.receipt.local_closed)
        self.assertIn(self.process, self.runner._processes)
        self.assertTrue(self.runner._closed)
        self.assertFalse(self.containment.removed)

    async def test_no_verified_containment_fails_before_starting_native_cli(self):
        self.containment.create = lambda _: (_ for _ in ()).throw(ServiceError("native_proof_missing", "safe", 409))
        with self.assertRaises(ServiceError):
            self.runner.prepare_closure(self.receipt)
        self.assertFalse(self.spawn_commands)
        self.assertFalse(self.receipt.local_closed)

    async def test_another_receipt_with_same_id_cannot_consume_prepared_ownership(self):
        self.runner.prepare_closure(self.receipt)
        foreign = CliExecutionReceipt(self.receipt.operation_id)
        with self.assertRaises(ServiceError) as caught:
            await self.runner.run(["must-not-start"], closure_receipt=foreign)
        self.assertEqual(caught.exception.code, "native_proof_missing")
        self.assertFalse(self.spawn_commands)
        self.runner.discard_prepared_closure(self.receipt)
        self.assertEqual(len(self.containment.removed), 1)

    async def test_pending_io_never_becomes_a_local_closure_certificate(self):
        release_io = asyncio.Event()
        async def uncooperative_read(_):
            while not release_io.is_set():
                try:
                    await release_io.wait()
                except asyncio.CancelledError:
                    pass
            return b""
        self.process.read = uncooperative_read
        self.runner._DRAIN_SECONDS = .01
        self.runner.prepare_closure(self.receipt)
        task = asyncio.create_task(self.runner.run(["synthetic"], timeout=2, closure_receipt=self.receipt))
        try:
            await asyncio.wait_for(self.process.started.wait(), 2)
            task.cancel()
            await self.containment.close_started.wait()
            self.containment.allow_close.set()
            with self.assertRaises(asyncio.CancelledError):
                await task
            self.assertFalse(self.receipt.local_closed)
            self.assertIn(self.process, self.runner._processes)
            self.assertTrue(self.runner._io_tasks[self.process])
            self.assertFalse(self.containment.removed)
        finally:
            release_io.set()
            await asyncio.gather(*self.runner._io_tasks.get(self.process, ()), return_exceptions=True)

    async def test_containment_and_reap_share_the_single_termination_budget(self):
        self.runner._TERMINATE_SECONDS = .02
        self.runner._DRAIN_SECONDS = .02
        self.runner.prepare_closure(self.receipt)
        task = asyncio.create_task(self.runner.run(["synthetic"], timeout=2, closure_receipt=self.receipt))
        await asyncio.wait_for(self.process.started.wait(), 2)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await asyncio.wait_for(task, 1)
        self.assertFalse(self.receipt.local_closed)
        self.assertTrue(self.runner._closed)
        self.assertIn(self.process, self.runner._processes)
        self.assertFalse(self.containment.removed)

    async def test_remove_error_or_swallowed_failure_never_certifies_or_releases_handles(self):
        for swallowed in (False, True):
            with self.subTest(swallowed=swallowed):
                process = Process()
                containment = Containment(process, self.root / ("swallowed" if swallowed else "raised"))
                if swallowed:
                    containment.remove = lambda _: None
                else:
                    def fail_remove(_):
                        raise OSError("synthetic remove error")
                    containment.remove = fail_remove
                runner = CliRunner(self.runner.config)
                runner._receipt_containment = containment
                label = "swallowed" if swallowed else "raised"
                manager = ManualInvoiceDispatches(ProfileAdmission(self.root / (label + "-profile"),
                    self.root / (label + "-admission")), self.root / (label + "-proofs"))
                receipts = []
                async def generation():
                    async with manager.operation("a" * 32) as dispatch:
                        receipts.append(dispatch.receipt)
                        runner.prepare_closure(dispatch.receipt)
                        dispatch.arm()
                        await runner.run(["synthetic"], timeout=2, closure_receipt=dispatch.receipt)
                async def spawn(*_args, **_kwargs):
                    return process
                with patch("agentic_cli.asyncio.create_subprocess_exec", side_effect=spawn):
                    task = asyncio.create_task(generation())
                    await asyncio.wait_for(process.started.wait(), 2)
                    task.cancel()
                    containment.allow_close.set()
                    with self.assertRaises(asyncio.CancelledError):
                        await task
                receipt = receipts[0]
                self.assertFalse(receipt.local_closed)
                self.assertTrue(runner._closed)
                self.assertIn(process, runner._processes)
                self.assertIn(process, runner._receipt_cgroups)
                self.assertIn(process, runner._closure_receipts)
                self.assertTrue((containment.root / receipt.operation_id.replace("-", "")).exists())
                with self.assertRaises(ServiceError) as caught:
                    async with manager.operation("a" * 32):
                        self.fail("Unproved cleanup cannot admit a new analysis")
                self.assertEqual(caught.exception.code, "native_proof_missing")
