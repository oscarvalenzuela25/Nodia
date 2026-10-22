import { describe, expect, it } from "vitest";
import { AxiosHeaders } from "axios";
import { installSecureFixture } from "../../../manual/nodia-ai/secure-fixtures";
import { nodiaAiDetailSchema, nodiaAiExecutionSchema } from "../../../../modules/nodiaAi/infrastructure/schemas";
import { execution } from "./proposalFixtures";
import { CHAT_ID } from "../../../manual/nodia-ai/fixtures";
import { secureFlowFixture } from "./secureFlowFixtures";
describe("synthetic secure browser harness", () => {
  it("keeps conversation and execution contracts valid after the synthetic key receipt", async () => {
    const fixture = installSecureFixture("secure-key");
    const call = (url: string, method = "get") => fixture.adapter({ url, method, headers: new AxiosHeaders() });
    expect(nodiaAiDetailSchema.safeParse((await call(`/nodia-ai/conversations/${CHAT_ID}`)).data).success).toBe(true);
    await call(`/nodia-ai/operations/${execution.execution_id}/secure-flow/${secureFlowFixture.flow.reference}/key`, "post");
    nodiaAiExecutionSchema.parse((await call(`/nodia-ai/operations/${execution.execution_id}`)).data);
    nodiaAiDetailSchema.parse((await call(`/nodia-ai/conversations/${CHAT_ID}`)).data);
  });
});
