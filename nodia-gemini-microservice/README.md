# Nodia Agentic adapter (private Python service)

## NativeR16 diagnostic cut — 2026-11-07

NativeR16 is deployed with one production-file delta: independent best-effort structured CLI-log and hook diagnostics in finally, using the inherited helper unchanged. Diagnostic failures never replace the OCR outcome; no free-form log text is published. All660Linux tests passed without skips, plus the account-free network-none closure fixture. The image preserves SDK/configuration and the pinned CLI1.3.1.

Real OCR remains blocked: a fresh explicit intent using the preserved PNG returnedHTTP504 after250s at the UI (240s deadline;242057ms inference). File reading completed but no finish/result event was observed. The hook recorded one decision, zero rejections and zero finishes in this attempt. A truncated30835-byte/128-line log had no recognized transport/provider/HTTP indicator; this does not establish that none occurred or prove a remote root cause. The post-run observation found zero CLI processes, markers, manual proofs and owned groups; the file and controls recovered. No replay, additional analysis POST, save or new matching followed this failure. Ten rejected health_status observations were metadata calls, not more inference attempts. No CLI upgrade, model/effort change or extension of240/300/340/360s was performed. A compatible strategy and a successful real extraction remain pending. [Evidence R16](../docs/evidence/invoice-gemini-timeout-20261107-r02.json).

## NativeR15 operational cut — 2026-11-07

NativeR15 is deployed in the VM: explicit finish instruction, file-progress callback/counters and a falsey-error guard, in two production files. Parser, role/hook, runner, selected model/effort, SDK and the existing240/300/340/360s limits are unchanged. All659Linux tests passed with zero skips. An account-free network-none fixture verified cancellation, a setsid descendant, IO drain and a fresh intent after local closure. The cutover deliberately stopped/resumed the original ServerR12 units while preserving ClientR37; it performed noSQL/provider requests, legacy-marker actions or timer actions.

The earlier504/240s remains a failed/remote-unknown outcome and is never replayed. A fresh explicit real OCR intent also failed withHTTP504 after251s at the UI (240s runtime deadline;242051ms inference duration). File reading completed but no result/finish was observed. The post-run observation found zero CLI processes, markers, manual proofs or owned groups; the PNG stayed loaded and controls recovered. Local closure is not remote success; the outcome remains unknown and is never replayed. Prompt compatibility did not resolve the timeout and remains an unproven causal hypothesis. Safe cli.log/hook instrumentation is being prepared for R16; no deadline is extended. [Evidence](../docs/evidence/invoice-gemini-timeout-20261107-r01.json).

## Current scope: Agentic only, 2026-10-27

The user-authorized [two-mode plan90](../docs/mvp/90-agentic-api-only-web-retirement.md) retires the Web transport. Nodia exposes **Agentic** and **API key**; this private service implements Agentic through the reviewed Antigravity CLI. API keys remain encrypted and executed by Nodia Server. This service does not receive API keys and never falls back to another transport/provider.

Apply the [mandatory provider acceptance plan91](../docs/mvp/91-ai-provider-onboarding-verification.md) when adding a provider, adapter or mode, and when changing these contracts. Configuration, authentication, discovery and a successful inference are separate observations. The implementation here does not assert deployment or account availability; record those gates independently.

## Security and startup

Nodia Server is the only direct consumer. All routes except `/health` require `X-Nodia-Service-Token` (`GEMINI_SERVICE_TOKEN`, 32 random bytes encoded as hex). Keep it outside responses, logs and the frontend. On the host bind to `127.0.0.1`; Compose publishes only `127.0.0.1:8000`. A container shared with Server should use a private network without a public port. Preserve the separate service credential and network policy in ADR007/008.

`python run.py` starts one Uvicorn worker. Importing `main` does not load `.env`, construct operational clients, touch profiles or start subprocesses. The lifespan validates service configuration and initializes the Agentic adapter through profile admission. Missing CLI configuration remains an explicit unavailable state; `/health` is process liveness only.

The image uses a verified official `python:3.12-slim-bookworm` index digest (Python3.12.16 linux/amd64 metadata observed on2026-10-27). Previous R10 used3.12.3. It installs only runtime CA certificates, libstdc++ and libseccomp plus Python requirements and the official CLI pinned by `antigravity-cli.lock.json`. No Playwright, Chromium, SDK Web or Xvfb is required. A Linux build and CLI/decoder verification are required before adoption; a registry digest and Windows unit tests do not establish that gate.

## Configuration and persistent state

Use `.env.example` for variable names and configure their values privately. Never rewrite the user's ignored `.env` to remove old variables.

- Service: `HOST`, `PORT`, `GEMINI_SERVICE_TOKEN`.
- Admission: `MAX_INVOICE_FILE_BYTES`, `ANALYSIS_SLOTS`, `UPLOAD_TIMEOUT_SECONDS`, `ANALYSIS_TIMEOUT_SECONDS`.
- CLI: `ANTIGRAVITY_CLI_PATH`, `ANTIGRAVITY_CLI_SHA512`, `ANTIGRAVITY_CLI_HOME`, `ANTIGRAVITY_CLI_VERSION`, `ANTIGRAVITY_CLI_TIMEOUT_SECONDS`.
- The CLI home must be a dedicated absolute path outside the repository. Account files stay under native CLI management. No model is assigned by default; every inference requires the exact discovered selection from Server.
- Preserve `/app/session_state`: it now hosts admission markers, terminal receipts and durable login journals. Existing historical cookie files may stay untouched but are never read by this application. Do not discard this volume when removing the browser mount.
- Preserve `/home/nodia/agentic_profile` and its existing private mount from `docker-compose.agentic.yml`.
- `/app/temp_uploads` remains a bounded tmpfs for validated files. No business originals or credentials belong in a build context.

