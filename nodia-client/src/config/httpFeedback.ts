import { isAxiosError, isCancel } from "axios";
import { isCancelledError } from "@tanstack/react-query";
import { sileo } from "sileo";
import i18n from "../translate";
import { getConnectionIssue, offlineRequestCode } from "../pwa/connectionMonitor";

const notifiedErrors = new WeakSet<object>();
const translatedServerMessage = (message: string): string => i18n.exists(message) ? String(i18n.t(message)) : message;

export const getHttpErrorMessage = (error: unknown): string => {
  if (isAxiosError(error) && error.code === offlineRequestCode) return i18n.t("core:connection_offline_save");
  const message: unknown = isAxiosError(error) ? error.response?.data?.message : undefined;
  if (typeof message === "string" && message.trim()) return translatedServerMessage(message);
  if (Array.isArray(message)) {
    const messages = message.filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
    if (messages.length) return messages.map(translatedServerMessage).join(". ");
  }
  if (getConnectionIssue(error) === "offline") return i18n.t("core:connection_offline_description");
  return i18n.t("core:server_error_toast");
};

export const claimHttpErrorNotification = (error: unknown): boolean => {
  if (isCancel(error) || isCancelledError(error)) return false;
  if (error && typeof error === "object") {
    if (notifiedErrors.has(error)) return false;
    notifiedErrors.add(error);
  }
  return true;
};

export const notifyHttpError = (error: unknown): void => {
  if (!claimHttpErrorNotification(error)) return;
  const offline = getConnectionIssue(error) === "offline";
  sileo.error({ title: i18n.t(offline ? "core:connection_offline_title" : "core:server_error_toast"), description: getHttpErrorMessage(error) });
};
