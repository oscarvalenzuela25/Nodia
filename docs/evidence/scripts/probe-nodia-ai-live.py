"""Explicit non-generative lab observation; never emits credentials or account details."""
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone


def main() -> None:
    from dotenv import dotenv_values
    token = os.environ.get("GEMINI_SERVICE_TOKEN") or dotenv_values("/app/.env").get("GEMINI_SERVICE_TOKEN")
    if not token:
        raise SystemExit("Private service credential unavailable")
    request = urllib.request.Request("http://127.0.0.1:8000/engines/status",
                                     headers={"X-Nodia-Service-Token": token})
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        print(json.dumps({"http_status": error.code}))
        return
    web, agentic = data.get("web", {}), data.get("agentic", {})
    print(json.dumps({
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "inference_performed": False,
        "web": {key: web.get(key) for key in ("authenticated", "has_cookies", "has_browser_profile", "model", "supported_options")},
        "agentic": {**{key: agentic.get(key) for key in ("available", "has_active_session", "reason", "model", "quota_source", "quota_observed_at")},
                    "model_ids": [item.get("id") for item in agentic.get("models", []) if isinstance(item, dict)]},
    }, indent=2))


if __name__ == "__main__":
    main()
