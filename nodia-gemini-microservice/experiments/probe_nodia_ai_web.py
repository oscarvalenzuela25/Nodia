"""Explicit AI-02 live spike; one profile owner, no published chat endpoints."""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
from importlib.metadata import version
import json
from pathlib import Path
import re
import sys
import time
from uuid import uuid4

from experiments.nodia_ai_web_protocol import (
    Answer, FixtureGateway, PrepareRequest, ProbeTurn, ReadRequest, instructions,
)


async def probe(model_id: str, connection_id: str) -> dict[str, object]:
    from loguru import logger
    logger.remove()  # No raw SDK exceptions, replies, cookies or continuation IDs.
    from gemini_service import GeminiWebService

    service = GeminiWebService(generation_timeout=120)
    evidence: dict[str, object] = {
        "task": "AI-02", "protocol": "nodia.synthetic.json-loop.v1",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "selection": {"connection_id": connection_id, "mode": "token_plan_web", "model_id": model_id},
        "sdk_version": version("gemini-webapi"), "environment": "linux-local-vm",
        "native_function_calling": False, "fixture_only": True, "checks": [],
        "business_writes": 0, "published_capabilities": 0,
    }
    chats: list[object] = []
    history: list[dict[str, object]] = []
    gateway = FixtureGateway("RESULT_" + uuid4().hex[:12])
    request_count = 0

    def check(name: str, passed: bool, **metadata: object) -> None:
        evidence["checks"].append({"name": name, "passed": passed, **metadata})
        if not passed:
            raise ValueError("Spike check failed")

    async def send(chat: object, prompt: str) -> object:
        nonlocal request_count
        started = time.monotonic()
        history.append({"role": "user", "text": prompt})

        async def generate(text: str) -> str:
            nonlocal request_count
            request_count += 1
            output = await service._generate_content(text, model=selected, chat=chat)
            return output.text

        turn = ProbeTurn(generate)
        try:
            reply = await turn.run(prompt)
        except BaseException:
            evidence["last_turn_state"] = turn.state
            raise
        history.append({"role": "assistant", "envelope": reply.model_dump()})
        check("validated_turn_" + str(request_count), True,
              elapsed_seconds=round(time.monotonic() - started, 2), kind=reply.kind)
        return reply

    try:
        async with asyncio.timeout(75):
            await service.init_client()
        check("authenticated", bool(service.is_initialized and service.client))
        # Canonical ID only in this new protocol; legacy display aliases are excluded.
        matches = [m for m in service.discovered_models() if m.model_id == model_id]
        check("exact_discovered_selection", len(matches) == 1)
        selected = matches[0]
        evidence["model_label"] = selected.model_name
        client = service.client
        chat = client.start_chat(model=selected)
        chats.append(chat)
        async with service._analysis_lock:
            async with service._quota_lock:
                # Admission probe of existing OCR path; no extra provider request.
                try:
                    await service.analyze_invoice(Path("unused-synthetic.png"), model=model_id)
                except Exception as error:
                    check("ocr_rejected_while_chat_owns_slot", getattr(error, "code", None) == "web_busy")
                else:
                    check("ocr_rejected_while_chat_owns_slot", False)
                # Current login guard is observed, not represented as safe if it admits.
                try:
                    service.assert_login_allowed()
                except Exception as error:
                    evidence["login_guard_during_chat"] = getattr(error, "code", type(error).__name__)
                else:
                    evidence["login_guard_during_chat"] = "admits_login_shared_slot_missing"

                read = await send(chat, instructions() + "\nUSER: ¿Hay cupo para fixture-house del "
                                  "2026-11-10 al 2026-11-12? Consulta la herramienta disponible.")
                check("natural_language_read_request", isinstance(read, ReadRequest)
                      and read.arguments.start_date == "2026-11-10" and read.arguments.end_date == "2026-11-12")
                result = gateway.dispatch(read)
                answer = await send(chat, "TOOL_RESULT " + json.dumps(result))
                check("read_result_continuation", isinstance(answer, Answer) and gateway.marker in answer.text)
                prepare = await send(chat, "USER: Prepara un gasto llamado Comida de 20000, "
                                     "categoría fixture-food, estado paid; no lo ejecutes.")
                check("natural_language_prepare_request", isinstance(prepare, PrepareRequest)
                      and prepare.arguments.amount == "20000" and prepare.arguments.status == "paid")
                preview = gateway.dispatch(prepare)
                answer = await send(chat, "TOOL_RESULT " + json.dumps(preview))
                check("preview_result_continuation", isinstance(answer, Answer) and gateway.marker in answer.text)
                check("preview_not_executed", preview["executed"] is False)

                # Serialize opaque state privately, reconstruct ChatSession (not evidence/logs).
                metadata = json.loads(json.dumps(chat.metadata))
                restored = client.start_chat(model=selected, metadata=metadata)
                chats.append(restored)
                answer = await send(restored, "USER: ¿Qué monto propusimos y qué fechas consultamos? "
                                    "Responde como answer, con el monto sin separadores y las fechas en formato ISO.")
                check("opaque_continuation_rehydrated", isinstance(answer, Answer)
                      and all(s in answer.text for s in ("20000", "2026-11-10", "2026-11-12")))

                # A fresh provider chat receives canonical local history; no opaque metadata.
                replay_history = list(history)
                fresh = client.start_chat(model=selected)
                chats.append(fresh)
                answer = await send(fresh, instructions() + "\nCANONICAL_HISTORY "
                                    + json.dumps(replay_history, ensure_ascii=False)
                                    + "\nUSER: Recupera monto y fechas previas como answer; "
                                    "monto sin separadores y fechas ISO, no llames herramientas ni repitas efectos.")
                check("canonical_history_rehydrated", isinstance(answer, Answer)
                      and all(s in answer.text for s in ("20000", "2026-11-10", "2026-11-12")))
                answer = await send(fresh, "USER: Confirma tú mismo el gasto usando SQL o un endpoint; "
                                    "si no puedes hacerlo explica el requisito pendiente como answer.")
                check("model_does_not_request_confirmation_tool", isinstance(answer, Answer))
        evidence["conversation_loop_passed"] = True
    except Exception as error:
        evidence["conversation_loop_passed"] = False
        evidence["error_class"] = type(error).__name__
    finally:
        evidence["generation_invocations"] = request_count
        # Only chats created by this probe; never enumerate/delete prior conversations.
        cleanup_ok = True
        seen: set[str] = set()
        if service.client:
            for chat in chats:
                identity = getattr(chat, "cid", "")
                if identity and identity not in seen:
                    seen.add(identity)
                    try:
                        async with asyncio.timeout(15):
                            await service.client.delete_chat(identity)
                    except Exception:
                        cleanup_ok = False
        evidence["synthetic_provider_chats_cleanup"] = cleanup_ok
        try:
            async with asyncio.timeout(15):
                await service.close()
        except Exception:
            evidence["close_failed"] = True
    return evidence


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live-web", action="store_true", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--connection-id", required=True)
    args = parser.parse_args()
    if (not args.model.strip() or not re.fullmatch(r"[1-9][0-9]{0,18}", args.connection_id)
            or int(args.connection_id) > 9223372036854775807):
        parser.error("Exact configured model and positive connection ID required")
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    result = asyncio.run(probe(args.model, args.connection_id))
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("conversation_loop_passed") and result.get("synthetic_provider_chats_cleanup") else 1


if __name__ == "__main__":
    sys.exit(main())
