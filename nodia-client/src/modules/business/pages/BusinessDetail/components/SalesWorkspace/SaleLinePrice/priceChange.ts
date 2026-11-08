import type { CartLine } from "../../../../../infrastructure/salesTypes";
import type { ProductEntity, UpdateProductPayload } from "../../../../../infrastructure/types";
import { moneyInteger, productToCartLine } from "../../../../../infrastructure/salesPolicies";
import { PRODUCT_PRICE_MAX } from "../../ProductsTab/components/ProductModal/productPricing";

export function permanentSalePricePatch(product: ProductEntity, line: CartLine, value: string): UpdateProductPayload {
  if (product.id !== line.product_id || product.version !== line.expected_product_version) throw new Error("price_changed");
  const current = productToCartLine(product);
  if (current.expected_unit_price !== line.expected_unit_price || current.measurement_unit !== (line.measurement_unit ?? "unit")) throw new Error("price_changed");
  const canonical = moneyInteger(value);
  if (canonical === null || BigInt(canonical) > BigInt(PRODUCT_PRICE_MAX)) throw new Error("invalid_price");
  return { sale_price: Number(canonical), is_offer_enabled: false, expected_version: product.version };
}
