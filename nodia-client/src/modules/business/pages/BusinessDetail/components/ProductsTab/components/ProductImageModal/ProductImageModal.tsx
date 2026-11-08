import { useEffect, useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../../../../../components/BaseModal";
import ConfirmDialog from "../../../../../../../../components/ConfirmDialog";
import { mainInstance } from "../../../../../../../../config/api";
import { apiPath } from "../../../../../../../../config/apiPath";
import { notifyHttpError } from "../../../../../../../../config/httpFeedback";
import type { ProductEntity } from "../../../../../../infrastructure/types";
import { getProduct } from "../../../../../../infrastructure/salesServices";
import ProductImageDraft from "../ProductModal/ProductImageDraft";
import { useDeferredProductSave } from "../ProductModal/hooks/useDeferredProductSave";
import type { ProductImageChange } from "../ProductModal/hooks/useDeferredProductSave";
import { validVersion } from "../ProductModal/hooks/productSaveRecovery";
import { Actions, ProductName, ReviewImage, ReviewImages } from "./styles";

interface Props { open: boolean; businessId: string; product: ProductEntity; onClose: () => void }
type Review = { product: ProductEntity; image: { url: string } | null };
const matches = (product: ProductEntity, businessId: string, id: string) => product.id === id && product.business_id === businessId && validVersion(product.version);

function ImageEditor({ open, businessId, product, onClose }: Props) {
  const { t } = useTranslation(["business", "core"]);
  const client = useQueryClient();
  const saving = useDeferredProductSave({ businessId, initialProduct: product });
  const [change, setChange] = useState<ProductImageChange>({ kind: "keep" });
  const [imageFetching, setImageFetching] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const busy = saving.busy || imageFetching || reviewBusy;
  const pending = Boolean(saving.pendingIntent || saving.phase === "image_pending" || saving.phase === "image_conflict");
  const close = () => { if (!busy) { saving.cancel(); onClose(); } };
  const submit = async () => {
    if (busy || saving.phase === "fields_unknown") return;
    try { await saving.saveImage(change); onClose(); } catch { /* The hook reports the error; keep the draft. */ }
  };
  const inspect = async () => {
    if (busy) return;
    setReviewBusy(true);
    try {
      const current = await getProduct(product.id);
      if (!matches(current, businessId, product.id)) throw new Error(t("business:pos.invalid_field"));
      const url = apiPath(`/businesses/${encodeURIComponent(businessId)}/products/${encodeURIComponent(product.id)}/image`);
      const image = (await mainInstance.get<{ url: string } | null>(url)).data;
      client.setQueryData(["product-image", businessId, product.id, url], image);
      setReview({ product: current, image });
    } catch (error) { notifyHttpError(error); } finally { setReviewBusy(false); }
  };
  return <BaseModal open={open} onClose={close} size="lg" title={t("business:pos.image_preview_title")} actions={<Actions>
    <Button disabled={busy} onClick={close}>{t("core:close")}</Button>
    <Button variant="contained" disabled={busy || saving.phase === "fields_unknown" || (change.kind === "keep" && !pending)} onClick={() => void submit()}>{t("business:pos.image_save_changes")}</Button>
  </Actions>}>
    <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
      <ProductName>{(saving.savedProduct ?? product).name}</ProductName>
      {saving.phase === "fields_unknown" && <Alert severity="warning">{t("business:pos.product_save_unknown")}</Alert>}
      {pending && <Alert severity="warning" action={<Button disabled={busy} onClick={() => void saving.reconcile().catch(() => undefined)}>{t("business:pos.reconcile")}</Button>}>{t(saving.phase === "image_conflict" ? "business:pos.image_review_before_retry" : "business:pos.image_pending")}</Alert>}
      <ProductImageDraft businessId={businessId} productId={product.id} value={change} onChange={setChange} disabled={saving.busy || reviewBusy} onBusyChange={setImageFetching} variant="viewer" />
      {saving.phase === "image_conflict" && <Button disabled={busy} onClick={() => void inspect()}>{t("business:pos.inspect_product")}</Button>}
    </Box>
    <ConfirmDialog open={Boolean(review)} size="lg" title={t("business:pos.image_apply_review")} message={t("business:pos.image_only_review")} isLoading={busy}
      onClose={() => { if (!busy) setReview(null); }} onConfirm={() => {
        if (!review || busy) return;
        try { saving.adoptReviewed(review.product); setReview(null); } catch (error) { notifyHttpError(error); }
      }}>
      {review && <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
        <Typography sx={{ overflowWrap: "anywhere", fontWeight: 600 }}>{review.product.name}</Typography>
        <ReviewImages>
          <Box><Typography sx={{ mb: 1 }}>{t("business:pos.saved_value")}</Typography><ReviewImage>{review.image?.url ? <img src={review.image.url} alt={t("business:pos.image_current")} /> : <Typography>{t("business:pos.no_image")}</Typography>}</ReviewImage></Box>
          <Box><Typography sx={{ mb: 1 }}>{t("business:pos.my_changes")}</Typography><ProductImageDraft businessId={businessId} productId={product.id} value={change} onChange={() => undefined} disabled /></Box>
        </ReviewImages>
      </Box>}
    </ConfirmDialog>
  </BaseModal>;
}

export default function ProductImageModal({ open, businessId, product, onClose }: Props) {
  const { t } = useTranslation(["business", "core"]);
  const instance = useId();
  const query = useQuery({
    queryKey: ["product-image-editor", businessId, product.id, instance],
    enabled: open, gcTime: 0, retry: false, refetchOnWindowFocus: false,
    queryFn: async () => {
      const fresh = await getProduct(product.id);
      if (!matches(fresh, businessId, product.id)) throw new Error(t("business:pos.invalid_field"));
      return fresh;
    },
  });
  useEffect(() => { if (query.error) notifyHttpError(query.error); }, [query.error]);
  if (query.data) return <ImageEditor open={open} businessId={businessId} product={query.data} onClose={onClose} />;
  return <BaseModal open={open} onClose={() => { if (!query.isFetching) onClose(); }} size="lg" title={t("business:pos.image_preview_title")}
    actions={<Actions><Button disabled={query.isFetching} onClick={onClose}>{t("core:close")}</Button></Actions>}>
    <ProductName>{product.name}</ProductName>
    {query.isError ? <Alert severity="error" action={<Button disabled={query.isFetching} onClick={() => void query.refetch()}>{t("core:retry")}</Button>}>{t("business:pos.image_product_error")}</Alert> : <Skeleton loading={query.isLoading}><Box sx={{ minHeight: 320 }}><Typography>{t("core:loading")}</Typography></Box></Skeleton>}
  </BaseModal>;
}
