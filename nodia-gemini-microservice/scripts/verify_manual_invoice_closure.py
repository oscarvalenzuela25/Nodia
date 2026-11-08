"""Account-free Linux integration; requires an isolated attested test container.

Uses Python fixture processes only, never the provider CLI or a real profile.
The operator owns the disposable container and its final cleanup.
"""
import asyncio
import json
import os
from pathlib import Path
import sys
import tempfile
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agentic_cli import CliConfig, CliRunner
from login_cgroups import process_birth
from manual_invoice_dispatch import ManualInvoiceDispatches
from profile_admission import ProfileAdmission
from service_errors import ServiceError


async def verify() -> dict:
    if os.environ.get("NODIA_ISOLATED_NATIVE_TEST") != "1" or sys.platform != "linux":
        raise RuntimeError("Explicit isolated Linux test required")
    with tempfile.TemporaryDirectory(prefix="manual-ocr-closure-fixture-") as directory:
        root = Path(directory)
        ready, trigger, escaped = root / "ready", root / "trigger", root / "escaped"
        child_code = ("import os,time;from pathlib import Path;os.setsid();"
            f"Path({str(ready)!r}).write_text(str(os.getpid()));"
            f"p=Path({str(trigger)!r});\nwhile not p.exists():time.sleep(.01)\n"
            f"Path({str(escaped)!r}).write_text('unclosed')")
        parent_code = ("import subprocess,sys,time;"
            f"subprocess.Popen([sys.executable,'-u','-c',{child_code!r}]);time.sleep(30)")
        runner = CliRunner(CliConfig(Path(sys.executable), "", root))
        gate = ProfileAdmission(root / "synthetic-account", root / "admission")
        manager = ManualInvoiceDispatches(gate, root / "proofs")
        identities = []

        async def cancelled_generation():
            async with manager.operation("a" * 32) as dispatch:
                identities.append(dispatch.attempt_id)
                runner.prepare_closure(dispatch.receipt)  # Before dispatch fence.
                dispatch.arm()
                try:
                    await runner.run(["-u", "-c", parent_code], timeout=10,
                        closure_receipt=dispatch.receipt)
                finally:
                    runner.discard_prepared_closure(dispatch.receipt)

        task = asyncio.create_task(cancelled_generation())
        try:
            until = time.monotonic() + 5
            while not ready.exists():
                if task.done():
                    await task
                if time.monotonic() >= until:
                    raise RuntimeError("Fixture descendant startup deadline")
                await asyncio.sleep(.01)
            child_pid = int(ready.read_text())
            assert process_birth(child_pid) is not None
            task.cancel()
            try:
                await asyncio.wait_for(task, 8)
            except asyncio.CancelledError:
                pass
            else:
                raise RuntimeError("Cancellation did not propagate")
            assert process_birth(child_pid) is None
            assert not runner._processes and not runner._spawns and not runner._io_tasks
            assert not gate._held and not gate._quarantined
            assert not list((root / "admission").glob("*.unknown"))
            assert not list((root / "proofs").glob("*.json"))
            assert not (runner._receipt_containment.root / identities[0].replace("-", "")).exists()
            trigger.touch()
            await asyncio.sleep(.1)
            assert not escaped.exists()
            async with manager.operation("a" * 32) as dispatch:
                identities.append(dispatch.attempt_id)
                runner.prepare_closure(dispatch.receipt)
                dispatch.arm()
                try:
                    output, code = await runner.run(["-c", "print('synthetic-next-intent')"],
                        timeout=5, closure_receipt=dispatch.receipt)
                finally:
                    runner.discard_prepared_closure(dispatch.receipt)
                assert output.strip() == "synthetic-next-intent" and code == 0
                assert dispatch.receipt.local_closed
            assert identities[0] != identities[1]
            return {"success": True, "cancel_propagated": True,
                "setsid_descendant_closed": True, "owned_io_drained": True,
                "own_cgroup_removed": True, "profile_reusable_for_new_intent": True,
                "terminal_receipts_acknowledged": True, "provider_requests": 0,
                "real_profile_read": False, "remote_outcome_claimed": False}
        finally:
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            await runner.close()


if __name__ == "__main__":
    try:
        print(json.dumps(asyncio.run(verify()), sort_keys=True))
    except Exception as error:
        print(json.dumps({"success": False, "error_type": type(error).__name__,
            **({"code": error.code} if isinstance(error, ServiceError) else {})}, sort_keys=True))
        raise SystemExit(1)
