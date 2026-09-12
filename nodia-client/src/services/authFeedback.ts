import { isAxiosError } from "axios";
import { sileo } from "sileo";
import i18n from "../translate";

export function notifyAuthError(error: unknown, fallback = "auth:request_failed") {
  const message: unknown = isAxiosError(error) ? error.response?.data?.message : undefined;
  const description = typeof message === "string"
    ? (i18n.exists(message) ? i18n.t(message) : message)
    : i18n.t(fallback);
  sileo.error({ title: i18n.t("auth:error_title"), description });
}
