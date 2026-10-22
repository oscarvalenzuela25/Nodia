# AI-16 independent contract review (2026-10-16)

Scope: inspection only. No service, inference, DB, migration or product-source mutation. Root owns contract/doc/ADR integration.

## Confirmed baseline

- `45` AI-16: bounded events with refs to tool calls/results; own observer cursor per device; projections reauthorized; links to actual app records; reconnect/return must not repeat tools; show dates/provenance when live data differs.
- `43` explicitly permits PostgreSQL durable polling **or** SSE. SSE is not required to deliver observation. API must not simulate streams or progress when adapters only return final messages. Native adapter currently returns full text; emit actual persisted transitions + message_sealed, leave assistant_delta unused until real supported streaming exists.
- PublicEvent has 10 closed variants: run_accepted, assistant_delta, message_sealed, run_changed, tool_completed, proposal_ready, execution_changed, step_changed, run_stage_changed, conversation_routing_changed. M1 implements no proposal/execution tables; do not manufacture their events.
- Shared required fields for run events: event_id, conversation_id, seq positive bigint string, cursor, kind, created_at, payload, run_id. Each payload is a closed discriminator-specific object.
- ToolResultRef exact: tool_call_id UUID, tool_name nonempty string, contract_hash lowercase SHA-256.
- EventListQuery exact: optional cursor, page_limit; additionalProperties false. Normalized transport integer with runtime default25/max100, cursor max2048 enforced in DTO.
- EventPage exact: conversation_id, items PublicEvent[], next_cursor string|null, cursor_state current|reset_required; all required. No has_more. No ToolCallResult or NavigationRef common definition currently exists. Existing GET tool-calls/:id/result specifies *registered_tool_output_schema* and requires current authority + exact known contract. Do not introduce generic unvalidated result JSON.
- EntityRef exists: resource_key, id bigint-string|UUID, optional label. PublicScope exists: subject_user_id/property_id/business_id/provider_id optional, exact types. Neither allows arbitrary URL.
- SourceProvenance exists for reports: source_alias/source_key/observed_at/scope/measure_keys/period/basis_key/matched_records. Do not use report-specific fields for arbitrary tool results by inventing measure/basis values.

## Existing M1 persistence

`nodia_ai_events` exists in migration1792200000000 and entity. There are currently **zero event writers** in production sources. Columns: id UUID; conversation_id FK CASCADE; seq bigint>0; event_key text1..256B; optional run_id FK composite NO ACTION deferred; public_payload object<=64KiB; scope_manifest object<=64KiB; created_at. UNIQUE(chat,seq) and UNIQUE(chat,event_key).

Existing UNIQUE(chat,seq) indexes conversation feed. For required run-filtered route, bounded efficient history may need additive `(run_id,seq)` index. No cursor/delivery table, broker, per-token table, replicated read model or audit-retention extension is needed. Existing chat cascade deletes events/results. No global delivered flag.

`nodia_ai_tool_calls` stores arguments/hash, tool_name/contract_hash, public_result nullable, scope_manifest, state, created_at/completed_at. UNIQUE(run_id,adapter_call_id), index(run_id,created_at). M1 roles states received|validated|completed|rejected|unknown. Local gateway persists completed receipts transactionally with result. External gateway persists validated then completes in fresh checkpoint.

## Lean implementation recommendation

1. A single internal append use case receives manager/chat/run/event key/kind/payload/scope from trusted backend transitions. Call it in same transaction as admission, run transitions, tool receipt and assistant message sealing. Assign seq under **the existing chat row lock**; deduplicate event_key before consuming activity capacity. No chat retention or user revision update per event.
2. Bound 256 events per activity (runtime policy) and reserve terminal/status/message space. Current max12 callbacks + few stages fit. No fake per-token delta emission. If later streaming exists, use 1KiB/250ms UTF-8 grouping and stop partials before final reserve, not dropping final states.
3. GET run events: session and NodiaAI authorization + chat read ownership first; current destination/module/action/resource authorization for sensitive refs before projection. Read existing rows only. Polling cursor is local observer checkpoint, never authority or execution receipt.
4. Cursor binds route/version/run/chat/actor/session/retention epoch and visibility-context hash. Validate base64 envelope/seq bigint range and no forged future positions. A changed visibility context needs reset_required without leaked content, then snapshot; expiry returns410 for own still-present expired chat,404 foreign/purged. Other device cursor is independent.
5. **Important EventPage semantic:** next_cursor must advance to last **scanned** seq even if no visible items or no more page now. If cursor is emitted only when rows>limit, active polling repeats previous page forever. Empty fresh stream must have a valid initial checkpoint (or explicit unchanged null with client preserving prior cursor). No consumer can infer has_more just from cursor nonnull; page draining uses bounded size or document separate flag in new version.
6. Read tool result with fresh identity and same-chat authority. Exact published tool hash/schema input/output validation, bound bytes/depth/cardinality; verifyAuthority and verifyResultAuthority on current resources. GET must not call tool.handler, external.prepare, provider, MCP, stage checkpoint, runtime slot or frozen grant. Completed chat results remain readable from a **new valid session** after old dispatch grant expires; no grant/lease requirement. Unknown/incomplete/result-absent cannot become fake empty success.
7. Respect tool.readIsolation when opening result transaction: Finance verifyAuthority explicitly rejects non-REPEATABLE READ. Reservations intentionally retains READ COMMITTED and rechecks post-lock membership; don't switch all domain transactions to RR.
8. Current gateway replay's scope_hash includes all visible frozen contracts. It is appropriate for same-call runtime replay, but a human result read should use current authority of **this** exact tool/resources, not demand all old grants/permissions remain identical. Do not reuse runtime replay through execute just to read.
9. Add a strict observation envelope if needed for source timestamp/navigation *outside* unchanged domain result schemas, updating common schema and coordination declaration together. Prefer `result` as dynamic exact-schema dispatch plus closed metadata; validate selected domain schema, never generic object success. Legacy route's raw-output contract cannot silently become envelope without updating resolution/consumers/tests. Alternative separate metadata route/list returns ToolResultRef + closed provenance/nav, existing result route stays exact domain.
10. Navigation: use code-owned resource-to-app-route resolver and exact structured IDs verified from receipt or native resource; no model-supplied path, arbitrary HTTP URL, label or query key execution. Distinguish detail modal vs real path: existing UI may only support list page. Do not invent `?id` handling that page ignores. Omit unsupported detail navigation explicitly or implement the supported target route as part of scope. A stale link still goes through current page/API guards.
11. Timestamp means when original query/result completed; it is not proof current domain rows are unchanged. Label snapshot_at/completed_at accurately; external quota timestamps have own semantics. Do not silently execute handler to refresh historic result. Current_on_download CSV/file refs already have exact real regeneration semantics and authenticated GET; expose only that registered private path, not storage URLs.

