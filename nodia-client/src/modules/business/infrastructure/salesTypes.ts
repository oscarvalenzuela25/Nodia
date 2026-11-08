import type { MeasurementUnit } from "./measurementUnits";
export type PaymentMethod = "cash" | "bank_transfer" | "debit_card" | "credit_card" | "other";
export type SaleStatus = "draft" | "completed" | "cancelled" | "discarded";
export type SaleSection = "pos" | "sales" | "reports";
export interface SaleItem {
  id: string; product_id: string; position: number; quantity: number;
  product_code_snapshot: string | null; product_barcode_snapshot: string | null; product_name_snapshot: string; measurement_unit_snapshot?: MeasurementUnit;
  regular_unit_price: string; offer_price_snapshot: string | null; is_offer_enabled_snapshot: boolean;
  price_source: "regular" | "offer" | "manual"; unit_price: string; line_total: string; product_version: number;
}
export interface Sale {
  id: string; business_id: string; status: SaleStatus; currency: "CLP";
  payment_method: PaymentMethod; payment_method_description: string | null; total_amount: string;
  version: number; created_at: string; updated_at: string; completed_at: string | null;
  cancelled_at: string | null; cancellation_reason: string | null; items: SaleItem[];
}
export interface SaleLineCommand { product_id: string; quantity: number; expected_product_version: number; expected_unit_price: string; unit_price_override?: string | null }
export interface SaleCommand {
  request_key: string; expected_version?: number; items?: SaleLineCommand[];
  payment_method?: PaymentMethod; payment_method_description?: string | null; cancellation_reason?: string;
}
export type SaleOperation = "create" | "update" | "checkout" | "complete" | "cancel" | "discard";
export interface SaleMutation { operation: SaleOperation; saleId?: string; command: SaleCommand }
export interface SaleReceipt { status: "completed" | "unconfirmed"; sale?: Sale; result_version?: number }
export interface SalesParams { page?: number; limit?: number; status?: SaleStatus; search?: string; from?: string; to_exclusive?: string }
export interface SalesResponse { data: Sale[]; meta: { total: number; page: number; limit: number; total_pages: number } }
export interface SalesSummary {
  currency: "CLP"; timezone: "America/Santiago"; sales_count: string; total_amount: string; units_sold: string;
  average_ticket: { numerator: string; denominator: string } | null;
  quantity_by_unit?: { measurement_unit: MeasurementUnit; quantity: string }[];
}
export interface TopProducts {
  data: { product_id: string; code: string | null; name: string; units_sold: string; total_amount: string; measurement_unit?: MeasurementUnit }[];
  currency: "CLP"; timezone: "America/Santiago"; metric: "units" | "amount";
}
export interface CartLine extends SaleLineCommand {
  name: string; code: string | null; barcode: string | null; regular_price: string; offer_price: string | null; measurement_unit?: MeasurementUnit;
  price_source: "regular" | "offer";
}
