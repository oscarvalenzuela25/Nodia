import type { GetProductsResponse, ProductEntity } from "../../../../../../../../../../modules/business/infrastructure/types";
import type { InvoiceProvisionalRow } from "../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/helpers";

export const product = (id = "17", businessId = "business-a", version = 8): ProductEntity => ({
  id, business_id: businessId, version, code: `CAT-${id}`, name: `Synthetic snapshot ${id}`,
  cost_price: 1000, cost_price_tax: 1190, sale_price: 3000, stock: 0, has_stock: false,
  is_active: true, measurement_unit: "kg", barcode: "000123", offer_price: 3500, is_offer_enabled: true,
});
export const page = (data: ProductEntity[], current = 1, total = 1): GetProductsResponse => ({
  data, meta: { page: current, limit: 25, total_items: total === 1 ? data.length : 26, total_pages: total },
});
export const invoiceRow = (overrides: Partial<InvoiceProvisionalRow> = {}): InvoiceProvisionalRow => ({
  code: "INV-17", invoice_code: "INV-17", name: "Synthetic invoice item", cost_price: 2000, cost_price_tax: 2380,
  sale_price: Number.NaN, quantity: 2, is_active: true, isUpdate: false, errors: [], isValid: false, ...overrides,
});
export const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
