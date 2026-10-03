import { isAxiosError, isCancel } from "axios";
import { isCancelledError } from "@tanstack/react-query";
import { sileo } from "sileo";
import i18n from "../translate";

const notifiedErrors = new WeakSet<object>();

export const getHttpErrorMessage = (error: unknown): string => {
  const message: unknown = isAxiosError(error) ? error.response?.data?.message : undefined;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    const messages = message.filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
    if (messages.length) return messages.join(". ");
  }
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
  sileo.error({ title: i18n.t("core:server_error_toast"), description: getHttpErrorMessage(error) });
};
