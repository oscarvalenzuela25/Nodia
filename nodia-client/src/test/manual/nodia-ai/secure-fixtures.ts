/** Synthetic browser-only human flow. No server, provider, credential or account is used. */
import { AxiosError, type AxiosAdapter, type AxiosResponse } from "axios";
import { installFixture } from "./fixtures";
import { editableProposal, execution } from "../../modules/nodiaAi/infrastructure/proposalFixtures";
import { secureFlowFixture } from "../../modules/nodiaAi/infrastructure/secureFlowFixtures";
import type { SecureFlowResponse } from "../../../modules/nodiaAi/infrastructure/secureFlow";
import type { NodiaAiExecutionStatus, NodiaAiPublicProposal } from "../../../modules/nodiaAi/infrastructure/types";

export function installSecureFixture(scenario: string) {
  const base = installFixture("execution-queued");
  let failure: string | null = scenario === "secure-key-error" ? "key" : null;
  const login = scenario === "secure-login" || scenario === "secure-codex";
  let value: SecureFlowResponse = { flow: { ...secureFlowFixture.flow, expires_at: "2099-01-01T00:00:00Z",
    ...(login ? { kind: "connection_login", mode: "agentic", provider_key: scenario === "secure-codex" ? "openai" : "gemini" }
      : scenario === "secure-key-update" ? { kind: "api_key_update", key_id: "9007199254740994" }
      : scenario === "secure-delete" ? { kind: "api_key_delete", key_id: "9007199254740994" }
      : scenario === "secure-sync" ? { kind: "sync_models", mode: "agentic" }
      : scenario === "secure-logout" ? { kind: "codex_logout", provider_key: "openai", mode: "agentic" } : {}) } };
  let observed: NodiaAiExecutionStatus = { ...execution, revision: 3, state: "waiting_for_user", can_resume: false,
    steps: [{ ...execution.steps[0], state: "waiting_for_user", result_refs: [] }] };
  const proposal: NodiaAiPublicProposal = { ...editableProposal, state: "confirmed", execution_id: execution.execution_id, steps: [{ ...editableProposal.steps[0], kind: "secure_flow",
    tool_name: login ? "nodia_secure_flows_prepare_connection_login" : "nodia_secure_flows_prepare_api_key_create",
    target: { resource_key: "ai_providers", id: value.flow.provider_id!, label: "Conexión QA sintética / Synthetic QA connection" }, scope: {}, changes: [
      { field_key: "secure_operation", before: null, before_present: false, after: value.flow.kind, after_present: true, origin: "user" },
      { field_key: "label", before: null, before_present: false, after: "Credencial QA sintética / Synthetic QA credential", after_present: true, origin: "user" },
    ] }] };
  const adapter: AxiosAdapter = async config => {
    const path = config.url ?? "", method = (config.method ?? "get").toUpperCase();
    const response = (data: unknown, status = 200): AxiosResponse => ({ data, status, statusText: "Synthetic fixture", headers: {}, config });
    if (path.includes("/secure-flow")) {
      if (failure && method === "POST") { const reason = failure; failure = null; throw new AxiosError("Synthetic secure failure", "ERR_BAD_REQUEST", config, undefined, response({ message: "Validación segura sintética / Synthetic secure validation", reason }, 422)); }
      if (method === "GET") return response({ flow: value.flow });
      const action = path.split("/").at(-1);
      value = { ...value, flow: { ...value.flow, revision: value.flow.revision + 1 } };
      if (action === "start") {
        value.flow.status = "pending";
        value.interaction = scenario === "secure-codex" ? { kind: "codex", data: { id: execution.execution_id, state: "waiting_authorization", verificationUrl: "https://auth.openai.com/codex/device", userCode: "SYNTH-123", reason: null } }
          : { kind: "gemini_agentic", data: { id: "a".repeat(32), state: "waiting_code", reason: null,
            authorization_url: "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fantigravity.google%2Foauth-callback&response_type=code&code_challenge_method=S256&client_id=synthetic&state=synthetic&code_challenge=synthetic&scope=synthetic" } };
      }
      if (["key", "code", "delete", "sync", "logout", "cancel"].includes(action ?? "")) {
        const cancelled = action === "cancel";
        value = { flow: { ...value.flow, status: cancelled ? "cancelled" : "completed" } };
        observed = { ...observed, revision: value.flow.revision, state: cancelled ? "cancelled" : "completed", steps: [{ ...observed.steps[0], state: cancelled ? "cancelled" : "completed", result_refs: cancelled ? [] : [{ resource_key: "secure_flows", id: value.flow.reference }] }] };
      }
      return response(value);
    }
    if (path.endsWith(`/operations/${execution.execution_id}`) && method === "GET") return response(observed);
    if (path.includes(`/proposals/${editableProposal.proposal_id}`) && !path.endsWith("/review-metadata") && method === "GET") return response(proposal);
    const result = await base.adapter(config);
    if (method === "GET" && path.includes("/conversations/") && !path.endsWith("/events") && !path.endsWith("/messages")) result.data.active_execution = observed;
    return result;
  };
  return { adapter, controls: { ...base.controls, failNext: (kind: string) => { if (kind === "secure") failure = kind; else base.controls.failNext(kind); },
    completeLogin: () => { value = { flow: { ...value.flow, status: "completed" } }; } } };
}
