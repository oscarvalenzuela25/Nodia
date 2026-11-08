# Teacher Codex host prototype

This is a private, one-shot text host, not a replacement for the installed Codex
CLI or the NodiaAI chat runtime. It depends on the unmodified official OpenAI
crates at commit `979011409de0a60b52f179721948e65531d26144`, behind the annotated
`rust-v0.161.0` tag. The three Cargo patches are the exact dependencies patched
by that upstream release; Nodia maintains no provider fork.

Implementation is not operational qualification. Deployment, inference with an
actual account and acceptance for a selection/epoch remain separate gates.

## Private protocol

`--capabilities` writes one JSON line and exits before inspecting the current
directory, environment, config, profile, keyring or provider. Its metadata states
the source commit, policy hash and limits; it never claims account readiness.

Execution requires `CODEX_HOME` pointing to the existing dedicated profile,
`--workspace <absolute-empty-directory>` supplied by Server, and
`--config-json <trusted-CODEX_SETTINGS-JSON>`. Config accepts only the private
Nodia provider `nodia_codex`, ChatGPT authentication and keyring storage, with
HTTP/stream retries and WebSockets disabled. No key, auth JSON, login, profile
copy or new credential is accepted. Server retains its existing single profile
lock, start gate, process ownership and budget admission before spawning this
host. The host does not acquire a second profile lock.

The first stdin line is exactly:

```json
{"operation_id":"UUID","model_id":"exact persisted model ID","effort_id":null,"prompt":"server-owned context","deadline_at":"RFC3339 UTC","configuration_generation":"opaque generation","session_generation":"opaque generation","resource_key":"opaque profile key"}
```

`effort_id` can instead contain the exact supported upstream effort identifier.
Missing model IDs are rejected; null effort explicitly clears an old setting.
The deadline must be in the next ten minutes. Prompt input is at most131072 UTF-8
bytes; a bounded frame reader runs before parsing. No attachments, tools,
project roots, continuation, resume or arbitrary configuration are accepted in
this envelope. The supplied generations and resource key are digest inputs,
not authority grants. Server must authorize them independently.

The binding is SHA256 of UTF-8 canonical JSON with lexically sorted keys:
`configuration_generation`, `deadline_at`, `effort_id`, `model_id`,
`operation_id`, `policy_hash`, `prompt_hash`, `resource_key`,
`session_generation`, `source_commit`. `deadline_at` retains the exact input
string; hashes are lowercase hexadecimal SHA256. `prompt_hash` hashes the exact
UTF-8 prompt and `policy_hash` hashes the policy constant in `src/protocol.rs`.

Before starting the native thread stdout emits
`{"event":"started","operation_id":"…","binding_hash":"…","proof_nonce":"…","policy_hash":"…"}`.
Server must have persisted native admission before releasing its process start
gate. A completed terminal contains `event`, `status`, `binding_hash`,
`proof_nonce`, `text`, `text_hash`, `local_closed:true`, and
`remote_outcome:"completed"`. Text must be valid JSON, at most32768 UTF-8 bytes.
No thoughts, raw events, credential/account details, paths or SDK errors are
forwarded. Safe errors expose an allowlisted code and `retry:false`.

After a request, Server can send the small exact line
`{"event":"cancel","operation_id":"same UUID"}` or signal the process.
Errors after admission conservatively retain remote outcome `unknown`; local
loop closure never claims remote cancellation. Server waits for actual process
exit before accepting closure. An unverified close cannot publish output or
release ownership based solely on a terminal frame.

## Native restrictions

Before `start_thread`, the host captures `ToolPolicy.allowed_tools=Some([])` and
`SessionIsolation::Isolated`. The environment manager contains no environments;
the root has no dynamic tools or native attachments. Config loading ignores
user/project config and global/repository instructions; only trusted settings
and exact input selection are used. Threads and histories remain ephemeral in
memory. The only installed extension filters provider responses: it rejects
all tool items, tool-argument deltas and explicit continuation requests before
Core sees them, with a permanent error. Provider retries remain zero.
The model's actual SDK catalog metadata is required: fallback metadata cannot
authorize a selection. An explicit effort must be listed by that model and
resolve unchanged through the SDK. For example, an effort that the SDK maps to
another level is rejected before generation, even if the catalog lists it.
The startup event must preserve the explicit selection as well.
The pre-request contributor additionally rejects warmups, a changed model or a
second generation request before transmission by emitting a fixed error and
exiting70. That error explicitly has `local_closed:false`; only Server's
supervisor can verify process-group closure and retain remote outcome unknown.

## Verification

Use the pinned Docker build image (`Dockerfile.build`) on Linux with bounded
resources and one Cargo build job. Keep Cargo registry/git/target caches in
dedicated local volumes, not in the repository or operational profiles.
The image is Bookworm/glibc2.36 for the Ubuntu24.04 host baseline. Build outputs
from Trixie/glibc2.41 are incompatible and must never be promoted. Verify the
linked libraries and maximum GLIBC symbol in the final artifact before adoption.

The lockfile was seeded from the official release lock (SHA256
`3206e2fdb53a3498758ce2f2972f19fae26beb261befd65cc0eb9e02efe23d52`)
and resolved for this external git consumer. Resolving all dependencies afresh
is unsafe: upstream's `zip="2.4.2"` permits2.6.1, whose API breaks this release.
The maintained lock preserves2.4.2 without patching upstream source.

`cargo test --locked` covers bounded parsing and the actual upstream Core against
a loopback-only synthetic backend: outgoing empty tools/exact selection, an
unsolicited function call rejected without a second request, and cancellation
with verified local loop shutdown. These tests contain no account and do not
qualify a real provider. `cargo fmt --check` and `cargo clippy --all-targets`
complete the source checks. Preserve the lockfile once resolution succeeds.
After dependency preparation, run tests in a container with `--network none`
and Cargo `--offline`: its loopback backend remains available, but no external
provider or account can be reached. `check.ps1` keeps the target cache separate
for the Bookworm ABI and preserves Docker/Cargo exit codes.
Core's upstream CI and test runtime use8 MiB thread stacks. The host explicitly
sets8 MiB on its two runtime workers; the test harness uses the same
`RUST_MIN_STACK=8388608` for libtest threads.

For an optimized release, first prepare/cache dependencies with
`./check.ps1 -Task check`, then run `./check.ps1 -Task release`. This invokes
`cargo build --release --locked --offline` in the pinned Bookworm image with
external networking disabled, and writes the executable inside the dedicated
target volume at `release/nodia-teacher-codex-host`. A release is a different
artifact from a dev build: retain its exact hash/profile/linked-library manifest
and qualify that artifact before operating it. Do not relabel a dev artifact as
release or reuse another binary's acceptance.

`python package.py --profile dev` (or `release` after that build) copies and
strips the executable into this host's ignored `.cache/artifacts/<profile>/`
directory. It executes only `--capabilities` with an empty environment and
external networking disabled, inspects ELF/ldd/GLIBC requirements, and writes a
manifest beside the content-addressed executable. The manifest records the
actual build profile, size, SHA256, source/lock/base pins and capabilities. It
does not grant real-selection qualification or deploy anything.
