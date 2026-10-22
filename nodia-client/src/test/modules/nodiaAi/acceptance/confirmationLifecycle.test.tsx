import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import ProposalPreview from "../../../../modules/nodiaAi/components/ProposalPreview";
import { mainInstance } from "../../../../config/api";
import useAuthStore from "../../../../store/authStore";
import { nodiaAiKeys } from "../../../../modules/nodiaAi/infrastructure/useServices";
import type { NodiaAiExecutionStatus, NodiaAiPublicProposal } from "../../../../modules/nodiaAi/infrastructure/types";
import { chatId, detail } from "../infrastructure/fixtures";
import { workflowProposal, workflowReview, partialWorkflow, dependentStepId } from "../infrastructure/workflowFixtures";
import i18n from "../../../../translate";

// AI-36 acceptance transport is synthetic and closed: real components, services,
// schemas and query coordinators; no provider, SQL or external HTTP is invoked.
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
type Request = { method: string; url: string; body: Record<string, unknown>; params: Record<string, unknown> };
const originalAdapter = mainInstance.defaults.adapter;
const path = `/nodia-ai/proposals/${workflowProposal.proposal_id}`;
const operationPath = `/nodia-ai/operations/${partialWorkflow.execution_id}`;
const secretChallenge = "A".repeat(43);
let client: QueryClient;
let current: NodiaAiPublicProposal;
let execution: NodiaAiExecutionStatus;
let requests: Request[];
let invalidConfirmation: boolean;
let denied: boolean;
let confirmBarrier: Promise<void> | undefined;
let finishConfirmation: (() => void) | undefined;
function response(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: "OK", headers: new AxiosHeaders() };
}
function reject(config: InternalAxiosRequestConfig): never {
  throw new AxiosError("Synthetic access revoked", "ERR_BAD_REQUEST", config, undefined,
    { ...response(config, { message: "Synthetic access revoked" }), status: 403 });
}
const text = (key: string) => i18n.t(`nodiaAi:${key}`);
function open() {
  return render(<QueryClientProvider client={client}><MemoryRouter><ProposalPreview conversationId={chatId}
    proposalRef={{ proposal_id: current.proposal_id, revision: 1, hash: workflowProposal.hash }} />
  </MemoryRouter></QueryClientProvider>);
}
async function readyConfirmation(revision = current.revision) {
  const button = await screen.findByRole("button", { name: i18n.t("nodiaAi:proposal.confirm_exact", { revision }) });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}
