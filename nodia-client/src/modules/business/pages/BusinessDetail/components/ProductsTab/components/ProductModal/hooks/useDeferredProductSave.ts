import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { sileo } from "sileo";
import { mainInstance } from "../../../../../../../../../config/api";
import { apiPath } from "../../../../../../../../../config/apiPath";
import { notifyHttpError } from "../../../../../../../../../config/httpFeedback";
import useAuthStore from "../../../../../../../../../store/authStore";
import i18n from "../../../../../../../../../translate";
import { getProduct } from "../../../../../../../infrastructure/salesServices";
import type { ProductEntity } from "../../../../../../../infrastructure/types";
import type { ProductFormData } from "../ProductModal";
import {
  emptyJournal, fieldsFingerprint, imageFingerprint, productSaveKey, readProductSaveJournal, validVersion,
  type PendingProductImage, type ProductImageChange, type ProductImageIntent, type ProductSaveJournal, type ProductSavePhase, type ProductSaveTarget,
} from "./productSaveRecovery";

export type { ProductImageChange, ProductSaveTarget, ProductSavePhase } from "./productSaveRecovery";
interface Options {
  businessId: string;
  initialProduct?: ProductEntity | null;
  persistFields?: (data: ProductFormData, target?: ProductSaveTarget) => Promise<ProductEntity>;
}
const knownRejection = (error: unknown) => axios.isAxiosError(error) && Boolean(error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 408);
const conflict = (error: unknown) => axios.isAxiosError(error) && error.response?.status === 409;
const contentRejectedBeforeClaim = (error: unknown) => axios.isAxiosError<{ message?: unknown }>(error) &&
  ((error.response?.status === 400 && error.response.data.message === "product:image_invalid") ||
   (error.response?.status === 503 && error.response.data.message === "product:image_busy"));

