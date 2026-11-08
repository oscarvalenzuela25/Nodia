import { getProducts } from "../../../../../../../../infrastructure/services";
import { canBindInvoiceProduct } from "../../helpers";

export const findMatchProducts = (businessId: string, search: string, page: number) => getProducts({ page, limit: 25, q: { business_id_eq: businessId, name_cont: search || undefined, s: "name asc" } });

export async function readMatchProduct(businessId: string, id: string) {
  const response = await getProducts({ page: 1, limit: 1, q: { business_id_eq: businessId, id_in: [id] } });
  const product = response.data.find(item => item.id === id);
  if (!product || !canBindInvoiceProduct(product, businessId)) throw new Error("invoice_match_product_unavailable");
  return product;
}