function writes() { return requests.filter(request => request.method !== "get"); }
beforeEach(() => {
  vi.clearAllMocks();
  current = structuredClone(workflowProposal); execution = structuredClone(partialWorkflow);
  requests = []; invalidConfirmation = false; denied = false; confirmBarrier = undefined; finishConfirmation = undefined;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useAuthStore.setState({ user: { id: "9", name: "Synthetic owner" }, token: "synthetic-only", expiresAt: Date.now() + 600000,
    sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false });
  client.setQueryData(nodiaAiKeys.detail(["9", 1], chatId), structuredClone(detail));
  mainInstance.defaults.adapter = async config => {
    const method = config.method ?? "get", url = config.url ?? "";
    const body = typeof config.data === "string" ? JSON.parse(config.data) as Record<string, unknown> : {};
    requests.push({ method, url, body, params: config.params ?? {} });
    if (denied) return reject(config);
    if (method === "get" && url === path) return response(config, current);
    if (method === "get" && url === `${path}/review-metadata`) return response(config, { ...workflowReview,
      revision: current.revision, hash: current.hash,
      editable_fields: workflowReview.editable_fields.map((field, index) => ({ ...field, step_id: current.steps[index].step_id })),
      confirmation: { available: true, reason: null } });
    if (method === "get" && url === operationPath) return response(config, execution);
    if (method === "patch" && url === path) {
      const edits = body.edits as { step_id: string; field_key: string; value: string }[];
      const remap = new Map(current.steps.map((step, index) => [step.step_id, `99999999-9999-4999-8999-${String(index + 1).padStart(12, "0")}`]));
      current = { ...current, revision: current.revision + 1, hash: "b".repeat(64), steps: current.steps.map(step => ({ ...step,
        step_id: remap.get(step.step_id)!, depends_on: step.depends_on.map(id => remap.get(id)!),
        output_bindings: step.output_bindings.map(binding => ({ ...binding, from_step_id: remap.get(binding.from_step_id)! })),
        changes: step.changes.map(change => ({ ...change, after: edits.find(edit => edit.step_id === step.step_id && edit.field_key === change.field_key)?.value ?? change.after })) })) };
      execution = { ...execution, steps: execution.steps.map(step => ({ ...step, step_id: remap.get(step.step_id)! })) };
      return response(config, current);
    }
    if (method === "post" && url === `${path}/confirmation-challenge`) return response(config, {
      proposal_id: current.proposal_id, proposal_revision: current.revision, expected_hash: current.hash,
      confirmation_token: secretChallenge, expires_at: "2099-01-01T00:00:00Z",
    });
    if (method === "post" && url === `${path}/confirm`) {
      await confirmBarrier;
      current = { ...current, state: "confirmed", execution_id: execution.execution_id };
      return response(config, invalidConfirmation ? { execution: { ...execution, execution_id: "invalid" } } : { execution });
    }
    if (method === "post" && url === `${operationPath}/resume`) {
      execution = { ...execution, revision: execution.revision + 1, state: "completed", can_resume: false,
        steps: execution.steps.map(step => step.step_id === current.steps[1].step_id ? { ...step, state: "completed", error: null,
          result_refs: [{ resource_key: "provider_contacts", id: "9007199254740994" }] } : step) };
      return response(config, { execution });
    }
    throw new Error(`Undeclared AI-36 synthetic HTTP ${method} ${url}`);
  };
});
afterEach(() => {
  client.clear(); mainInstance.defaults.adapter = originalAdapter;
  useAuthStore.setState({ token: null, user: null, sessionStatus: "anonymous" });
});

