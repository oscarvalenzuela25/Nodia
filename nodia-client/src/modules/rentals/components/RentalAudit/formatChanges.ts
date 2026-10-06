import type { TFunction } from "i18next";
import i18n from "../../../../translate";
const states = new Set([
  "draft",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
]);
export function auditFieldLabel(key: string, t: TFunction): string {
  if (i18n.exists(`rental:audit_fields.${key}`))
    return t(`rental:audit_fields.${key}`);
  return i18n.exists(`rental:${key}`)
    ? t(`rental:${key}`)
    : t("rental:audit_field");
}
export function formatAuditValue(
  value: unknown,
  t: TFunction,
  depth = 0,
): string {
  if (depth > 10) return t("rental:redacted");
  if (value === null || value === undefined) return t("rental:not_recorded");
  if (typeof value === "boolean")
    return t(value ? "rental:boolean_true" : "rental:boolean_false");
  if (typeof value === "number") return String(value);
  if (typeof value === "string")
    return states.has(value) ? t(`rental:status_${value}`) : value;
  if (Array.isArray(value))
    return value.length
      ? value.map((item) => formatAuditValue(item, t, depth + 1)).join(" · ")
      : t("rental:none");
  if (typeof value === "object") {
    if ("redacted" in value && value.redacted === true)
      return t("rental:redacted");
    return Object.entries(value)
      .map(
        ([key, item]) =>
          `${auditFieldLabel(key, t)}: ${formatAuditValue(item, t, depth + 1)}`,
      )
      .join(" · ");
  }
  return t("rental:redacted");
}
