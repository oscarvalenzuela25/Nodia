export const RENTAL_MAX_MONEY = 9223372036854775807n;
export function isRentalMoney(
  value: unknown,
  positive = false,
): value is string {
  return (
    typeof value === "string" &&
    /^(0|[1-9]\d*)$/.test(value) &&
    BigInt(value) <= RENTAL_MAX_MONEY &&
    (!positive || BigInt(value) > 0n)
  );
}
export function formatRentalAmount(value: string, language = "es"): string {
  if (!/^-?(0|[1-9]\d*)$/.test(value)) throw new Error("rental:invalid_amount");
  return new Intl.NumberFormat(language.startsWith("es") ? "es-CL" : "en-US", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(BigInt(value));
}
export function percentBasisPoints(value: string): bigint {
  if (!/^(0|[1-9]\d?|100)(\.\d{1,2})?$/.test(value))
    throw new Error("rental:invalid_amount");
  const [whole, fraction = ""] = value.split(".");
  const points = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (points > 10000n) throw new Error("rental:invalid_amount");
  return points;
}
export function estimateRentalTotal(
  rate: string,
  nights: number,
  fee = "0",
  discount = "0",
): string {
  if (
    !isRentalMoney(rate, true) ||
    !isRentalMoney(fee) ||
    !isRentalMoney(discount) ||
    !Number.isInteger(nights) ||
    nights < 1 ||
    nights > 366
  )
    throw new Error("rental:invalid_amount");
  const total = BigInt(rate) * BigInt(nights) + BigInt(fee) - BigInt(discount);
  if (total <= 0n || total > RENTAL_MAX_MONEY)
    throw new Error("rental:invalid_amount");
  return total.toString();
}
export function suggestedDeposit(total: string, percent: string): string {
  if (!isRentalMoney(total, true)) throw new Error("rental:invalid_amount");
  return ((BigInt(total) * percentBasisPoints(percent)) / 10000n).toString();
}
