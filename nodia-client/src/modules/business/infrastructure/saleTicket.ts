import i18n from "../../../translate";
import { measurementUnit } from "./measurementUnits";
import { cartLinePrice, cartTotal, formatClp } from "./salesPolicies";
import { formatQuantity, lineSubtotal } from "./saleQuantities";
import { paymentMethodSchema, saleSchema } from "./salesSchemas";
import type { CartLine, PaymentMethod, Sale } from "./salesTypes";

export interface SaleTicketModel {
  title: string;
  businessName: string | null;
  saleId: string | null;
  issuedAt: string | null;
  lines: Array<{ name: string; quantity: string; unitPrice: string; subtotal: string }>;
  totalLabel: string;
  total: string;
  paymentLabel: string;
  paymentMethod: string;
  footer: string;
}

interface TicketContext { businessName?: string; language: string; showDetails?: boolean }
export interface CartTicketInput extends TicketContext {
  lines: CartLine[];
  paymentMethod: PaymentMethod;
  description?: string | null;
}
export interface SavedSaleTicketInput extends TicketContext { sale: Sale }

const businessName = (name: string | undefined): string | null => {
  if (name === undefined) return null;
  if (typeof name !== "string") throw new Error("invalid_ticket");
  return name.trim() || null;
};

function context(input: TicketContext, payment: PaymentMethod, description: string | null | undefined) {
  paymentMethodSchema.parse(payment);
  if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 500)) throw new Error("invalid_ticket");
  const t = i18n.getFixedT(input.language);
  const label = t(`business:pos.payment_${payment}`);
  const detail = description?.trim();
  return {
    t,
    common: {
      businessName: businessName(input.businessName),
      totalLabel: t("business:ticket.total_label"),
      paymentLabel: t("business:ticket.payment_label"),
      paymentMethod: detail ? `${label} (${detail})` : label,
    },
  };
}

/** A cart preview never invents a persisted sale identity or confirmation time. */
export function buildCartTicket(input: CartTicketInput): SaleTicketModel {
  const total = cartTotal(input.lines);
  const { t, common } = context(input, input.paymentMethod, input.description);
  const lines = input.lines.flatMap((line) => {
    if (typeof line.quantity !== "number" || typeof line.name !== "string") throw new Error("invalid_cart");
    const unit = measurementUnit(line.measurement_unit);
    if (line.quantity === 0) return [];
    return [{
      name: line.name,
      quantity: formatQuantity(line.quantity, input.language),
      unitPrice: t("product:price_per_unit", { price: formatClp(cartLinePrice(line), input.language), unit: t(`product:units_price.${unit}`) }),
      subtotal: formatClp(lineSubtotal(cartLinePrice(line), line.quantity), input.language),
    }];
  });
  return {
    ...common,
    title: t("business:ticket.preview_title"),
    saleId: null,
    issuedAt: null,
    lines: input.showDetails === false ? [] : lines,
    total: formatClp(total, input.language),
    footer: t("business:ticket.preview_footer"),
  };
}

/** Reprints use the confirmed snapshot, including the pre-R19 omitted-unit default. */
export function buildSavedSaleTicket(input: SavedSaleTicketInput): SaleTicketModel {
  const sale = saleSchema.parse(input.sale);
  if (sale.status !== "completed" || sale.completed_at === null) throw new Error("ticket_sale_not_completed");
  if (new Set(sale.items.map((item) => item.position)).size !== sale.items.length || new Set(sale.items.map((item) => item.product_id)).size !== sale.items.length) throw new Error("invalid_ticket");
  const { t, common } = context(input, sale.payment_method, sale.payment_method_description);
  const issued = new Date(sale.completed_at);
  if (!Number.isFinite(issued.valueOf())) throw new Error("invalid_ticket");
  const issuedAt = new Intl.DateTimeFormat(input.language.startsWith("en") ? "en-CL" : "es-CL", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(issued);
  const lines = [...sale.items].sort((a, b) => a.position - b.position).map((item) => ({
    name: item.product_name_snapshot,
    quantity: formatQuantity(item.quantity, input.language),
    unitPrice: t("product:price_per_unit", { price: formatClp(item.unit_price, input.language), unit: t(`product:units_price.${measurementUnit(item.measurement_unit_snapshot)}`) }),
    subtotal: formatClp(item.line_total, input.language),
  }));
  return {
    ...common,
    title: t("business:ticket.saved_title"),
    saleId: sale.id,
    issuedAt: `${issuedAt} · America/Santiago`,
    lines: input.showDetails === false ? [] : lines,
    total: formatClp(sale.total_amount, input.language),
    footer: t("business:ticket.saved_footer"),
  };
}
