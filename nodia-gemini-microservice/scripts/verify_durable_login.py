"""Offline Linux integration: actual Chromium, subprocesses, PTY, UDS and cgroups.

Requires an ephemeral --network=none container with the host attachment helper.
No account/profile/credential from the running service is mounted or accessed.
"""
import asyncio
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import signal
import sys
import tempfile
import time
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from durable_login import DurableLoginRequests
from profile_admission import ProfileAdmission
from service_errors import ServiceError

ACTOR = "9223372036854775807"


def runtime(directory):
    profiles = ProfileAdmission(directory / "web", directory / "agentic", directory / "admission")
    manager = DurableLoginRequests(directory / "requests", profiles)
    manager.supervisor_script = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "login_supervisor_fixture.py"
    return manager


async def wait_job(manager, request, states):
    async with asyncio.timeout(10):
        while True:
            result = await manager.observe("agentic", request, ACTOR, "2")
            if result["state"] in states:
                return result
            await asyncio.sleep(0.05)


async def read(manager, key):
    async with manager.store.alocked():
        return manager.store.read(key)


async def cleanup(manager, key):
    record = await read(manager, key)
    if record and record["containment"] is not None:
        await manager.containment.close(record["containment"])
        manager.containment.remove(record["containment"])
    await manager.close()


async def agentic_case(directory, crash):
    manager = runtime(directory)
    request = str(uuid4())
    key = request.replace("-", "")
    deadline = datetime.fromtimestamp(time.time() + 60, timezone.utc).isoformat()
    api_process = None
    try:
        # Kill the actual HTTP-owner Python process after native dispatch. Its
        # native supervisor and cgroup survive; the start response was lost.
        fixture = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "login_api_fixture.py"
        api_process = await asyncio.create_subprocess_exec(sys.executable, str(fixture), str(directory), request, deadline,
                           stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        try:
            ready = await asyncio.wait_for(api_process.stdout.readline(), 12)
            assert ready == b'{"ready": true}\n', (ready, await api_process.stderr.read())
        finally:
            if api_process.returncode is None:
                api_process.kill()
            await api_process.wait()
        recovered = runtime(directory)
        job = await wait_job(recovered, request, {"waiting_code", "failed", "cancelled"})
        assert job["state"] == "waiting_code", job
        assert job["authorization_url"].startswith("https://accounts.google.com/")
        record = await read(recovered, key)
        assert not any(word in json.dumps(record) for word in ("authorization_url", "code_challenge", "fixture-secret-code"))
        try:
            await recovered.cancel("agentic", request, "1", "2")
            raise AssertionError("foreign actor accepted")
        except ServiceError as error:
            assert error.status == 404
        replay = await recovered.start("agentic", request, ACTOR, "2", deadline)
        assert replay["id"] == key
        assert (await read(recovered, key))["supervisor"] == record["supervisor"]
        if crash:
            os.kill(record["supervisor"]["pid"], signal.SIGKILL)
            await asyncio.sleep(0.1)
            assert recovered.containment.populated(record["containment"])
            result = await recovered.cancel("agentic", request, ACTOR, "2")
            assert result["state"] == "cancelled", result
        else:
            await recovered.legacy("agentic", key, ACTOR, "code", {"code": "fixture-secret-code"})
            result = await wait_job(recovered, request, {"succeeded", "failed", "cancelled"})
            assert result["state"] == "succeeded", result
        assert result["authorization_url"] is None and result["reason"] is None
        reservation = recovered.profiles.reserve("agentic")
        reservation.release()
        closed = await read(recovered, key)
        assert closed["closure_proof"] == "native_tree_closed"
        assert not recovered.containment.populated(closed["containment"])
        assert recovered.acknowledge("agentic", request, ACTOR, "2") == {"acknowledged": True}
        await recovered.close()
        return {"kernel_cgroup_closed": True, "state": result["state"]}
    finally:
        if api_process is not None and api_process.returncode is None:
            api_process.kill()
            await api_process.wait()
        await cleanup(manager, key)


async def web_case(directory):
    manager = runtime(directory)
    request = str(uuid4())
    key = request.replace("-", "")
    deadline = datetime.fromtimestamp(time.time() + 60, timezone.utc).isoformat()
    try:
        await manager.start("web", request, ACTOR, "2", deadline)
        async with asyncio.timeout(25):
            while True:
                try:
                    frame = await manager.legacy("web", key, ACTOR, "frame")
                    if frame["ready"]:
                        assert len(frame["image"]) > 100
                        break
                except ServiceError as error:
                    assert error.code in {"login_not_ready", "login_unknown", "login_invalid_interaction",
                                          "viewer_not_ready", "viewer_site_blocked", "viewer_unavailable"}, error.code
                await asyncio.sleep(0.1)
        record = await read(manager, key)
        process_ids = (manager.containment.directory(record["containment"]) / "cgroup.procs").read_text().split()
        assert len(process_ids) >= 3
        sessions = set()
        for pid in process_ids:
            try:
                sessions.add(os.getsid(int(pid)))
            except ProcessLookupError:
                pass
        assert len(sessions) >= 2  # Chromium/crashpad are allowed to setsid.
        os.kill(record["supervisor"]["pid"], signal.SIGKILL)
        await asyncio.sleep(0.1)
        # Playwright may close automatically on driver EOF, or the API watcher
        # may already reconcile. Either path still requires kernel-empty proof.
        result = await manager.cancel("web", request, ACTOR, "2")
        assert result["state"] == "cancelled", result
        assert not manager.containment.populated(record["containment"])
        manager.acknowledge("web", request, ACTOR, "2")
        return {"real_chromium_frame": True, "native_processes": len(process_ids),
                "native_sessions": len(sessions), "sigkill_native_tree_closed": True}
    finally:
        await cleanup(manager, key)


async def main():
    if os.environ.get("NODIA_ISOLATED_NATIVE_TEST") != "1":
        raise RuntimeError("explicit_isolated_runtime_required")
    with tempfile.TemporaryDirectory(prefix="n29-") as directory:
        root = Path(directory)
        for name in ("complete", "crash", "web"):
            (root / name).mkdir(mode=0o700)
        result = {"response_loss_and_http_restart": await agentic_case(root / "complete", False),
                  "supervisor_sigkill_and_pty_descendant_cleanup": await agentic_case(root / "crash", True),
                  "chromium_sigkill": await web_case(root / "web")}
        print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
