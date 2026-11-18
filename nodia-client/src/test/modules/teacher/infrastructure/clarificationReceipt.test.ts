import { expect, it } from "vitest";
import { validateClarificationReceipt } from "../../../../modules/teacher/infrastructure/clarificationReceipt";
import type { TeacherCommand } from "../../../../modules/teacher/infrastructure/services";

const session = "11111111-1111-4111-8111-111111111111";
const thread = "22222222-2222-4222-8222-222222222222";
const job = "33333333-3333-4333-8333-333333333333";
const command: TeacherCommand = { path: `sessions/${session}/enrichment/commands`, method: "POST", requestKey: "original",
  body: { operation: "thread_message", payload: { thread_id: thread, text: "Fixture question" } } };

it("requires the exact clarification receipt before clearing the original request", () => {
  const receipt = { kind: "job", session_id: session, revision: 7, job_id: job, thread_id: thread };
  expect(validateClarificationReceipt(command, receipt)).toBe(receipt);
  expect(() => validateClarificationReceipt(command, { session_id: session })).toThrow();
  expect(() => validateClarificationReceipt(command, { ...receipt, thread_id: job })).toThrow();
  expect(() => validateClarificationReceipt(command, { ...receipt, session_id: job })).toThrow();
  const create = { ...command, body: { operation: "thread_create" } };
  expect(() => validateClarificationReceipt(create, { kind: "clarification", session_id: session, resource_id: thread })).toThrow();
});
