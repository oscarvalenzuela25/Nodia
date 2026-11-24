import { isAxiosError } from "axios";
import { sileo } from "sileo";
import { claimHttpErrorNotification, getHttpErrorMessage, notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import { CvPdfIntegrityError } from "./pdfVersions";
import { profileAccessDenied } from "./profiles";

const binaryErrors = new Set([
  "nodiaCv:pdf_not_found", "nodiaCv:version_not_found", "nodiaCv:generation_not_found",
  "nodiaCv:generation_expired", "nodiaCv:stale_draft", "nodiaCv:pdf_stale",
  "nodiaCv:pdf_busy", "nodiaCv:pdf_timeout", "nodiaCv:pdf_limits", "nodiaCv:pdf_render_failed",
  "nodiaCv:pdf_read_failed", "nodiaCv:pdf_no_text", "nodiaCv:pdf_text_mismatch", "nodiaCv:pdf_layout_invalid",
]);

function localMessage(error: unknown) {
  if (error instanceof CvPdfIntegrityError) return i18n.t("nodiaCv:pdf_integrity_failed");
  if (!isAxiosError<unknown>(error)) return null;
  const data = error.response?.data;
  const content = error.response?.headers["content-type"];
  if (!(data instanceof ArrayBuffer) || data.byteLength > 4096 || typeof content !== "string" ||
    content.split(";")[0]?.trim().toLowerCase() !== "application/json") return null;
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(data));
    if (body && typeof body === "object" && "message" in body && typeof body.message === "string" && binaryErrors.has(body.message))
      return i18n.t(body.message);
  } catch {
    // Invalid or unrelated error bodies use the normal HTTP fallback.
  }
  return null;
}

export function cvPdfErrorMessage(error: unknown) {
  return localMessage(error) ?? getHttpErrorMessage(error);
}

export function notifyCvPdfError(error: unknown, onDenial: () => void) {
  if (profileAccessDenied(error)) onDenial();
  const message = localMessage(error);
  if (message) {
    if (claimHttpErrorNotification(error)) sileo.error({ title: i18n.t("core:server_error_toast"), description: message });
  } else notifyHttpError(error);
}
