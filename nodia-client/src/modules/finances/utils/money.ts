export const FINANCE_MAX_AMOUNT = 9223372036854775807n;

export function isFinanceAmount(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= FINANCE_MAX_AMOUNT
  );
}

export function formatFinanceAmount(value: string, language = "es"): string {
  if (!/^-?\d+$/.test(value)) throw new Error("finance:invalid_amount");
  return new Intl.NumberFormat(language.startsWith("es") ? "es-CL" : "en-US", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(BigInt(value));
}
