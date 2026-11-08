import { useEffect, useId, useRef, useState } from "react";
import { Alert, Box, Button, ButtonBase, Tooltip, Typography } from "@mui/material";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import { Skeleton } from "boneyard-js/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { mainInstance } from "../../../../../../../../../config/api";
import { apiPath } from "../../../../../../../../../config/apiPath";
import { notifyHttpError } from "../../../../../../../../../config/httpFeedback";
import type { ProductImageChange } from "../hooks/useDeferredProductSave";
import { ImageArea, ImagePicker, RemoveImageButton } from "./styles";

type ImageMetadata = { url: string };
interface Props {
  businessId: string;
  productId?: string;
  value: ProductImageChange;
  onChange: (value: ProductImageChange) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  variant?: "form" | "viewer";
}

export default function ProductImageDraft({ businessId, productId, value, onChange, disabled = false, onBusyChange, variant = "form" }: Props) {
  const { t } = useTranslation("business");
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const previewImage = useRef<HTMLImageElement>(null);
  const [failedSource, setFailedSource] = useState<string | File | null>(null);
  const url = apiPath(`/businesses/${encodeURIComponent(businessId)}/products/${encodeURIComponent(productId ?? "")}/image`);
  const image = useQuery({
    queryKey: ["product-image", businessId, productId, url],
    enabled: Boolean(productId), retry: false,
    queryFn: async () => (await mainInstance.get<ImageMetadata | null>(url)).data,
  });
  useEffect(() => { if (image.error) notifyHttpError(image.error); }, [image.error]);
  useEffect(() => { onBusyChange?.(image.isFetching); }, [image.isFetching, onBusyChange]);
  const file = value.kind === "replace" ? value.file : null;
  const src = value.kind === "keep" ? image.data?.url : null;
  const source = file ?? src;
  const hasImage = Boolean(source);
  const showImage = hasImage && source !== failedSource;
  useEffect(() => {
    if (!file || !showImage || !previewImage.current) return;
    const objectUrl = URL.createObjectURL(file);
    previewImage.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, showImage]);
  const busy = disabled || image.isFetching;

  return <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>{t("pos.product_image")}</Typography>
    <ImageArea>
      <input id={inputId} ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp"
        aria-label={t("pos.image_choose")} disabled={busy}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) { setFailedSource(null); onChange({ kind: "replace", file: selected }); }
          event.target.value = "";
        }} />
      <Skeleton loading={image.isLoading && value.kind === "keep"}>
        <ImagePicker previewVariant={variant}>
          <ButtonBase component="label" htmlFor={busy ? undefined : inputId} disabled={busy}
            aria-label={t(hasImage ? "pos.image_change" : "pos.image_choose")}
            sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center", borderRadius: "inherit" }}>
            {showImage
              ? <img ref={previewImage} src={file ? undefined : src ?? undefined} alt={t("pos.product_image")} onError={() => setFailedSource(source ?? null)} />
              : <Box sx={{ display: "grid", justifyItems: "center", gap: 1, minWidth: 0, px: 2, textAlign: "center", overflowWrap: "anywhere" }}><AddPhotoAlternateOutlinedIcon sx={{ fontSize: 36 }} /><Typography>{t("pos.image_choose")}</Typography></Box>}
          </ButtonBase>
        </ImagePicker>
      </Skeleton>
      {hasImage && <Tooltip title={t("pos.image_remove")}><Box component="span" sx={{ position: "absolute", top: 1, right: 1, display: "block" }}><RemoveImageButton aria-label={t("pos.image_remove")} disabled={busy}
        onClick={() => onChange({ kind: productId ? "remove" : "keep" })}><CloseOutlinedIcon fontSize="small" /></RemoveImageButton></Box></Tooltip>}
    </ImageArea>
    {variant === "viewer" && <Button disabled={busy} variant="outlined" sx={{ minHeight: { xs: 44, sm: "auto" }, whiteSpace: "normal" }} onClick={() => input.current?.click()}>{t(hasImage ? "pos.image_change" : "pos.image_choose")}</Button>}
    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{t(value.kind === "remove" ? "pos.image_remove_on_save" : variant === "viewer" ? "pos.image_viewer_save_help" : "pos.image_save_help")}</Typography>
    {(image.isError || Boolean(source && source === failedSource)) && <Alert severity="error" action={<Button disabled={busy} onClick={() => { setFailedSource(null); if (productId && !file) void image.refetch(); }}>{t("pos.retry")}</Button>}>{t("pos.image_error")}</Alert>}
  </Box>;
}
