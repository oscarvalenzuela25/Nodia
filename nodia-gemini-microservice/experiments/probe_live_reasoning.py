"""Explicit live experiment. Stop the normal profile owner before running."""
from __future__ import annotations

import argparse
import asyncio
from functools import partial
from contextlib import asynccontextmanager
import json
from pathlib import Path
import sys
import time
import re


async def probe(observations: Path, model_id: str, levels: list[str], run_tag: str) -> dict[str, object]:
    from loguru import logger
    logger.remove()  # Output only controlled metadata, never SDK/provider diagnostics.
    import web_reasoning_adapter as web_reasoning
    import gemini_service

    if observations.stat().st_size > 131072:
        raise ValueError("Observation file exceeds the experiment limit")
    profile = web_reasoning.ObservedProfile.from_observations(
        json.loads(observations.read_text(encoding="utf-8")))
    if profile.model_id != model_id:
        raise ValueError("Explicit model does not match native observations")
    gemini_service.GeminiClient = partial(web_reasoning.ReasoningWebClient,
                                          observed_profile=profile)
    original_rewrite = web_reasoning.rewrite_generation
    original_stream = web_reasoning._GenerationTransport.stream
    emitted: list[dict[str, object]] = []

    def observe(headers, data, observed_profile, level):
        changed_headers, changed_data = original_rewrite(headers, data, observed_profile, level)
        header = json.loads(changed_headers[web_reasoning.MODEL_HEADER_KEY])
        body = json.loads(json.loads(changed_data["f.req"])[1])
        emitted.append({"level": level, "model_id": header[4],
                        "header_code": header[15], "body_code": body[80]})
        return changed_headers, changed_data

    web_reasoning.rewrite_generation = observe

    @asynccontextmanager
    async def observe_response(transport, method, url, **kwargs):
        before = len(emitted)
        async with original_stream(transport, method, url, **kwargs) as response:
            if len(emitted) > before:
                emitted[before]["http_status"] = response.status_code
            yield response

    web_reasoning._GenerationTransport.stream = observe_response
    service = gemini_service.GeminiWebService(generation_timeout=120)
    result: dict[str, object] = {"model_id": model_id, "sdk_version": web_reasoning.VERIFIED_SDK_VERSION,
                                "authenticated": False, "tests": [], "emitted": emitted}
    try:
        async with asyncio.timeout(120):
            await service.init_client()
        if not service.is_initialized or service.client is None:
            raise RuntimeError("Session is not initialized")
        result["authenticated"] = True
        model = service.resolve_model(model_id)
        for level in levels:
            started = time.monotonic()
            before = len(emitted)
            try:
                async with asyncio.timeout(120):
                    response = await service._generate_content(
                        f"NODIA_SDK_REASONING_{run_tag}_{level.upper()}. Responde únicamente OK.",
                        model=model, thinking_level=level)
                test = {"level": level, "response_ok": response.text.strip() == "OK",
                        "generation_requests": len(emitted) - before,
                        "elapsed_seconds": round(time.monotonic() - started, 2)}
            except Exception as error:
                test = {"level": level, "response_ok": False, "error_class": type(error).__name__,
                        "generation_requests": len(emitted) - before,
                        "elapsed_seconds": round(time.monotonic() - started, 2)}
            result["tests"].append(test)
            if not test["response_ok"]:
                break  # No retries, model/account substitution or uncertain replay.
    except Exception as error:
        result["error_class"] = type(error).__name__
    finally:
        try:
            async with asyncio.timeout(10):
                await service.close()
        finally:
            web_reasoning.rewrite_generation = original_rewrite
            web_reasoning._GenerationTransport.stream = original_stream
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live-web", action="store_true", required=True)
    parser.add_argument("--native-observations", type=Path, required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--levels", nargs="+", choices=("low", "medium", "high"), default=["low", "medium", "high"])
    parser.add_argument("--run-tag", default="INITIAL")
    arguments = parser.parse_args()
    if len(set(arguments.levels)) != len(arguments.levels) or not re.fullmatch(r"[A-Z0-9]{1,16}", arguments.run_tag):
        parser.error("Unique levels and a short synthetic run tag are required")
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    try:
        result = asyncio.run(probe(arguments.native_observations, arguments.model, arguments.levels, arguments.run_tag))
    except Exception as error:
        result = {"error_class": type(error).__name__}
    print(json.dumps(result))
    tests = result.get("tests", [])
    return 0 if len(tests) == len(arguments.levels) and all(test["response_ok"] and test["generation_requests"] == 1 for test in tests) else 1


if __name__ == "__main__":
    sys.exit(main())
