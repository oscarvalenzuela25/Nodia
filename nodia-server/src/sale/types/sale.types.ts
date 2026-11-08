import type { ActorReference } from '../../authorization/authority-transaction.js';
import type { ProductMeasurementUnit } from '../../product/product-measurement-unit.js';

export const SALE_STATUSES = [
  'draft',
  'completed',
  'cancelled',
  'discarded',
] as const;
export const SALE_PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'debit_card',
  'credit_card',
  'other',
] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];
export type SalePaymentMethod = (typeof SALE_PAYMENT_METHODS)[number];
export type SaleOperation =
  'create' | 'checkout' | 'update' | 'complete' | 'cancel' | 'discard';
export type SaleActor = ActorReference;
export interface SaleItemInput {
  product_id: string;
  quantity: number;
  expected_product_version: number;
  expected_unit_price: string;
  unit_price_override?: string | null;
}
export interface SaleMutationCommand {
  request_key: string;
  sale_id?: string;
  expected_version?: number;
  items?: SaleItemInput[];
  payment_method?: SalePaymentMethod;
  payment_method_description?: string | null;
  cancellation_reason?: string;
}
export interface SaleItemView {
  id: string;
  product_id: string;
  position: number;
  quantity: number;
  product_code_snapshot: string | null;
  measurement_unit_snapshot: ProductMeasurementUnit;
  product_barcode_snapshot: string | null;
  product_name_snapshot: string;
  regular_unit_price: string;
  offer_price_snapshot: string | null;
  is_offer_enabled_snapshot: boolean;
  price_source: 'regular' | 'offer' | 'manual';
  unit_price: string;
  line_total: string;
  product_version: number;
}
export interface SaleItemSnapshot extends SaleItemView {
  cost_price_snapshot: string | null;
  cost_price_tax_snapshot: string | null;
}
export interface SaleView {
  id: string;
  business_id: string;
  status: SaleStatus;
  currency: 'CLP';
  payment_method: SalePaymentMethod;
  payment_method_description: string | null;
  total_amount: string;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  items: SaleItemView[];
}
export interface SaleListQuery {
  page?: number;
  limit?: number;
  status?: SaleStatus;
  from?: string;
  to_exclusive?: string;
  search?: string;
  metric?: 'units' | 'amount';
}
export interface ProductSaleRow {
  id: string;
  business_id: string;
  code: string | null;
  measurement_unit: ProductMeasurementUnit;
  barcode: string | null;
  name: string;
  sale_price: string | number;
  offer_price: string | number | null;
  is_offer_enabled: boolean;
  cost_price: string | number | null;
  cost_price_tax: string | number | null;
  version: number;
  is_active: boolean;
  has_stock: boolean | null;
}
