"""Disposable HTTP-owner stand-in; killed after dispatch to test a real restart."""
import asyncio
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from verify_durable_login import ACTOR, runtime, wait_job


async def main():
    directory, request, deadline = sys.argv[1:]
    manager = runtime(Path(directory))
    await manager.start("agentic", request, ACTOR, "2", deadline)
    result = await wait_job(manager, request, {"waiting_code", "failed", "cancelled"})
    assert result["state"] == "waiting_code", result["state"]
    print(json.dumps({"ready": True}), flush=True)
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
