import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import type { ProductEntity } from "./types";
import type { Sale, SaleMutation, SaleReceipt, SalesParams, SalesResponse, SalesSummary, TopProducts } from "./salesTypes";
import { saleReceiptSchema, saleSchema, salesResponseSchema, summarySchema, topProductsSchema } from "./salesSchemas";

const base = (businessId: string) => apiPath(`/businesses/${encodeURIComponent(businessId)}`);
export const getProduct = async (id: string): Promise<ProductEntity> => (await mainInstance.get<ProductEntity>(apiPath(`/products/${encodeURIComponent(id)}`))).data;
export const getProductByBarcode = async (businessId: string, barcode: string): Promise<ProductEntity> =>
  (await mainInstance.get<ProductEntity>(apiPath("/products/by-barcode"), { params: { business_id: businessId, barcode } })).data;
export const getSales = async (businessId: string, params: SalesParams): Promise<SalesResponse> => salesResponseSchema.parse((await mainInstance.get<unknown>(`${base(businessId)}/sales`, { params })).data);
export const getSale = async (businessId: string, id: string): Promise<Sale> => saleSchema.parse((await mainInstance.get<unknown>(`${base(businessId)}/sales/${encodeURIComponent(id)}`)).data);
export const mutateSale = async (businessId: string, mutation: SaleMutation): Promise<Sale> => {
  if (mutation.operation === "checkout") return saleSchema.parse((await mainInstance.post<unknown>(`${base(businessId)}/sales/checkout`, mutation.command)).data);
  const url = `${base(businessId)}/sales${mutation.saleId ? `/${encodeURIComponent(mutation.saleId)}` : ""}`;
  if (mutation.operation === "create") return saleSchema.parse((await mainInstance.post<unknown>(url, mutation.command)).data);
  if (mutation.operation === "update") return saleSchema.parse((await mainInstance.put<unknown>(url, mutation.command)).data);
  if (mutation.operation === "discard") return saleSchema.parse((await mainInstance.delete<unknown>(url, { data: mutation.command })).data);
  return saleSchema.parse((await mainInstance.post<unknown>(`${url}/${mutation.operation}`, mutation.command)).data);
};
export const getSaleReceipt = async (businessId: string, key: string): Promise<SaleReceipt> => saleReceiptSchema.parse((await mainInstance.get<unknown>(`${base(businessId)}/sale-mutation-requests/${encodeURIComponent(key)}`)).data);
export const getSalesSummary = async (businessId: string, params: Pick<SalesParams, "from" | "to_exclusive">): Promise<SalesSummary> =>
  summarySchema.parse((await mainInstance.get<unknown>(`${base(businessId)}/sales/reports/summary`, { params })).data);
export const getTopProducts = async (businessId: string, params: Pick<SalesParams, "from" | "to_exclusive"> & { metric: "units" | "amount"; limit: number }): Promise<TopProducts> =>
  topProductsSchema.parse((await mainInstance.get<unknown>(`${base(businessId)}/sales/reports/top-products`, { params })).data);
