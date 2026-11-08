import { z } from "zod";
import type { TeacherCommand } from "./services";

const key = "teacher:pending-request:v1";
const metadataSchema = z.object({ actorScope: z.string().min(1).max(256), requestKey: z.uuid(), path: z.string().min(1).max(2048), method: z.enum(["POST", "PATCH"]) }).strict();

/** Tab-scoped opaque recovery metadata only: never answers, prompts or request bodies. */
export function rememberRequest(actorScope: string, command: TeacherCommand): void {
  try { window.sessionStorage.setItem(key, JSON.stringify({ actorScope, requestKey: command.requestKey, path: command.path, method: command.method })); } catch { /* In-memory reconciliation remains available when storage is denied. */ }
}
export function forgetRequest(): void {
  try { window.sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
}
export function pendingRequest(actorScope: string): TeacherCommand | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = metadataSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.actorScope !== actorScope) { forgetRequest(); return null; }
    const { requestKey, path, method } = parsed.data;
    return { requestKey, path, method, body: {} };
  } catch { forgetRequest(); return null; }
}
