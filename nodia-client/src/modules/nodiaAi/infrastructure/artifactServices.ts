import { isAxiosError } from "axios";
import { mainInstance } from "../../../config/api";
import { ARTIFACT_MAX_BYTES, artifactRefSchema, artifactResponseMetadata } from "./artifactSchemas";
import type { NodiaAiArtifactRef } from "./artifactSchemas";

/** Human intent only. The server binds this UUID to the authorized completed tool call. */
export async function downloadNodiaAiArtifact(reference: NodiaAiArtifactRef, signal: AbortSignal) {
  const ref = artifactRefSchema.parse(reference);
  signal.throwIfAborted();
  const limit = new AbortController();
  try {
    const response = await mainInstance.get<unknown>(`/nodia-ai/artifacts/${encodeURIComponent(ref.tool_call_id)}`, {
      responseType: "blob", signal: AbortSignal.any([signal, limit.signal]),
      headers: { Accept: "text/csv, application/pdf, image/png, image/jpeg, image/webp" },
      // Browser XHR ignores Axios maxContentLength. Progress abort is best effort; the server bounds materialization and R2 reads.
      onDownloadProgress: progress => { if (progress.loaded > ARTIFACT_MAX_BYTES || (progress.total ?? 0) > ARTIFACT_MAX_BYTES) limit.abort(); },
    });
    signal.throwIfAborted();
    if (limit.signal.aborted) throw new Error("nodia_ai:artifact_limit");
    if (!(response.data instanceof Blob) || response.data.size === 0) throw new Error("nodia_ai:invalid_response");
    if (response.data.size > ARTIFACT_MAX_BYTES) throw new Error("nodia_ai:artifact_limit");
    const metadata = artifactResponseMetadata(ref.tool_name, response.headers["content-disposition"], response.headers["content-type"]);
    return { blob: response.data, ...metadata };
  } catch (error) {
    signal.throwIfAborted();
    if (limit.signal.aborted) throw new Error("nodia_ai:artifact_limit", { cause: error });
    // Axios also decodes JSON failures as Blob. Preserve only the bounded server message for the shared toast policy.
    if (isAxiosError<unknown, unknown>(error) && error.response?.data instanceof Blob && error.response.data.size <= 16 * 1024 && error.response.data.type.includes("json")) {
      try {
        const body: unknown = JSON.parse(await error.response.data.text());
        const message = body && typeof body === "object" && "message" in body ? body.message : undefined;
        if (typeof message === "string" && message.length <= 2048) error.response.data = { message };
      } catch { /* A malformed failure body uses the shared localized fallback. */ }
    }
    throw error;
  }
}