## Authority/privacy details

- Current `AuthorizeNodiaAiConversation`: ordinary users only own chats; super_admin may inspect any current chat, read-only, with inspection audit. Super_admin cannot write another owner's chat/confirm as owner. Preserve source-module requirements and actual domain owner/recipient. NodiaAI+destination assignments required for others; `ai:manage` where already applicable. No new action-ACL invented.
- Actor/session, active user/session state and module authority loaded from backend on every GET. No Redis navigation cache/localStorage authorization. Revocation prevents payload/result/link exposure, including older persisted records. Revalidate every page, no long-lived process cache.
- If observer lacks a source resource/module, omit entire sensitive tool event/reference/result rather than exposing tool name/ID/error/existence. Cursor advances over filtered events. A coarse run status should not accidentally carry error text/provider prompt/CLI diagnostics.
- Stored source_scope_manifest should contain only trusted module/resource scope, not tokens. Public events contain refs/status only, not tool result copies. Logs fixed category/UUID/counts only.
- Reconnect/return/refetch does only GET; mutation UUID retains original intent. No automatic tool re-execution or message re-admission; rendering repeated event IDs does not repeat toasts.

## Verification needed

Meaningful use-case tests:
- append twice same event_key => one row/capacity; concurrent writers stable unique seq; wrong fence/epoch cannot append late; transition+event rollback atomic.
- paginate equal timestamp events with seq>2^53 (strings), exact bounds25/100, cursor malformed/crossrun/crosssession/future; unchanged cursor empty page; filtered page advances; two devices independent; reset on visibility/retention change.
- replay observation repeatedly -> zero provider/tool handler/MCP/budget mutations; new session reads completed receipt after grant expiration; incomplete/unknown/nonexistent fail explicitly.
- ordinary foreign404; own expired410 until purged404; super_admin read audited+no owner impersonation; removed destination module/action/Reservation collaborator revocation hides previous result and refs.
- exact schema/hash drift, retired/unpublished tool, malformed persisted result, oversized result rejected; bigint money stays string; null/zero preserved; no internal arguments/secrets leak.
- result read Finance uses RR; Reservations READ COMMITTED preserves real revocation ordering; external results don't dispatch prepare/network.
- allowed nav route from verified record only; arbitrary path/URL/entity injection refused; stale record fails safe; no link shown for unsupported destination.
- UI reconnect/backforward/chat switch/new identity/cursor reset, duplicate events, paging older runs, canonical final message replacing any genuine partial, metadata source time vs current refresh. Cached sensitive result cleared on authority errors; draft/focus preserved.
- PostgreSQL isolated integration verifies constraints, index plan/row bound, row locks and cascade retention/atomicity/races. Browser fixtures cover narrow/wide ES/EN light/dark, keyboard and actual navigation target.

## Decisions/limitations to record, not blockers requiring new permission

- Polling vs SSE: choose durable polling for v1 current final-only adapters; source43 authorizes it. SSE remains optional future delivery; don't promise SSE or token streaming now.
- Result endpoint exact-output vs envelope metadata must be chosen explicitly in schema/coordination docs. There is no approved existing ToolCallResult envelope to preserve.
- Existing chats/runs have no events. Read fallback snapshot for them; no reconstructing tool execution or claiming historical observed timing/events. Optional deterministic historical refs can be derived read-only with original receipt timestamps and clearly described.
- An additive run events index is enough; no new persistence table required. SSE connection limit irrelevant until implementing SSE; polling must still be bounded/visibility-aware and stop when terminal/current.
- AI-15 R2 binary gate remains independently open, does not block pure read observation or justify declaring R2 verified.