/** Fields have no request receipt; image content is sent at most once per durable intent. */
export function useDeferredProductSave({ businessId, initialProduct = null, persistFields }: Options) {
  const actorId = useAuthStore((state) => state.user?.id ?? "");
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const queryClient = useQueryClient();
  const key = productSaveKey(actorId, businessId, initialProduct?.id ?? null);
  const scopeKey = `${key}:${sessionVersion}`;
  const [restored] = useState(() => {
    try { return { journal: readProductSaveJournal(actorId, businessId, initialProduct), failed: false }; }
    catch { return { journal: emptyJournal(actorId, businessId, initialProduct), failed: true }; }
  });
  const journal = useRef(restored.journal);
  const storageBlocked = useRef(restored.failed);
  const [savedProduct, setSavedProduct] = useState(restored.journal.product);
  const [pendingIntent, setPendingIntent] = useState(restored.journal.image);
  const [phase, setPhase] = useState<ProductSavePhase>(restored.journal.fieldsUnknown ? "fields_unknown" : restored.journal.image || restored.journal.removal ? "image_pending" : "idle");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const fieldsError = useRef<unknown>(null);
  const scope = useRef<string | null>(scopeKey);
  useEffect(() => { scope.current = scopeKey; return () => { scope.current = null; }; }, [scopeKey]);
  const sameScope = () => scope.current === scopeKey && useAuthStore.getState().user?.id === actorId && useAuthStore.getState().sessionVersion === sessionVersion && journal.current.actorId === actorId && journal.current.businessId === businessId;
  const ensureScope = () => { if (!actorId || !sameScope()) throw new Error(i18n.t("business:pos.unconfirmed")); };
  const unconfirmed = () => new Error(i18n.t("business:pos.unconfirmed"));
  const store = (next: ProductSaveJournal) => {
    ensureScope();
    // Update memory first: even if storage becomes unavailable, a committed product
    // must never fall back to the original create branch in this mounted editor.
    journal.current = next;
    setSavedProduct(next.product); setPendingIntent(next.image);
    try {
      // Signed preview URLs are short-lived capabilities, never recovery data.
      const persisted = { ...next, product: next.product ? { ...next.product, image: undefined, provider: undefined, previous_price_snapshot: undefined } : null };
      sessionStorage.setItem(key, JSON.stringify(persisted)); storageBlocked.current = false;
    }
    catch { storageBlocked.current = true; throw new Error(i18n.t("business:pos.storage_error")); }
  };
  const assertWritable = () => {
    ensureScope();
    if (storageBlocked.current) throw new Error(i18n.t("business:pos.storage_error"));
    if (journal.current.fieldsUnknown) { setPhase("fields_unknown"); throw unconfirmed(); }
  };
  const product = () => {
    const value = journal.current.product;
    if (!value || value.business_id !== businessId || !validVersion(value.version)) throw unconfirmed();
    return value as ProductEntity & { version: number };
  };
  const base = apiPath(`/businesses/${encodeURIComponent(businessId)}`);
  const intentUrl = (id: string) => `${base}/product-image-uploads/${encodeURIComponent(id)}`;
  const observeIntent = (intent: PendingProductImage, data: ProductImageIntent): PendingProductImage => {
    if (!data || data.id !== intent.id || !["pending", "uploading", "ready", "failed", "deleted", "pending_delete"].includes(data.status) ||
        typeof data.is_current !== "boolean" || (data.product_id !== undefined && data.product_id !== product().id) ||
        (data.product_version !== undefined && data.product_version !== null && !validVersion(data.product_version))) throw unconfirmed();
    // Remote metadata cannot reset our durable at-most-once content marker.
    return { ...intent, status: data.status, is_current: data.is_current, product_id: data.product_id, product_version: data.product_version };
  };
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["product-image", businessId] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["business"] }),
    ]);
  };
  const acceptImage = async (receipt: ProductImageIntent, intent: PendingProductImage) => {
    observeIntent(intent, receipt);
    if (!receipt.is_current || receipt.product_version !== intent.expectedVersion + 1) throw unconfirmed();
    store({ ...journal.current, product: { ...product(), version: receipt.product_version }, image: null, appliedImage: intent.fingerprint });
    setPhase("idle"); await invalidate();
    if (sameScope()) sileo.success({ title: i18n.t("business:pos.image_saved") });
  };
  const complete = async (intent: PendingProductImage) => {
    ensureScope(); setPhase("completing_image");
    try {
      const { data } = await mainInstance.post<ProductImageIntent>(`${intentUrl(intent.id)}/complete`, { expected_product_version: intent.expectedVersion });
      ensureScope(); await acceptImage(data, intent);
    } catch (error) {
      if (sameScope()) {
        if (conflict(error)) { store({ ...journal.current, image: { ...intent, needsReview: true } }); setPhase("image_conflict"); }
        else setPhase("image_pending");
      }
      throw error;
    }
  };
  const readIntent = async () => {
    const intent = journal.current.image;
    if (!intent) return null;
    const { data } = await mainInstance.get<ProductImageIntent>(intentUrl(intent.id));
    ensureScope();
    const observed = observeIntent(intent, data);
    store({ ...journal.current, image: observed });
    if (data.is_current) { await acceptImage(data, observed); return null; }
    if (["failed", "deleted", "pending_delete"].includes(data.status)) {
      store({ ...journal.current, image: null }); setPhase("idle");
      sileo.info({ title: i18n.t("business:pos.image_retry") });
      return null;
    }
    return observed;
  };
  const upload = async (intent: PendingProductImage, file: File) => {
    if (intent.contentAttempted) throw unconfirmed();
    const attempted = { ...intent, contentAttempted: true };
    store({ ...journal.current, image: attempted }); setPhase("uploading_image");
    const body = new FormData(); body.append("file", file);
    let response: ProductImageIntent;
    try { response = (await mainInstance.put<ProductImageIntent>(`${intentUrl(intent.id)}/content`, body)).data; }
    catch (error) {
      if (sameScope()) {
        // These two backend rejections occur during normalization, before the
        // pending→uploading claim or any object-store request. A new intention
        // is safe; every uncertain outcome keeps its original identity.
        if (contentRejectedBeforeClaim(error)) { store({ ...journal.current, image: null }); setPhase("idle"); }
        else setPhase("image_pending");
      }
      throw error;
    }
    ensureScope();
    const ready = observeIntent(attempted, response);
    store({ ...journal.current, image: ready });
    if (ready.status !== "ready") throw unconfirmed();
    await complete(ready);
  };
  const recoverImage = async (change?: ProductImageChange) => {
    const before = journal.current.image;
    if (!before) return;
    const changedFile = change && before.fingerprint !== null && imageFingerprint(change) !== before.fingerprint;
    if (changedFile && before.contentAttempted) { setPhase("image_pending"); throw unconfirmed(); }
    const observed = await readIntent();
    if (!observed) return;
    if (observed.needsReview) { setPhase("image_conflict"); throw unconfirmed(); }
    if (observed.status === "ready") {
      if (changedFile) { setPhase("image_pending"); throw unconfirmed(); }
      await complete(observed); return;
    }
    if (observed.status === "pending" && !observed.contentAttempted && change?.kind === "replace") {
      const selected = { ...observed, fingerprint: imageFingerprint(change) };
      store({ ...journal.current, image: selected });
      await upload(selected, change.file); return;
    }
    setPhase("image_pending"); throw unconfirmed();
  };
  const reconcileRemoval = async () => {
    const removal = journal.current.removal;
    if (!removal) return;
    const current = product();
    const [image, latest] = await Promise.all([
      mainInstance.get<unknown>(`${base}/products/${encodeURIComponent(current.id)}/image`), getProduct(current.id),
    ]);
    ensureScope();
    if (image.data !== null || latest.business_id !== businessId || latest.version !== removal.expectedVersion + 1) { setPhase("image_pending"); throw unconfirmed(); }
    store({ ...journal.current, product: { ...current, version: latest.version, image: null }, removal: null, appliedImage: "remove" });
    setPhase("idle"); await invalidate();
    if (sameScope()) sileo.success({ title: i18n.t("business:pos.image_removed") });
  };
  const run = async <T,>(operation: () => Promise<T>, notify = true): Promise<T> => {
    if (locked.current) throw unconfirmed();
    ensureScope(); locked.current = true; fieldsError.current = null; setBusy(true);
    try { return await operation(); }
    catch (error) {
      if (sameScope()) {
        if (journal.current.fieldsUnknown) setPhase("fields_unknown");
        else if (journal.current.image || journal.current.removal) setPhase(journal.current.image?.needsReview ? "image_conflict" : "image_pending");
        // ProductsTab's field mutation already owns its translated error toast.
        if (notify && fieldsError.current !== error) notifyHttpError(error);
      }
      throw error;
    }
    finally { locked.current = false; if (sameScope()) setBusy(false); }
  };
  const recoverPending = async (change: ProductImageChange) => {
    if (journal.current.image) { setPhase("reconciling"); await recoverImage(change); }
    if (journal.current.removal) { setPhase("reconciling"); await reconcileRemoval(); }
  };
  const persistImage = async (change: ProductImageChange) => {
    const signature = imageFingerprint(change);
    if (change.kind === "replace" && journal.current.appliedImage !== signature) {
      const current = product();
      const intent: PendingProductImage = { id: crypto.randomUUID(), status: "pending", expectedVersion: current.version, fingerprint: signature, contentAttempted: false };
      store({ ...journal.current, image: intent }); setPhase("reserving_image");
      try {
        const { data: reservation } = await mainInstance.post<ProductImageIntent>(`${base}/product-image-uploads`, { request_key: intent.id, product_id: current.id, expected_product_version: current.version });
        ensureScope();
        const reserved = observeIntent(intent, reservation);
        store({ ...journal.current, image: reserved });
        await upload(reserved, change.file);
      } catch (error) {
        if (sameScope() && journal.current.image && !journal.current.image.contentAttempted && knownRejection(error)) { store({ ...journal.current, image: null }); setPhase(conflict(error) ? "image_conflict" : "idle"); }
        else if (sameScope() && journal.current.image && !journal.current.image.needsReview) setPhase("image_pending");
        throw error;
      }
    } else if (change.kind === "remove" && journal.current.appliedImage !== signature) {
      const current = product();
      store({ ...journal.current, removal: { expectedVersion: current.version } }); setPhase("removing_image");
      try {
        const { data: receipt } = await mainInstance.delete<{ removed: boolean; product_version: number }>(`${base}/products/${encodeURIComponent(current.id)}/image`, { data: { expected_product_version: current.version } });
        ensureScope();
        if (!validVersion(receipt.product_version) || receipt.product_version !== current.version + (receipt.removed ? 1 : 0)) throw unconfirmed();
        store({ ...journal.current, product: { ...current, version: receipt.product_version, image: null }, removal: null, appliedImage: "remove" });
        await invalidate(); if (sameScope()) sileo.success({ title: i18n.t("business:pos.image_removed") });
      } catch (error) {
        if (sameScope() && knownRejection(error)) { store({ ...journal.current, removal: null }); setPhase(conflict(error) ? "image_conflict" : "idle"); }
        else if (sameScope()) setPhase("image_pending");
        throw error;
      }
    }
  };
  const finish = (): ProductEntity => {
    ensureScope();
    const result = product();
    sessionStorage.removeItem(key); setPhase("idle");
    return result;
  };
  const save = (data: ProductFormData, change: ProductImageChange): Promise<ProductEntity> => run(async () => {
    assertWritable();
    if (!persistFields) throw unconfirmed();
    await recoverPending(change);
    const fingerprint = fieldsFingerprint(data);
    if (journal.current.fieldsFingerprint !== fingerprint) {
      const existing = journal.current.product;
      const version = existing?.version;
      if (existing && !validVersion(version)) throw unconfirmed();
      store({ ...journal.current, fieldsUnknown: true }); setPhase("saving_fields");
      let result: ProductEntity;
      try { result = await persistFields(data, existing ? { id: existing.id, version: version! } : undefined); }
      catch (error) {
        fieldsError.current = error;
        if (sameScope()) {
          if (knownRejection(error)) { store({ ...journal.current, fieldsUnknown: false }); setPhase("idle"); }
          else setPhase("fields_unknown");
        }
        throw error;
      }
      ensureScope();
      if (!result || result.business_id !== businessId || !result.id || !validVersion(result.version) || (existing && result.id !== existing.id)) { setPhase("fields_unknown"); throw unconfirmed(); }
      store({ ...journal.current, product: result, fieldsFingerprint: fingerprint, fieldsUnknown: false });
    }
    await persistImage(change);
    return finish();
  });
  const saveImage = (change: ProductImageChange): Promise<ProductEntity> => run(async () => {
    assertWritable();
    product(); // An existing, versioned product is mandatory; this path never creates one.
    await recoverPending(change);
    await persistImage(change);
    return finish();
  });
  const reconcile = (): Promise<ProductEntity | null> => run(async () => {
    ensureScope();
    if (storageBlocked.current) throw new Error(i18n.t("business:pos.storage_error"));
    setPhase("reconciling");
    if (journal.current.fieldsUnknown) {
      // GET can show the current product for human review; without a mutation
      // receipt it cannot establish that an unacknowledged write committed.
      if (journal.current.product) await getProduct(journal.current.product.id);
      ensureScope(); setPhase("fields_unknown"); throw unconfirmed();
    }
    await recoverImage(); await reconcileRemoval();
    return journal.current.product;
  });
  const adoptReviewed = (reviewed: ProductEntity) => {
    if (locked.current || !sameScope() || !journal.current.product || reviewed.id !== journal.current.product.id || reviewed.business_id !== businessId || !validVersion(reviewed.version) || journal.current.fieldsUnknown || journal.current.removal ||
        (journal.current.image && !journal.current.image.needsReview)) throw unconfirmed();
    const image = journal.current.image;
    store({ ...journal.current, product: reviewed, fieldsFingerprint: null, image: image ? { ...image, expectedVersion: reviewed.version, needsReview: false } : null });
    setPhase(image ? "image_pending" : "idle");
  };
  const cancel = () => {
    // Cancellation never mutates the image. A completed, known partial save may
    // be left in the catalogue; unresolved writes keep their recovery identity.
    if (!locked.current && sameScope() && !journal.current.fieldsUnknown && !journal.current.image && !journal.current.removal) {
      try { sessionStorage.removeItem(key); } catch (error) { notifyHttpError(error); }
    }
  };
  return { save, saveImage, busy, savedProduct, phase, pendingIntent, reconcile, adoptReviewed, cancel };
}
