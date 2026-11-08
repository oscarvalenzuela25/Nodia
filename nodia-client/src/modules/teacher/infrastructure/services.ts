import { z } from "zod";
import { mainInstance } from "../../../config/api";
import { commandSchema, setupDraftReceiptSchema } from "./schemas";

export async function readTeacher<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal, params?: Record<string, unknown>): Promise<T> {
  return schema.parse(await readTeacherData(path, signal, params));
}
export async function readTeacherData(path: string, signal?: AbortSignal, params?: Record<string, unknown>): Promise<unknown> {
  const response = await mainInstance.get<unknown>(`/teacher/${path}`, { signal, params });
  return response.data;
}

export type TeacherCommand = { method: "POST" | "PATCH"; path: string; body: Record<string, unknown>; requestKey: string };
export async function sendTeacher(command: TeacherCommand) {
  const response = await mainInstance.request<unknown>({ method: command.method, url: `/teacher/${command.path}`, data: command.body, headers: { "Idempotency-Key": command.requestKey } });
  if (command.method === "POST" && command.path === "sessions" && command.body.start_plan === true) z.object({ kind: z.literal("job"), state: z.literal("queued"), session_id: z.uuid(), job_id: z.uuid() }).parse(response.data);
  if (command.method === "PATCH" && command.path.endsWith("/responses")) z.object({ attempt_id: z.string(), revision: z.number().int().positive(), responses: z.array(z.object({ question_id: z.string(), response_revision: z.number().int().positive() })).min(1) }).parse(response.data);
  if (command.method === "PATCH" && command.path.endsWith("/setup-draft")) setupDraftReceiptSchema.parse(response.data);
  return commandSchema.parse(response.data);
}

export async function readTeacherReceipt(key: string, signal?: AbortSignal) {
  return readTeacher(`requests/${key}`, z.object({ request_key: z.string(), operation: z.string(), session_id: z.string().nullable(), http_status: z.number().int(), receipt: commandSchema, completed_at: z.string() }), signal);
}
