import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import { mainInstance } from "../../../../config/api";
import { apiPath } from "../../../../config/apiPath";
import { notifyHttpError } from "../../../../config/httpFeedback";
import { ImageFrame } from "./styles";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import useAuth from "../../../../hooks/useAuth";
import axios from "axios";
import { getProduct } from "../../infrastructure/salesServices";

type ImageMetadata = { id: string; url: string; mime_type: string; width: number; height: number; byte_size: number; product_version: number };
type Intent = { id: string; status: string; product_version?: number; reserved_product_version?: number };
interface Props { businessId: string; productId: string; version?: number; editable?: boolean; disabled?: boolean; onVersion?: (version: number) => void; onBusyChange?: (busy: boolean) => void }
export default function ProductImage({ businessId, productId, version, editable = false, disabled = false, onVersion, onBusyChange }: Props) {
  const { t } = useTranslation("business");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const storageKey = `nodia:product-image-recovery:${user?.id}:${businessId}:${productId}`;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(() => {
    try { const raw = sessionStorage.getItem(storageKey); return raw ? JSON.parse(raw) as Intent : null; } catch { return null; }
  });
  const remember = (value: Intent | null) => { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); setIntent(value); };
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [reviewVersion, setReviewVersion] = useState<number | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const base = apiPath(`/businesses/${encodeURIComponent(businessId)}`);
  const url = `${base}/products/${encodeURIComponent(productId)}/image`;
  const queryKey = ["product-image", businessId, productId, url];
  const image = useQuery({ queryKey, queryFn: async () => (await mainInstance.get<ImageMetadata | null>(url)).data, retry: false });
  useEffect(() => { onBusyChange?.(busy || image.isFetching); }, [busy, image.isFetching, onBusyChange]);
  const invalidate = async (next?: number) => {
    if (next) onVersion?.(next);
    await Promise.all([queryClient.invalidateQueries({ queryKey }), queryClient.invalidateQueries({ queryKey: ["products"] })]);
  };
  const upload = async (file: File) => {
    if (busy || !version || intent) return;
    setBusy(true);
    let stage: "reserve" | "content" | "complete" = "reserve";
    try {
      const key = crypto.randomUUID();
      // The key is chosen and stored before reserve, so even a lost reservation response can be read back.
      remember({ id: key, status: "pending", reserved_product_version: version });
      const reserved = (await mainInstance.post<Intent>(`${base}/product-image-uploads`, { request_key: key, product_id: productId, expected_product_version: version })).data;
      remember({ ...reserved, reserved_product_version: version });
      stage = "content";
      const data = new FormData(); data.append("file", file);
      await mainInstance.put(`${base}/product-image-uploads/${reserved.id}/content`, data);
      stage = "complete";
      const completed = (await mainInstance.post<Intent>(`${base}/product-image-uploads/${reserved.id}/complete`, { expected_product_version: version })).data;
      remember(null); await invalidate(completed.product_version);
      sileo.success({ title: t("pos.image_saved") });
    } catch (error) {
      if (stage === "reserve" && axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500) remember(null);
      if (stage === "complete" && axios.isAxiosError(error) && error.response?.status === 409) {
        try { setReviewVersion((await getProduct(productId)).version ?? null); } catch (readError) { notifyHttpError(readError); }
      }
      notifyHttpError(error);
    }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const recover = async () => {
    if (!intent || busy) return;
    setBusy(true);
    try {
      const status = (await mainInstance.get<Intent>(`${base}/product-image-uploads/${intent.id}`)).data;
      if (status.status === "ready") {
        const complete = (await mainInstance.post<Intent>(`${base}/product-image-uploads/${intent.id}/complete`, { expected_product_version: intent.reserved_product_version })).data;
        remember(null); await invalidate(complete.product_version); sileo.success({ title: t("pos.image_saved") });
      } else if (["failed", "deleted", "pending_delete"].includes(status.status)) { remember(null); sileo.info({ title: t("pos.image_retry") }); }
      else sileo.info({ title: t("pos.unconfirmed") });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        try { setReviewVersion((await getProduct(productId)).version ?? null); } catch (readError) { notifyHttpError(readError); }
      }
      notifyHttpError(error);
    } finally { setBusy(false); }
  };
  const applyReviewed = async () => {
    if (!intent || !reviewVersion || busy) return;
    setBusy(true);
    try {
      remember({ ...intent, reserved_product_version: reviewVersion });
      const completed = (await mainInstance.post<Intent>(`${base}/product-image-uploads/${intent.id}/complete`, { expected_product_version: reviewVersion })).data;
      remember(null); setReviewVersion(null); await invalidate(completed.product_version); sileo.success({ title: t("pos.image_saved") });
    } catch (error) { notifyHttpError(error); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy || !version) return;
    setBusy(true);
    try {
      const result = (await mainInstance.delete<{ product_version: number }>(url, { data: { expected_product_version: version } })).data;
      await invalidate(result.product_version); setRemoveConfirm(false); sileo.success({ title: t("pos.image_removed") });
    } catch (error) { notifyHttpError(error); } finally { setBusy(false); }
  };
  return <Box sx={{ display: "grid", gap: 1 }}>
    <ImageFrame>{image.data?.url && failedUrl !== image.data.url ? <img src={image.data.url} alt={t("pos.product_image")} loading="lazy" onError={() => setFailedUrl(image.data!.url)} /> : image.isLoading ? <CircularProgress size={20} /> : <span>{t("pos.no_image")}</span>}</ImageFrame>
    {(image.isError || Boolean(image.data?.url && failedUrl === image.data.url)) && <Alert severity="error" action={<Button onClick={() => { setFailedUrl(null); void image.refetch(); }} disabled={busy}>{t("pos.retry")}</Button>}>{t("pos.image_error")}</Alert>}
    {editable && <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      <Button disabled={disabled || busy || image.isFetching || !version || Boolean(intent)} onClick={() => input.current?.click()}>{t("pos.image_upload")}</Button>
      {image.data && <Button color="error" disabled={disabled || busy || image.isFetching || !version || Boolean(intent)} onClick={() => setRemoveConfirm(true)}>{t("pos.image_remove")}</Button>}
      {busy && <CircularProgress size={20} />}
      {intent && <Alert severity="warning" action={<Button disabled={busy} onClick={() => void recover()}>{t("pos.reconcile")}</Button>}>{t("pos.image_pending")}</Alert>}
    </Box>}
    <ConfirmDialog open={removeConfirm} onClose={() => { if (!busy) setRemoveConfirm(false); }} onConfirm={remove} isLoading={busy} title={t("pos.image_remove")} message={t("pos.image_remove_confirm")} />
    <ConfirmDialog open={reviewVersion !== null} onClose={() => { if (!busy) setReviewVersion(null); }} onConfirm={applyReviewed} isLoading={busy} title={t("pos.image_apply_review")} message={t("pos.image_apply_explanation")} />
  </Box>;
}
