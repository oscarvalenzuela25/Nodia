import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  admitNodiaAiMessage, createNodiaAiConversation, getNodiaAiCatalog, getNodiaAiConversation,
  getNodiaAiConversations, getNodiaAiEligibility, getNodiaAiMessages, setNodiaAiRouting, getNodiaAiEvents, getNodiaAiObservation,
  getNodiaAiProposal,
  getNodiaAiProposalReview, updateNodiaAiProposal, challengeNodiaAiProposal, confirmNodiaAiProposal, getNodiaAiCurrentProposal, getNodiaAiExecution,
  controlNodiaAiExecution, getNodiaAiReport, updateNodiaAiConversation,
} from "../../../../modules/nodiaAi/infrastructure/services";
import { chatId, conversation, detail, messageId, run, selection } from "./fixtures";
import { acceptedEvent, observation, toolRef } from "./observationFixtures";
import { proposal, proposalEvent, stepId, editableReview, execution } from "./proposalFixtures";
import { workflowProposal } from "./workflowFixtures";
import { rentalPolicyReview } from "./rentalFixtures";
import { coreUserReview, coreRoleReview } from "./coreFixtures";
import { report } from "./reportFixtures";

const http = vi.hoisted(() => ({get: vi.fn(), post: vi.fn(), patch: vi.fn()}));
vi.mock("../../../../config/api", () => ({mainInstance: http}));

