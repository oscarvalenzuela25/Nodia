import { POS_PAYMENT_METHODS, type PaymentMethod, type PosPaymentMethod, type SalePayment } from "./salesTypes";

export function manualPaymentMethod(method: PaymentMethod): PosPaymentMethod | null {
  if (method === "credit_card" || method === "debit_card") return "card";
  return method === "other" ? null : method;
}

export function positivePaymentAmount(raw: string): string | null {
  if (!/^\d{1,19}$/.test(raw)) return null;
  const amount = BigInt(raw);
  return amount > 0n ? String(amount) : null;
}

export function splitPaymentDraft(methods: readonly PosPaymentMethod[], values: Record<PosPaymentMethod, string>, total: string) {
  const entries = methods.flatMap((payment_method) => {
    const amount = positivePaymentAmount(values[payment_method]);
    return amount === null ? [] : [{ payment_method, amount }];
  });
  const remaining = BigInt(total) - entries.reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
  const valid = entries.length === methods.length && remaining === 0n && entries.length >= 2 && entries.length <= POS_PAYMENT_METHODS.length;
  return { remaining, payments: valid ? entries : null };
}

export function matchesSplitPayment(payments: readonly SalePayment[], selected: readonly PosPaymentMethod[], total: string): boolean {
  return payments.length === selected.length && selected.length >= 2 && selected.length <= POS_PAYMENT_METHODS.length
    && new Set(selected).size === selected.length
    && selected.every((method) => payments.filter(({ payment_method }) => payment_method === method).length === 1)
    && payments.every(({ amount }) => positivePaymentAmount(amount) === amount)
    && payments.reduce((sum, { amount }) => sum + BigInt(amount), 0n) === BigInt(total);
}
