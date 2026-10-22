import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { actNodiaAiSecureFlow, getNodiaAiSecureFlow } from "../../../../modules/nodiaAi/infrastructure/secureFlow";
import { secureFlowFixture } from "./secureFlowFixtures";
import { execution } from "./proposalFixtures";
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../../../config/api", () => ({ mainInstance: http }));
beforeEach(() => vi.clearAllMocks());
describe("human-only secure flow boundary", () => {
  it("reads an opaque descriptor without entering chat or sending provider credentials", async () => {
    http.get.mockResolvedValue({ data: secureFlowFixture });
    expect(await getNodiaAiSecureFlow(execution.execution_id)).toEqual(secureFlowFixture);
    expect(http.get).toHaveBeenCalledExactlyOnceWith(`/nodia-ai/operations/${execution.execution_id}/secure-flow`, { signal: undefined });
    expect(http.post).not.toHaveBeenCalled();
  });
  it.each([
    { secret: "unexpected" }, { provider_id: 900 }, { key_id: "1e3" }, { provider_key: 1 }, { mode: "invented" }, { reference: "wrong" },
  ])("rejects an incompatible or secret-bearing descriptor %j", async patch => {
    http.get.mockResolvedValue({ data: { flow: { ...secureFlowFixture.flow, ...patch } } });
    await expect(getNodiaAiSecureFlow(execution.execution_id)).rejects.toThrow();
  });
  it("sends the secret only to its bound secure action and scrubs transport copies after success", async () => {
    const config = { data: "serialized-private-value" };
    http.post.mockResolvedValue({ data: { flow: { ...secureFlowFixture.flow, status: "completed", revision: 4 } }, config });
    const payload = { secret: "synthetic-private-value" };
    await actNodiaAiSecureFlow(execution.execution_id, secureFlowFixture.flow, "key", execution.execution_id, payload);
    expect(http.post.mock.calls[0][0]).toBe(`/nodia-ai/operations/${execution.execution_id}/secure-flow/${secureFlowFixture.flow.reference}/key`);
    expect(http.post.mock.calls[0][1]).toEqual({ expected_execution_revision: 3, client_request_id: execution.execution_id, payload: {} });
    expect(config.data).toBeUndefined();
    expect(payload.secret).toBe("synthetic-private-value"); // Form owns its retry value.
  });
  it("scrubs failed Axios request copies and prevents reflected credentials in feedback", async () => {
    const config = { headers: new AxiosHeaders(), data: "synthetic-private-value" };
    const error = new AxiosError("Rejected synthetic-private-value", "ERR_BAD_REQUEST", config, undefined,
      { config, status: 422, statusText: "Invalid", headers: {}, data: { message: "Rejected synthetic-private-value" } });
    http.post.mockRejectedValue(error);
    await expect(actNodiaAiSecureFlow(execution.execution_id, secureFlowFixture.flow, "key", execution.execution_id, { secret: "synthetic-private-value" })).rejects.toBe(error);
    expect(config.data).toBeUndefined();
    expect(JSON.stringify(error.response?.data)).not.toContain("synthetic-private-value");
    expect(error.message).not.toContain("synthetic-private-value");
  });
  it.each([{ reference: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, { provider_id: "9007199254740994" }, { key_id: "10" }, { mode: "token_plan_agentic" }, { revision: 2 }])("rejects a late response for a different binding %j", async patch => {
    http.post.mockResolvedValue({ data: { flow: { ...secureFlowFixture.flow, ...patch } }, config: {} });
    await expect(actNodiaAiSecureFlow(execution.execution_id, secureFlowFixture.flow, "status", execution.execution_id)).rejects.toThrow();
  });
});