describe("AI-36 real React/HTTP confirmation lifecycle with synthetic transport", () => {
  it("revises a dependent contact, confirms the displayed immutable revision and resumes only after showing the committed supplier receipt", async () => {
    const user = userEvent.setup(); open(); await readyConfirmation();
    expect(writes()).toEqual([]);
    await user.click(screen.getByRole("button", { name: text("proposal.edit") }));
    const names = screen.getAllByRole("textbox", { name: /Nombre/ });
    fireEvent.change(names[1], { target: { value: "[QA] Reviewed contact" } });
    await user.click(screen.getByRole("button", { name: text("proposal.save_revision") }));
    const confirm = await readyConfirmation(2);
    expect(writes()).toHaveLength(1);
    expect(writes()[0]).toMatchObject({ method: "patch", url: path, body: {
      expected_proposal_revision: 1, expected_hash: workflowProposal.hash,
      edits: [{ step_id: dependentStepId, field_key: "name", value: "[QA] Reviewed contact" }],
    } });
    expect(screen.getByText("[QA] Reviewed contact")).toBeInTheDocument();
    await user.dblClick(confirm);
    await screen.findByText(text("execution.partial_effects"));
    expect(screen.getByText(/9007199254740993/)).toBeInTheDocument();
    const confirmationWrites = writes().filter(request => request.url.endsWith("/confirm"));
    expect(confirmationWrites).toHaveLength(1);
    expect(confirmationWrites[0].body).toEqual({ client_request_id: expect.any(String), proposal_revision: 2,
      expected_hash: "b".repeat(64), confirmation_token: secretChallenge });
    expect(writes().filter(request => request.url.endsWith("/confirmation-challenge"))).toHaveLength(1);
    expect(JSON.stringify(client.getQueryCache().getAll().map(query => query.state.data))).not.toContain(secretChallenge);
    const resume = await screen.findByRole("button", { name: text("execution.resume") });
    await waitFor(() => expect(resume).toBeEnabled()); await user.click(resume);
    await screen.findByText(/9007199254740994/);
    expect(screen.getByText(/9007199254740993/)).toBeInTheDocument();
    expect(writes().map(request => request.url)).toEqual([path, `${path}/confirmation-challenge`, `${path}/confirm`, `${operationPath}/resume`]);
    expect(writes().at(-1)?.body).toEqual({ client_request_id: expect.any(String), expected_execution_revision: 3 });
    expect(screen.queryByRole("button", { name: text("execution.resume") })).not.toBeInTheDocument();
  });

  it.each(["es", "en"])("reconciles a malformed successful confirmation response through GETs without issuing a second write (%s)", async language => {
    await i18n.changeLanguage(language); invalidConfirmation = true;
    const user = userEvent.setup(); open(); await user.click(await readyConfirmation());
    const recover = await screen.findByRole("button", { name: text("proposal.recover") });
    expect(writes()).toHaveLength(2); expect(sileo.error).toHaveBeenCalledOnce();
    expect(screen.queryByText(/9007199254740993/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: i18n.t("nodiaAi:proposal.confirm_exact", { revision: 1 }) })).toBeDisabled();
    const before = requests.length; await user.click(recover);
    await screen.findByText(text("execution.partial_effects"));
    expect(requests.slice(before).every(request => request.method === "get")).toBe(true);
    expect(requests.slice(before).some(request => request.url === path && !request.params.revision)).toBe(true);
    expect(requests.slice(before).some(request => request.url === operationPath)).toBe(true);
    expect(writes()).toHaveLength(2);
    expect(screen.queryByRole("button", { name: text("proposal.recover") })).not.toBeInTheDocument();
    expect(JSON.stringify(client.getQueryCache().getAll().map(query => query.state.data))).not.toContain(secretChallenge);
  });

  it("retires a previous session's pending confirmation and denies its private proposal without adopting its late receipt", async () => {
    confirmBarrier = new Promise(resolve => { finishConfirmation = resolve; });
    const user = userEvent.setup(); open(); await user.click(await readyConfirmation());
    await waitFor(() => expect(writes().filter(request => request.url.endsWith("/confirm"))).toHaveLength(1));
    const successesBeforeSwitch = vi.mocked(sileo.success).mock.calls.length;
    denied = true;
    act(() => useAuthStore.setState({ user: { id: "10", name: "Synthetic other actor" }, sessionVersion: 2 }));
    await screen.findByText(text("proposal.restricted"));
    expect(screen.queryByText("[QA] Synthetic supplier")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: i18n.t("nodiaAi:proposal.confirm_exact", { revision: 1 }) })).not.toBeInTheDocument();
    await act(async () => { finishConfirmation?.(); await confirmBarrier; });
    await waitFor(() => expect(sileo.success).toHaveBeenCalledTimes(successesBeforeSwitch));
    expect(requests.filter(request => request.url === operationPath)).toEqual([]);
    expect(writes()).toHaveLength(2);
    const newActorData = client.getQueryCache().getAll().filter(query => query.queryKey[1] === "10").map(query => query.state.data);
    expect(JSON.stringify(newActorData)).not.toContain("9007199254740993");
    expect(JSON.stringify(newActorData)).not.toContain(secretChallenge);
  });

  it("removes an observed partial execution's receipts after access revocation and prevents resuming from stale authority", async () => {
    const user = userEvent.setup(); open(); await user.click(await readyConfirmation());
    await screen.findByText(text("execution.partial_effects"));
    expect(screen.getByText(/9007199254740993/)).toBeInTheDocument();
    const resume = screen.getByRole("button", { name: text("execution.resume") });
    await waitFor(() => expect(resume).toBeEnabled());
    denied = true;
    await user.click(screen.getByRole("button", { name: text("refresh_status") }));
    await screen.findByText(text("execution.load_error"));
    expect(screen.queryByText(/9007199254740993/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text("execution.resume") })).not.toBeInTheDocument();
    expect(writes().map(request => request.url)).toEqual([`${path}/confirmation-challenge`, `${path}/confirm`]);
    expect(sileo.error).toHaveBeenCalledOnce();
  });
});
