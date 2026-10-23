"""Actor/provider scoped login requests, independent of the HTTP process memory."""
import asyncio
import json
import os
from pathlib import Path
import sys
import time
from uuid import UUID

from login_request_store import LoginRequestStore, TERMINAL, request_key, login_deadline
from login_cgroups import LoginCgroups, supervisor_certificate, supervisor_alive
from service_errors import ServiceError


class DurableLoginRequests:
    def __init__(self, directory: Path, profiles, prepare_dispatch=None):
        self.store = LoginRequestStore(directory)
        self.profiles = profiles
        self.prepare_dispatch = prepare_dispatch
        self.containment = LoginCgroups()
        self.supervisor_script = Path(__file__).with_name("login_supervisor.py")
        self._processes: dict[str, asyncio.subprocess.Process] = {}
        self._watchers: set[asyncio.Task] = set()

    def _operation(self, record: dict) -> dict:
        return {"kind": "login_request", "resource_key": record["resource_key"], "request_id": record["request_id"]}

    def _release(self, record: dict) -> None:
        if record["state"] not in TERMINAL or not record.get("closure_proof") or not record.get("resource_key"):
            return
        try:
            self.profiles.reconcile_dispatch(record["engine"], self._operation(record))
        except ServiceError:
            # A newer operation owns the physical profile, or a historical
            # unbound marker is not ours. Never erase it with this old receipt.
            pass

    def _new(self, key: str, request_id: str, engine: str, actor: str, provider: str, deadline: float) -> dict:
        return {"version": 1, "id": key, "request_id": request_id, "engine": engine,
                "actor": actor, "provider": provider, "expires_at": deadline,
                "state": "armed", "resource_key": self.profiles.identity(engine),
                "supervisor": None, "containment": None, "closure_proof": None}

    async def start(self, engine: str, request_id: str, actor: str, provider: str, expires_at: str) -> dict:
        key = request_key(request_id)
        deadline = login_deadline(expires_at)  # before replay or admission
        if sys.platform != "linux":
            raise ServiceError("login_runtime_unsupported", "El login durable requiere el runtime Linux verificado.")
        async with self.store.alocked():
            existing = self.store.read(key)
            if existing is not None:
                record = self.store.owned(existing, actor, provider, engine)
                if record.get("closure_proof") != "never_dispatched" and record["expires_at"] != deadline:
                    raise ServiceError("login_request_mismatch", "El plazo del intento cambió.", 409)
            else:
                self.store.prune()
                reservation = self.profiles.reserve(engine, purpose="login")
                record = self._new(key, request_id, engine, actor, provider, deadline)
                try:
                    record["containment"] = self.containment.create(key)
                    # Both facts precede spawning. Unknown remains quarantined.
                    self.store.write(record)
                    self.profiles.arm_dispatch(engine, self._operation(record))
                    self.profiles.quarantine(engine)
                except BaseException:
                    if record["containment"] is not None:
                        self.containment.remove(record["containment"])
                    reservation.release()
                    raise
        if existing is not None:
            return await self.observe(engine, request_id, actor, provider)
        if self.prepare_dispatch is not None:
            await self.prepare_dispatch(engine)
        await self._spawn(key)
        return self.store.public(record)

    async def _spawn(self, key: str) -> None:
        descriptor_read, descriptor_write = os.pipe()
        os.set_inheritable(descriptor_read, True)
        process = None
        record = None
        try:
            process = await asyncio.create_subprocess_exec(
                sys.executable, str(self.supervisor_script),
                str(self.store.directory.resolve()), key, str(descriptor_read),
                stdin=asyncio.subprocess.DEVNULL, stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL, start_new_session=True,
                pass_fds=(descriptor_read,))
            async with self.store.alocked():
                record = self.store.read(key)
                if record["state"] == "armed":
                    # Move the gated supervisor before releasing its first byte.
                    # Every descendant inherits this kernel cgroup, even setsid.
                    self.containment.attach(record["containment"], process.pid)
                    record["supervisor"] = supervisor_certificate(process.pid)
                    self.store.write(record)
                    os.write(descriptor_write, b"1")
            self._processes[key] = process
            task = asyncio.create_task(self._watch(key, process))
            self._watchers.add(task)
            task.add_done_callback(self._watchers.discard)
        except BaseException:
            # Spawn result may be uncertain. The unreleased gate cannot dispatch
            # and the persisted request must be reconciled, never spawned again.
            if process is not None:
                if record is not None and record.get("containment") is not None:
                    await self.containment.close(record["containment"])
                else:
                    process.kill()
                    await process.wait()
            raise
        finally:
            os.close(descriptor_read)
            os.close(descriptor_write)

    async def _watch(self, key: str, process) -> None:
        await process.wait()
        self._processes.pop(key, None)
        async with self.store.alocked():
            record = self.store.read(key)
        if record is not None:
            if record["state"] not in TERMINAL:
                await self._recover(record)
            else:
                self._release(record)

    async def rpc(self, record: dict, action: str, payload: dict | None = None) -> dict:
        socket = self.store.directory / (record["id"] + ".sock")
        if socket.is_symlink():
            raise OSError("unsafe_socket")
        reader, writer = await asyncio.open_unix_connection(str(socket), limit=1_100_000)
        try:
            writer.write((json.dumps({"action": action, "actor": record["actor"], "provider": record["provider"],
                                      "payload": payload}) + "\n").encode())
            await writer.drain()
            reply = json.loads(await asyncio.wait_for(reader.readline(), 8))
            if "error" in reply:
                raise ServiceError(reply["error"], "No se pudo completar la interacción de login.", reply.get("status", 409))
            return reply["result"]
        finally:
            writer.close()
            await writer.wait_closed()

    async def observe(self, engine: str, request_id: str, actor: str, provider: str) -> dict:
        key = request_key(request_id)
        async with self.store.alocked():
            record = self.store.owned(self.store.read(key), actor, provider, engine)
        if record["state"] in TERMINAL:
            self._release(record)
            return self.store.public(record)
        try:
            return await self.rpc(record, "status")
        except (OSError, TimeoutError, ValueError, asyncio.IncompleteReadError):
            # An armed supervisor may still be starting; no retry of dispatch.
            if supervisor_alive(record["supervisor"]) is True and record["state"] != "closing":
                return self.store.public({**record, "state": "unknown"})
            return await self._recover(record)

    async def _recover(self, record: dict) -> dict:
        proof = record.get("containment")
        external = proof is not None and self.containment.known_closed(proof)
        if proof is None:
            closed = record.get("supervisor") is None
        else:
            closed = external or await self.containment.close(proof)
        async with self.store.alocked():
            current = self.store.read(record["id"])
            if current["state"] in TERMINAL:
                result = current
            elif current.get("supervisor") != record.get("supervisor") or current["containment"] != record["containment"]:
                result = {**current, "state": "unknown"}
            elif closed:
                current.update(state=current.get("candidate_state") or "cancelled",
                               closure_proof="container_tree_closed" if external else "native_tree_closed")
                self.store.write(current)
                result = current
            else:
                current["state"] = "unknown"
                self.store.write(current)
                result = current
        self._release(result)
        return self.store.public(result)

    async def cancel(self, engine: str, request_id: str, actor: str, provider: str, expires_at: str | None = None) -> dict:
        key = request_key(request_id)
        async with self.store.alocked():
            record = self.store.read(key)
            if record is None:
                # Unknown dispatch is fenced under the exact same admission lock.
                self.store.prune()
                record = self._new(key, request_id, engine, actor, provider, time.time() + 310)
                record.update(state="cancelled", closure_proof="never_dispatched", acknowledged=True)
                self.store.write(record)
                return self.store.public(record)
            record = self.store.owned(record, actor, provider, engine)
        if record["state"] in TERMINAL:
            self._release(record)
            return self.store.public(record)
        try:
            result = await self.rpc(record, "cancel")
            async with self.store.alocked():
                closed = self.store.read(key)
            return await self._recover(closed)
        except (OSError, TimeoutError, ValueError, asyncio.IncompleteReadError):
            return await self._recover(record)

    def acknowledge(self, engine: str, request_id: str, actor: str, provider: str) -> dict:
        with self.store.locked():
            found = self.store.read(request_key(request_id))
            if found is None:
                return {"acknowledged": True}
            record = self.store.owned(found, actor, provider, engine)
            if record["state"] not in TERMINAL or not record.get("closure_proof"):
                raise ServiceError("login_not_terminal", "El cierre del login no está probado.", 409)
            record["acknowledged"] = True
            # Retain only the immutable fence/proof until the admission deadline.
            if record["containment"] is not None:
                self.containment.remove(record["containment"])
            record["containment"] = None
            record["supervisor"] = None
            self.store.write(record)
        self._release(record)
        return {"acknowledged": True}

    async def legacy(self, engine: str, key: str, actor: str, action: str, payload: dict | None = None) -> dict | None:
        try:
            request_id = str(UUID(hex=key))
            if UUID(request_id).version != 4:
                return None
        except ValueError:
            return None
        async with self.store.alocked():
            record = self.store.read(key)
            if record is None or record["actor"] != actor or record["engine"] != engine:
                return None
        if action == "status":
            return await self.observe(engine, request_id, actor, record["provider"])
        if action == "cancel":
            return await self.cancel(engine, request_id, actor, record["provider"], None)
        if record["state"] in TERMINAL:
            raise ServiceError("login_finished", "El intento de login ha terminado.", 409)
        try:
            return await self.rpc(record, action, payload)
        except (OSError, TimeoutError, ValueError):
            raise ServiceError("login_unknown", "El proceso de login requiere conciliación.", 409) from None

    async def close(self) -> None:
        # Keep durable supervisors across HTTP-only restart. They own their
        # bounded deadline and are observed/cancelled by the new HTTP instance.
        for task in tuple(self._watchers):
            task.cancel()
        await asyncio.gather(*self._watchers, return_exceptions=True)