describe("NodiaAI HTTP boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  it("updates organization through the exact chat revision with nullable title and false flags", async () => {
    const input = {expected_conversation_revision: conversation.revision, title: null, is_pinned: false, is_archived: false};
    const updated = {...conversation, revision: conversation.revision + 1, title: null, is_pinned: false, is_archived: false};
    http.patch.mockResolvedValue({data: updated});
    expect(await updateNodiaAiConversation(chatId, input)).toEqual(updated);
    expect(http.patch).toHaveBeenCalledExactlyOnceWith(`/nodia-ai/conversations/${chatId}`, input);
    expect(http.post).not.toHaveBeenCalled();
  });
  it.each([
    {expected_conversation_revision: 1},
    {expected_conversation_revision: 1, title: " "},
    {expected_conversation_revision: 1, title: "á".repeat(129)},
    {expected_conversation_revision: 1, title: "Valid", arbitrary: true},
    {expected_conversation_revision: 1, is_pinned: null},
    {expected_conversation_revision: 0, is_archived: false},
  ])("rejects invalid or empty organization edits before HTTP", async input => {
    await expect(updateNodiaAiConversation(chatId, input as Parameters<typeof updateNodiaAiConversation>[1])).rejects.toThrow();
    expect(http.patch).not.toHaveBeenCalled();
  });
  it.each([
    {conversation_id: messageId}, {revision: conversation.revision}, {revision: conversation.revision + 2},
    {title: "Another title"}, {is_pinned: false}, {is_archived: false},
  ])("rejects a mismatched organization receipt instead of claiming the requested update", async mismatch => {
    const input = {expected_conversation_revision: conversation.revision, title: "Exact title", is_pinned: true, is_archived: true};
    http.patch.mockResolvedValue({data: {...conversation, revision: conversation.revision + 1, title: "Exact title", is_pinned: true, is_archived: true, ...mismatch}});
    await expect(updateNodiaAiConversation(chatId, input)).rejects.toThrow("nodia_ai:invalid_response");
    expect(http.patch).toHaveBeenCalledTimes(1);
  });
  it("reads a saved report through the authenticated read boundary and validates the full wire", async () => {
    const ref = { ...toolRef, tool_name: "nodia_reports_run" };
    http.get.mockResolvedValue({ data: report });
    expect(await getNodiaAiReport(ref)).toEqual(report);
    expect(http.get).toHaveBeenCalledWith(`/nodia-ai/tool-calls/${ref.tool_call_id}/result`, { signal: undefined });
    http.get.mockResolvedValue({ data: { ...report, source_results: [{ ...report.source_results[0], totals: { total: 123 } }] } });
    await expect(getNodiaAiReport(ref)).rejects.toThrow();
    await expect(getNodiaAiReport(toolRef)).rejects.toThrow();
    expect(http.post).not.toHaveBeenCalled();
  });
  it.each([coreUserReview, coreRoleReview])("accepts closed structured Core metadata", async review => {
    http.get.mockResolvedValue({ data: review });
    expect(await getNodiaAiProposalReview(proposalEvent.payload)).toEqual(review);
  });
  it.each(["core_id_list", "core_translations"] as const)("rejects incompatible bounds for %s", async kind => {
    http.get.mockResolvedValue({ data: { ...coreRoleReview, editable_fields: [{ ...coreRoleReview.editable_fields[1], kind, maximum: "101" }] } });
    await expect(getNodiaAiProposalReview(proposalEvent.payload)).rejects.toThrow();
  });
  it("accepts the explicitly registered structured rental rules kind", async () => {
    http.get.mockResolvedValue({ data: rentalPolicyReview });
    expect(await getNodiaAiProposalReview(proposalEvent.payload)).toEqual(rentalPolicyReview);
  });
  it.each([{ minimum: "0" }, { maximum: "101" }, { nullable: true }, { max_length: 100 }, { options: [{ value: "raw", label_key: "raw" }] }])("rejects incompatible structured rules metadata %j", async patch => {
    http.get.mockResolvedValue({ data: { ...rentalPolicyReview, editable_fields: [{ ...rentalPolicyReview.editable_fields[1], ...patch }] } });
    await expect(getNodiaAiProposalReview(proposalEvent.payload)).rejects.toThrow();
  });
  it("accepts the exact typed future supplier reference and rejects multiple bindings to the same field", async () => {
    http.get.mockResolvedValue({ data: workflowProposal });
    expect(await getNodiaAiProposal(proposalEvent.payload)).toEqual(workflowProposal);
    const dependent = workflowProposal.steps[1];
    http.get.mockResolvedValue({ data: { ...workflowProposal, steps: [workflowProposal.steps[0], { ...dependent, output_bindings: [...dependent.output_bindings, dependent.output_bindings[0]] }] } });
    await expect(getNodiaAiProposal(proposalEvent.payload)).rejects.toThrow();
    expect(http.post).not.toHaveBeenCalled();
  });
  it("accepts native integer metadata without converting it to bigint strings", async () => {
    const metadata = { ...editableReview, editable_fields: [{ ...editableReview.editable_fields[0], kind: "integer", field_key: "stock", minimum: "0", maximum: "2147483647", max_length: null }] };
    http.get.mockResolvedValue({ data: metadata });
    expect(await getNodiaAiProposalReview(proposalEvent.payload)).toEqual(metadata);
  });
  it.each([
    { kind: "number" }, { kind: "integer", minimum: "2147483648" }, { kind: "integer", maximum: "1e3" },
    { kind: "integer", maximum: "-2147483649" }, { kind: "integer", minimum: "2", maximum: "1" },
    { kind: "integer", max_length: 10 }, { kind: "integer", extra: true },
  ])("rejects incompatible or overflowing registered integer metadata %j", async fields => {
    http.get.mockResolvedValue({ data: { ...editableReview, editable_fields: [Object.assign({ ...editableReview.editable_fields[1], kind: "integer", minimum: "0", maximum: "2147483647" }, fields)] } });
    await expect(getNodiaAiProposalReview(proposalEvent.payload)).rejects.toThrow();
  });
  it.each(["cancel", "resume"] as const)("binds %s to the execution and a closed revision request", async action => {
    http.post.mockResolvedValue({ data: action === "cancel" ? { status: "already_terminal", execution } : { execution } });
    const input = { client_request_id: chatId, expected_execution_revision: 3 };
    expect(await controlNodiaAiExecution(execution.execution_id, action, input)).toEqual(execution);
    expect(http.post).toHaveBeenCalledWith(`/nodia-ai/operations/${execution.execution_id}/${action}`, input);
    http.post.mockResolvedValue({ data: action === "cancel" ? { status: "accepted", execution: { ...execution, execution_id: chatId } } : { execution: { ...execution, execution_id: chatId } } });
    await expect(controlNodiaAiExecution(execution.execution_id, action, input)).rejects.toThrow("nodia_ai:invalid_response");
  });
  it("rejects extra approval flags and invalid revisions before a control request", async () => {
    await expect(controlNodiaAiExecution(execution.execution_id, "resume", { client_request_id: chatId, expected_execution_revision: 0 })).rejects.toThrow();
    await expect(controlNodiaAiExecution(execution.execution_id, "cancel", { client_request_id: chatId, expected_execution_revision: 1, approved: true } as never)).rejects.toThrow();
    expect(http.post).not.toHaveBeenCalled();
  });
  it("preserves server pagination and large string IDs without substituting a configured model", async () => {
    http.get.mockResolvedValue({data: {items: [conversation], next_cursor: "opaque-next"}});
    const signal = new AbortController().signal;
    const result = await getNodiaAiConversations({cursor: "opaque-prev", search: "provider", is_archived: false}, signal);
    expect(http.get).toHaveBeenCalledWith("/nodia-ai/conversations", {params: {cursor: "opaque-prev", search: "provider", is_archived: false}, signal});
    expect(result.items[0].selection?.connection_id).toBe("9007199254740993");
    expect(result.next_cursor).toBe("opaque-next");
  });
  it.each([
    {...conversation, read_only: undefined},
    {...conversation, selection: {...selection, connection_id: Number("9007199254740993")}},
    {...conversation, selection: {...selection, model_id: ""}},
    {...conversation, routing: {...conversation.routing, enabled: true}},
  ])("rejects absent, incompatible and historical configuration instead of manufacturing a response", async (invalid) => {
    http.get.mockResolvedValue({data: {conversation: invalid, current_run: null, active_execution: null}});
    await expect(getNodiaAiConversation(chatId)).rejects.toThrow();
  });
  it("rejects a valid projection belonging to another requested chat", async () => {
    http.get.mockResolvedValue({data: detail});
    await expect(getNodiaAiConversation(messageId)).rejects.toThrow("nodia_ai:invalid_response");
  });
  it("retains restricted messages without accidentally exposing content", async () => {
    http.get.mockResolvedValue({data: {conversation_id: chatId, items: [{message_id: messageId, run_id: null, seq: "1", role: "assistant", status: "sealed", created_at: conversation.created_at, visibility: "restricted"}], next_cursor: null}});
    const data = await getNodiaAiMessages(chatId);
    expect(data.items[0]).not.toHaveProperty("parts");
    http.get.mockResolvedValue({data: {...data, items: [{...data.items[0], parts: [{kind: "text", text: "restricted"}]}]}});
    await expect(getNodiaAiMessages(chatId)).rejects.toThrow();
  });
  it("observes the exact instance/mode/model and keeps unavailable/unknown metadata explicit", async () => {
    const observation = {selection, available: false, reason: null, observed_at: null, supports_mcp: false, routing_target: null};
    http.get.mockResolvedValue({data: observation});
    expect(await getNodiaAiEligibility(selection)).toEqual(observation);
    expect(http.get).toHaveBeenCalledWith(`/nodia-ai/connections/${selection.connection_id}/eligibility`, {params: {mode: selection.mode, model_id: selection.model_id}, signal: undefined});
    http.get.mockResolvedValue({data: {...observation, selection: {...selection, model_id: "another-synthetic-model"}}});
    await expect(getNodiaAiEligibility(selection)).rejects.toThrow("nodia_ai:invalid_response");
  });
  it("does not infer execution availability from a catalog entry", async () => {
    const catalog = {items: [{connection_id: selection.connection_id, label: "Synthetic", provider_key: "gemini", is_active: true, modes: [{mode: selection.mode, configured_selection: null, configuration: "incomplete", authentication: "unknown", inference: "unknown", tools: "unsupported", observed_at: null, block_reason: null, models: []}]}], next_cursor: null};
    http.get.mockResolvedValue({data: catalog});
    expect(await getNodiaAiCatalog()).toEqual(catalog);
    expect(catalog.items[0]).not.toHaveProperty("available");
  });
  it("passes the same idempotency identity on explicit retry after an uncertain admission", async () => {
    const input = {client_message_id: messageId, expected_conversation_revision: 1, parts: [{kind: "text" as const, text: "Synthetic request"}]};
    http.post.mockRejectedValueOnce(new Error("network timeout"));
    await expect(admitNodiaAiMessage(chatId, input)).rejects.toThrow("network timeout");
    expect(http.post).toHaveBeenCalledTimes(1);
    http.post.mockResolvedValue({data: {message_id: messageId, conversation_revision: 2, run}});
    await admitNodiaAiMessage(chatId, input);
    expect(http.post.mock.calls[0]).toEqual(http.post.mock.calls[1]);
  });
  it("validates UTF-8 bounds before transport and never accepts incomplete routing consent", async () => {
    await expect(createNodiaAiConversation({client_request_id: messageId, title: "á".repeat(129)})).rejects.toThrow();
    await expect(setNodiaAiRouting(chatId, {expected_conversation_revision: 1, expected_routing_revision: 1, enabled: true, target: null})).rejects.toThrow();
    expect(http.post).not.toHaveBeenCalled();
    expect(http.patch).not.toHaveBeenCalled();
  });
  it("validates feed identity, checkpoints and bounded event envelopes without exposing unknown fields", async () => {
    const page = { conversation_id: chatId, items: [acceptedEvent], next_cursor: "checkpoint", cursor_state: "current", has_more: false };
    http.get.mockResolvedValue({ data: page });
    expect(await getNodiaAiEvents(run.run_id, chatId)).toEqual(page);
    expect(http.get).toHaveBeenCalledWith(`/nodia-ai/runs/${run.run_id}/events`, { params: { cursor: undefined, page_limit: 100 }, signal: undefined });
    await expect(getNodiaAiEvents(messageId, chatId)).rejects.toThrow("nodia_ai:invalid_response");
    http.get.mockResolvedValue({ data: { ...page, items: [{ ...acceptedEvent, payload: { ...acceptedEvent.payload, secret: "not allowed" } }] } });
    await expect(getNodiaAiEvents(run.run_id, chatId)).rejects.toThrow();
    http.get.mockResolvedValue({ data: { ...page, has_more: undefined } });
    await expect(getNodiaAiEvents(run.run_id, chatId)).rejects.toThrow();
  });
  it("validates observation identity and preserves zero/null instead of fabricating a total", async () => {
    http.get.mockResolvedValue({ data: observation });
    expect((await getNodiaAiObservation(toolRef)).summary).toEqual({ total: 0, returned: 0 });
    http.get.mockResolvedValue({ data: { ...observation, summary: { total: null, returned: null } } });
    expect((await getNodiaAiObservation(toolRef)).summary).toEqual({ total: null, returned: null });
    http.get.mockResolvedValue({ data: { ...observation, result_ref: { ...toolRef, contract_hash: "b".repeat(64) } } });
    await expect(getNodiaAiObservation(toolRef)).rejects.toThrow("nodia_ai:invalid_response");
    http.get.mockResolvedValue({ data: { ...observation, observed_at: "not a date" } });
    await expect(getNodiaAiObservation(toolRef)).rejects.toThrow();
  });
  it("requests the event's exact immutable proposal revision and rejects changed identity or content hash", async () => {
    http.get.mockResolvedValue({ data: proposal });
    const signal = new AbortController().signal;
    expect(await getNodiaAiProposal(proposalEvent.payload, signal)).toEqual(proposal);
    expect(http.get).toHaveBeenCalledWith(`/nodia-ai/proposals/${proposal.proposal_id}`, { params: { revision: 1 }, signal });
    for (const patch of [{ revision: 2 }, { hash: "b".repeat(64) }, { proposal_id: chatId }]) {
      http.get.mockResolvedValue({ data: { ...proposal, ...patch } });
      await expect(getNodiaAiProposal(proposalEvent.payload)).rejects.toThrow("nodia_ai:invalid_response");
    }
  });
  it("rejects untagged structured values, duplicate ordered fields, absent fields and forward dependencies", async () => {
    const step = proposal.steps[0];
    const change = step.changes[0];
    for (const changed of [
      { ...step, changes: [{ ...change, after: { arbitrary: "unregistered" } }] },
      { ...step, changes: [{ ...change, after: { kind: "object", fields: [{ field_key: "same", value: 1 }, { field_key: "same", value: 2 }] } }] },
      { ...step, changes: [{ ...change, before_present: undefined }] },
      { ...step, depends_on: [stepId] },
      { ...step, output_bindings: [{ target_field_key: "supplier", from_step_id: chatId, output_key: "id" }] },
    ]) {
      http.get.mockResolvedValue({ data: { ...proposal, steps: [changed] } });
      await expect(getNodiaAiProposal(proposalEvent.payload)).rejects.toThrow();
    }
  });
  it("accepts exact proposal references in the durable feed without accepting execution tokens", async () => {
    const page = { conversation_id: chatId, items: [proposalEvent], next_cursor: "checkpoint", cursor_state: "current", has_more: false };
    http.get.mockResolvedValue({ data: page });
    expect((await getNodiaAiEvents(run.run_id, chatId)).items[0]).toEqual(proposalEvent);
    http.get.mockResolvedValue({ data: { ...page, items: [{ ...proposalEvent, payload: { ...proposalEvent.payload, confirmation_token: "forbidden" } }] } });
    await expect(getNodiaAiEvents(run.run_id, chatId)).rejects.toThrow();
  });
  it("validates UI-only metadata against the exact proposal and rejects contradictory ownership or unregistered option shapes", async () => {
    http.get.mockResolvedValue({ data: editableReview });
    expect(await getNodiaAiProposalReview(proposalEvent.payload)).toEqual(editableReview);
    expect(http.get).toHaveBeenCalledWith(`/nodia-ai/proposals/${proposal.proposal_id}/review-metadata`, { params: { revision: 1 }, signal: undefined });
    for (const patch of [{ revision: 2 }, { hash: "b".repeat(64) }, { read_only: true }, { confirmation_token: "forbidden" }, { editable_fields: [...editableReview.editable_fields, editableReview.editable_fields[0]] }]) {
      http.get.mockResolvedValue({ data: { ...editableReview, ...patch } });
      await expect(getNodiaAiProposalReview(proposalEvent.payload)).rejects.toThrow();
    }
  });
  it("requires CAS and a new exact revision after human edits", async () => {
    const body = { expected_proposal_revision: 1, expected_hash: proposal.hash, edits: [{ step_id: stepId, field_key: "amount", value: "9007199254740993" }] };
    http.patch.mockResolvedValue({ data: { ...proposal, revision: 2, hash: "b".repeat(64) } });
    expect((await updateNodiaAiProposal(proposal.proposal_id, body)).revision).toBe(2);
    expect(http.patch).toHaveBeenCalledWith(`/nodia-ai/proposals/${proposal.proposal_id}`, body);
    http.patch.mockResolvedValue({ data: proposal });
    await expect(updateNodiaAiProposal(proposal.proposal_id, body)).rejects.toThrow("nodia_ai:invalid_response");
  });
  it("validates challenge identity and keeps confirmation payload restricted to the human endpoint", async () => {
    const challenge = { proposal_id: proposal.proposal_id, proposal_revision: 1, expected_hash: proposal.hash, confirmation_token: "A".repeat(43), expires_at: "2099-01-01T00:00:00Z" };
    http.post.mockResolvedValue({ data: challenge });
    expect(await challengeNodiaAiProposal(proposalEvent.payload)).toEqual(challenge);
    expect(http.post).toHaveBeenCalledWith(`/nodia-ai/proposals/${proposal.proposal_id}/confirmation-challenge`, { proposal_revision: 1, expected_hash: proposal.hash });
    http.post.mockResolvedValue({ data: { ...challenge, proposal_revision: 2 } });
    await expect(challengeNodiaAiProposal(proposalEvent.payload)).rejects.toThrow("nodia_ai:invalid_response");
    const input = { client_request_id: messageId, proposal_revision: 1, expected_hash: proposal.hash, confirmation_token: challenge.confirmation_token };
    http.post.mockResolvedValue({ data: { execution } });
    expect(await confirmNodiaAiProposal(proposal.proposal_id, input)).toEqual(execution);
    expect(http.post).toHaveBeenLastCalledWith(`/nodia-ai/proposals/${proposal.proposal_id}/confirm`, input);
    http.post.mockResolvedValue({ data: { execution, confirmation_token: "forbidden" } });
    await expect(confirmNodiaAiProposal(proposal.proposal_id, input)).rejects.toThrow();
  });
  it("recovers current proposals and operations through reads while rejecting mismatched IDs", async () => {
    http.get.mockResolvedValue({ data: proposal });
    expect(await getNodiaAiCurrentProposal(proposal.proposal_id)).toEqual(proposal);
    expect(http.get).toHaveBeenCalledWith(`/nodia-ai/proposals/${proposal.proposal_id}`);
    await expect(getNodiaAiCurrentProposal(chatId)).rejects.toThrow("nodia_ai:invalid_response");
    http.get.mockResolvedValue({ data: execution });
    expect(await getNodiaAiExecution(execution.execution_id)).toEqual(execution);
    await expect(getNodiaAiExecution(chatId)).rejects.toThrow("nodia_ai:invalid_response");
  });
  it.each(["short", "A".repeat(42) + "B", "A".repeat(44)])("rejects malformed or noncanonical challenge tokens before any confirm transport", async token => {
    http.post.mockResolvedValue({ data: { proposal_id: proposal.proposal_id, proposal_revision: 1, expected_hash: proposal.hash, confirmation_token: token, expires_at: "2099-01-01T00:00:00Z" } });
    await expect(challengeNodiaAiProposal(proposalEvent.payload)).rejects.toThrow();
    await expect(confirmNodiaAiProposal(proposal.proposal_id, { client_request_id: messageId, proposal_revision: 1, expected_hash: proposal.hash, confirmation_token: token })).rejects.toThrow();
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post.mock.calls[0][0]).toMatch(/confirmation-challenge$/);
  });
  it("accepts a typed active execution in conversation recovery and rejects malformed historical payloads", async () => {
    http.get.mockResolvedValue({ data: { ...detail, active_execution: execution } });
    expect((await getNodiaAiConversation(chatId)).active_execution).toEqual(execution);
    http.get.mockResolvedValue({ data: { ...detail, active_execution: { ...execution, can_resume: undefined } } });
    await expect(getNodiaAiConversation(chatId)).rejects.toThrow();
  });
});
