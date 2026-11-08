import type { ProductEntity } from "../../../../../../../infrastructure/types";
import type { ProductFormData } from "../ProductModal";

export type ProductSaveTarget = { id: string; version: number };
export type ProductImageChange = { kind: "keep" } | { kind: "replace"; file: File } | { kind: "remove" };
export type ProductSavePhase = "idle" | "saving_fields" | "reserving_image" | "uploading_image" | "completing_image" | "removing_image" | "reconciling" | "image_pending" | "image_conflict" | "fields_unknown";
export interface ProductImageIntent {
  id: string;
  status: string;
  product_id?: string;
  is_current?: boolean;
  product_version?: number | null;
}
export interface PendingProductImage extends ProductImageIntent {
  expectedVersion: number;
  fingerprint: string | null;
  contentAttempted: boolean;
  needsReview?: boolean;
}
export interface ProductSaveJournal {
  schema: 1;
  actorId: string;
  businessId: string;
  originProductId: string | null;
  product: ProductEntity | null;
  fieldsFingerprint: string | null;
  fieldsUnknown: boolean;
  image: PendingProductImage | null;
  removal: { expectedVersion: number } | null;
  appliedImage: string | null;
}
export const productSaveKey = (actorId: string, businessId: string, productId: string | null) =>
  `nodia:product-image-recovery:${actorId}:${businessId}:${productId ?? "new"}`;
export const validVersion = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
export const fieldsFingerprint = (data: ProductFormData): string => JSON.stringify([
  data.code, data.name, data.barcode, data.measurement_unit, data.cost_price, data.cost_price_tax,
  data.sale_price, data.offer_price, data.is_offer_enabled,
  data.has_stock, data.provider_id || null, data.is_active,
]);
const localFiles = new WeakMap<File, string>();
export const imageFingerprint = (change: ProductImageChange): string | null => {
  if (change.kind === "keep") return null;
  if (change.kind === "remove") return "remove";
  // A replacement File with equal metadata is still a new user selection. The
  // token survives rerenders, while a reopened editor must reconcile its old
  // intention before a newly selected File can be uploaded.
  let identity = localFiles.get(change.file);
  if (!identity) { identity = crypto.randomUUID(); localFiles.set(change.file, identity); }
  return identity;
};
export const emptyJournal = (actorId: string, businessId: string, product: ProductEntity | null): ProductSaveJournal => ({
  schema: 1, actorId, businessId, originProductId: product?.id ?? null, product,
  fieldsFingerprint: null, fieldsUnknown: false, image: null, removal: null, appliedImage: null,
});
export function readProductSaveJournal(actorId: string, businessId: string, initialProduct: ProductEntity | null): ProductSaveJournal {
  const initial = emptyJournal(actorId, businessId, initialProduct);
  const raw = sessionStorage.getItem(productSaveKey(actorId, businessId, initialProduct?.id ?? null));
  if (!raw) return initial;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("invalid_product_save_journal");
  // An earlier image editor used this exact actor/business/product-scoped key.
  // Its content may already have been sent, so recovery must never repeat PUT.
  if (!("schema" in value) && "id" in value && typeof value.id === "string" && initialProduct) {
    const legacy = value as { id: string; status?: string; reserved_product_version?: number };
    const version = legacy.reserved_product_version;
    if (!validVersion(version)) throw new Error("invalid_product_save_journal");
    return { ...initial, image: { id: legacy.id, status: legacy.status ?? "pending", expectedVersion: version, fingerprint: null, contentAttempted: true } };
  }
  const entry = value as ProductSaveJournal;
  if (entry.schema !== 1 || entry.actorId !== actorId || entry.businessId !== businessId || entry.originProductId !== (initialProduct?.id ?? null) ||
      typeof entry.fieldsUnknown !== "boolean" || (entry.fieldsFingerprint !== null && typeof entry.fieldsFingerprint !== "string") ||
      (entry.product !== null && (!entry.product || entry.product.business_id !== businessId || typeof entry.product.id !== "string" || !validVersion(entry.product.version))) ||
      (entry.image !== null && (!entry.image || typeof entry.image.id !== "string" || !validVersion(entry.image.expectedVersion) || typeof entry.image.contentAttempted !== "boolean")) ||
      (entry.removal !== null && (!entry.removal || !validVersion(entry.removal.expectedVersion)))) throw new Error("invalid_product_save_journal");
  // The earlier journal included an auxiliary percentage at position six.
  // Discard only that retired slot; preserve all remaining fields and unknown
  // outcome/image gates so reopening cannot replay a confirmed field save.
  if (entry.fieldsFingerprint !== null) {
    try {
      const fields: unknown = JSON.parse(entry.fieldsFingerprint);
      if (Array.isArray(fields) && fields.length === 13 && typeof fields[6] === "number" && Number.isInteger(fields[6]) && fields[6] >= 0) {
        fields.splice(6, 1);
        return { ...entry, fieldsFingerprint: JSON.stringify(fields) };
      }
    } catch { /* An opaque historical fingerprint cannot be treated as equal. */ }
  }
  return entry;
}
