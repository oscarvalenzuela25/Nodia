import type { SecureFlowResponse } from "../../../../modules/nodiaAi/infrastructure/secureFlow";
/** Synthetic human-only descriptor; never a real account or credential. */
export const secureFlowFixture: SecureFlowResponse = { flow: {
  reference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", kind: "api_key_create", provider_id: "9007199254740993", provider_key: "gemini",
  key_id: null, mode: "api_key", expires_at: "2026-10-17T23:00:00Z", status: "waiting", revision: 3,
} };