The browser profile mount and web-reasoning overlay are retired. Do not delete their host data as part of deployment. Recreate the service with the current Compose files after verifying the effective mounts; no browser or graphical port is exposed.

## Private routes

| Operation | Route |
|---|---|
| Liveness | `GET /health` |
| Authenticated metadata | `GET /`, `/ready`, `/agentic/ready`, `/agentic/status`, `/agentic/models`, `/engines/status` |
| Official remote login | `POST /agentic/auth/login/start`; `GET /agentic/auth/login/current`; `GET /agentic/auth/login/{job_id}`; `POST .../{job_id}/code`; `POST .../{job_id}/cancel` |
| Durable login | `POST/GET /agentic/auth/login/requests/{request_id}`; `POST .../cancel`; `POST .../ack` |
| Invoice extraction | `POST /agentic/analyze-invoice` (legacy `/analyze-invoice` accepts Agentic only) |
| Chat metadata/context/turn | `POST /nodia-ai/agentic/observe`, `/measure-context`, `/turn` |
| Native attachment qualification | `POST /nodia-ai/agentic/attachments/probe` |
| Native MCP | `POST /nodia-ai/agentic/mcp/start`; `/nodia-ai/agentic/attempts/{attempt_id}/mcp/events`, `/results`, `/cancel`, `/attest` |
| Reconciliation/ACK | `POST /nodia-ai/agentic/attempts/{attempt_id}/reconcile`, `/acknowledge` |
| Common OCR and image contracts | `POST /nodia-ai/invoice-analysis/contract`, `/nodia-ai/agentic/invoice/turn`, `/nodia-ai/agentic/image/turn` |
| Binary inspection/progress | `POST /attachments/inspect`; `GET /analysis-observations/{identifier}` |

`/engines/status` contains `status`, `default_engine: agentic` and `agentic`, without a Web object. Unknown quotas/model/session evidence remain unknown. `/ready` requires observed Agentic availability and session; it does not generate an inference. New Web engines are rejected before dispatch; `/web/*`, `/auth/*` and the old Web `/models` endpoint are absent. Historical Web proof/journal records remain parseable for forensic reading; new arms and login starts accept only Agentic.

## Preserved safety guarantees

One physical profile owns chat, OCR, login, model discovery and metadata observation. Keep one worker. A connection ID never multiplies capacity. Profile admission is exclusive for execution; bounded observations serialize without creating inference retries.

Arm the exact attempt marker before dispatch. Timeout/cancellation/invalid output may leave an uncertain result. Do not replay it, clear a marker by TTL, or infer native process closure from an HTTP cancellation. Reconcile by exact resource/session/attempt identity and emit terminal proof only after actual closure; acknowledge after SQL commit. Historical unbound markers cannot be released by an unrelated receipt.

Durable login preserves actor/provider/request ownership, deadlines and cancellation tombstones. The Linux host helper delegates only the current container's cgroup at `/run/nodia-login-cgroups`, with a root-owned readonly attestation `/run/nodia-login-containment.json`. The adapter requires kernel-empty proof before publishing a terminal state, including supervisor crashes and descendants that create new sessions. Never mount the Docker socket, host-wide cgroups or privileged container capabilities. `session_state` journals must survive API restart; no code, authorization URL or token is written there.

Native chat exposes only the supervised finish tool by default. Business MCP uses the closed Server-supplied catalog and private callback loop, with strict request/byte budgets. Model output and Markdown never create permissions, arbitrary HTTP/shell/file access or confirmation authority. Human review and idempotent business writes remain Server responsibilities.

Originals are validated by size, signature, hash and actual content before native use. `attachments/inspect` runs Linux decoders in isolated subprocesses with resource/syscall limits. Supported MIME admission and unknown/null/zero semantics are preserved. A format works only after qualification for the exact profile/session/model/effort/configuration and adapter epoch; WAV does not authorize WebM, PNG does not authorize JPEG. A wrong probe reply can have a completed terminal receipt while leaving the modality unverified.

## Verification

Run `.venv/Scripts/python.exe run_tests.py` on Windows or `.venv/bin/python run_tests.py` on Linux. The runner installs isolation before test imports, prohibits external network and uses synthetic documents/services. It does not consume accounts or start a real browser. Shared safety regressions now use Agentic; tests exclusively tied to the retired Web SDK/visor were removed with that feature. `tests/test_agentic_only.py` covers retired routes, closed mode input, liveness/readiness, unknown quota and no new Web dispatch.

Linux integration is separate: `NODIA_ISOLATED_NATIVE_TEST=1 python scripts/verify_durable_login.py` uses actual fixture CLI/PTY, UDS and cgroups inside an ephemeral account-free container with the host helper attached. It tests response loss/restart, supervisor SIGKILL and native descendant closure. It does not authenticate a provider or claim a real inference. Before deployment, build the image and run CLI/version/hash, pip check, attachment decoder tests and this relevant containment integration.

Real Agentic and API acceptance is coordinated through Server and [plan91](../docs/mvp/91-ai-provider-onboarding-verification.md), with VM state, source hash, one exact inference, terminal success/output validity and ACK/quiet evidence. No source build, health200, login or configured key alone is a success claim.
