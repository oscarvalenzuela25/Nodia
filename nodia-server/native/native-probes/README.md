# Native Teacher boundary probes

These probes do not enable a provider or qualify a selection. The maintained
offline command binds no account, sends no user message and runs the actual
Antigravity 1.3.1 binary in a fresh Docker container with `--network none`.
Only the two explicitly named source/probe directories are mounted read-only;
no account directory, environment file, DB, service token or Docker socket is
mounted. The image and binary digest are pinned in `run-offline.ps1`.

```powershell
./nodia-server/native/native-probes/run-offline.ps1 -ModelId <explicit-model-id>
```

Exit2 means that the exact catalog could not be established. It is a blocked
probe, not a provider failure or a failed qualification. No raw CLI stdout or
stderr is persisted or emitted. A catalog observation alone does not establish
the hook gate, successful inference or operational readiness.

## Observed offline result, 2026-11-01

The actual pinned binary returned exit1, zero `init` events and verified local
process closure with empty stdin and no account. Therefore the offline run
cannot prove either the available tools or CLI hook execution. It sent zero
user messages and had no network. This result must not be generalized to a
logged-in account.

## Operator fixture: at most two owned CLI invocations

`teacher_operator_probe.py` is an importable harness, not a standalone live
command. `teacher_probe_hook.py` is its temporary hook fixture. Run it only
after Server has acquired the existing profile lease and durable admission for
the exact actor/selection/epoch; Native must be quiet. Reuse the existing
supervisor, dedicated ephemeral HOME, OAuth binding and owned process cleanup.
Do not run a direct CLI beside the normal worker or fabricate chat owners,
credentials, JWTs or qualifications. Each invocation is independent, one-shot,
bounded and has no retry or replay. Two CLI invocations is a local budget;
it is not a claim about the CLI's internal provider HTTP request count.

1. **Positive boundary.** Use the unmodified owned role, settings,
   empty MCP config and a temporary wrapper calling the byte-pinned production
   PreToolUse gate. Request a short structured
   nonce. Require exactly one init with the exact model/role and tools exactly
   `["finish"]`, exactly one allowed finish receipt, valid terminal text and
   observed local process-group closure. No native executable tool may appear.
   Retain only binary/source/policy hashes, selection/epoch identity, booleans,
   counts and closure proof. The normal operational qualification can supply
   this case without repeating inference.
2. **Broken hook negative.** In a separate ephemeral probe workspace, replace
   only the copied gate command with a fixture that records its invocation and
   exits nonzero without a decision or finish receipt. Keep the production role
   and all permissions closed. Require evidence that the hook was reached and
   that the composed production parser rejects the terminal and publishes no
   text. If the CLI itself continues after the hook error, report that behavior
   explicitly: the missing-receipt check provides the composed rejection; do not
   claim that the CLI hook implementation itself fails closed. Absence of a
   hook invocation is inconclusive, not a passing negative.
The positive hook also replaces toolCall in the actual observed packet with
`run_command` and passes it directly into the same SHA-pinned gate in an isolated
subprocess. Require deny plus a denied receipt. This costs zero inference and
does not execute the proposed tool. It proves the gate's rejection rule; it
does **not** prove that the CLI offered or attempted that forbidden tool. The
actual CLI catalog separately proves that it offered only finish. There is no
PreInvocation injection, expanded role or model-refusal-by-prompt probe.

### Root integration payload and installation

Root must create/admit two genuine Teacher SQL jobs through the normal runtime,
with the exact same authorized actor/selection/epoch. A job has its own real
TeacherReference (operation/session/job/attempt IDs, actor/connection IDs,
request/resource/configuration/session/runtime/policy hashes); never synthesize
these identities to run the fixture. The existing start flow acquires
profiles.admission and arms its marker before the pipe write.

For each job, in the quiet candidate process, install a `TeacherProbeRunner`
around `service.agentic.runner` before submitting the normal TeacherStart:

```python
budget = TwoTurnBudget()  # One shared instance for this complete operator run.
probe = TeacherProbeRunner(original_runner, service.profiles, real_reference,
    mode="positive", budget=budget, assert_sql_admitted=assert_sql_admitted)
service.agentic.runner = probe
# Submit the genuine TeacherStart through the normal Server/Native route.
# Wait for the normal SQL terminal + local closure + ACK, then read probe.evidence.
# Restore original_runner only after that owned operation has finished.
# Repeat once with mode="hook_fail" and a NEW genuine job/reference.
```

`assert_sql_admitted(reference)` is an async Root-supplied private integration
callback and must explicitly return True only after a read of the exact real
SQL job/attempt/operation confirms current actor/selection/generations, armed
dispatch, lease owner and fences. Missing/false callbacks block dispatch. Root
must also ensure the negative job cannot publish READY/result text or become a
qualification: normal unknown handling and local-proof/ACK reconciliation apply.
There is deliberately no account loader or standalone invocation in this module.

The wrapper independently requires the existing exact armed Native profile
marker, execution owner, pinned CLI version/hash, exact model/effort and owned
ephemeral workspace/role/gate before replacing only that workspace's hooks.json.
It calls the original CliRunner and returns its untouched output to the
production parser. It retains only bounded audit booleans/hashes/counts. The
copied hook keeps the real packet in memory only; neither raw output nor packet
is part of evidence. A missing observed hook packet makes the negative
inconclusive. Both modes consume their slot permanently before the CLI call.

Stop after any unknown closure, unexpected catalog, sentinel mutation or
unbounded continuation; retain the exact operation fence and reconcile without
replay. A process kill proves local closure only after the supervisor's group
proof; it does not prove remote cancellation or a known remote outcome.

## Primary sources and version boundary

The official [headless protocol](https://antigravity.google/docs/cli/headless/)
documents init.tools as the available-tool catalog and limits stdin streaming
input to user messages. It does not offer an injected tool-call input frame.
The official [hooks contract](https://antigravity.google/docs/hooks?tab=cli)
documents global `~/.gemini/config/hooks.json` and PreToolUse decisions.
These are current vendor docs;
support and failure behavior still require observation on pinned CLI1.3.1.
They do not document a sufficient guarantee for a nonzero/malformed/timeout hook
to fail closed. The production receipt and exact-catalog checks remain required.

The production parser now rejects missing, empty, additional or duplicate tools
in init, even if no forbidden call ran. Its Python regression suite passed 515
tests (four skipped) after this correction. That synthetic suite does not
replace the operator gate above.
