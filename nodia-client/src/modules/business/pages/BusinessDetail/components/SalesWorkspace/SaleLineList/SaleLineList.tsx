import { Alert, Box, Button, Tooltip, Typography } from "@mui/material";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import CloseRounded from "@mui/icons-material/CloseRounded";
import AddOutlined from "@mui/icons-material/AddOutlined";
import RemoveOutlined from "@mui/icons-material/RemoveOutlined";
import { visuallyHidden } from "@mui/utils";
import { Skeleton } from "boneyard-js/react";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { CartLine } from "../../../../../infrastructure/salesTypes";
import type { ProductEntity } from "../../../../../infrastructure/types";
import { cartLinePrice, exceedsObservedStock, formatClp, quantityFromInput } from "../../../../../infrastructure/salesPolicies";
import { formatQuantity, lineSubtotal, quantityThousandths } from "../../../../../infrastructure/saleQuantities";
import SaleLinePrice from "../SaleLinePrice";
import QuantityStepper from "../QuantityStepper";
import { ActionButton, Copy, EmptyHelp, EmptyState, EmptyTitle, Line, LineControls, LineIdentity, Lines, LineTotal, Picture, PictureSlot, ProductDetails, RemoveAction, RemoveButton } from "./styles";

interface Props {
  lines: CartLine[];
  images: Record<string, ProductEntity["image"] | null>;
  disabled: boolean;
  imageLoading: boolean;
  imageError: boolean;
  imageFetching: boolean;
  retryImages: () => void;
  quantityDrafts: Record<string, string>;
  onStep: (id: string, delta: number) => void;
  onQuantity: (id: string, raw: string) => void;
  onReview?: () => void;
  reviewDisabled?: boolean;
  onRemove?: (id: string) => void;
  fontScale?: number;
  onFontScale?: (value: number) => void;
  editingScope?: string;
  scrollToTopVersion?: number;
  onPrice?: (id: string, value: string, permanent: boolean) => Promise<boolean>;
  editingProductId?: string | null;
  priceDisabled?: boolean;
  onPriceEditingChange?: (id: string, editing: boolean) => void;
}
export default function SaleLineList({ lines, images, disabled, imageLoading, imageError, imageFetching, retryImages, quantityDrafts, onStep, onQuantity, onReview, reviewDisabled = disabled, onRemove, fontScale = 100, onFontScale, editingScope, scrollToTopVersion, onPrice, editingProductId, priceDisabled, onPriceEditingChange }: Props) {
  const { t, i18n } = useTranslation(["business", "core"]);
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [editingScope, scrollToTopVersion]);

  return <>
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, minWidth: 0 }}><Typography component="h3" variant="subtitle1" sx={{ flex: 1, fontWeight: 700 }}>{t("business:pos.selected_products")}</Typography>
      {onReview && <Tooltip title={t("business:stock_tracking.review_cart")}><span><ActionButton aria-label={t("business:stock_tracking.review_cart")} disabled={reviewDisabled} onClick={onReview}><RefreshOutlined /></ActionButton></span></Tooltip>}
      {onFontScale && <Box role="group" aria-label={t("business:pos.list_text_size")} sx={{ display: "flex", alignItems: "center", gap: .5, ml: "auto" }}>
        <Tooltip title={t("business:pos.decrease_text_size")}><span><ActionButton aria-label={t("business:pos.decrease_text_size")} disabled={fontScale <= 80} onClick={() => onFontScale(Math.max(80, fontScale - 10))}><RemoveOutlined /></ActionButton></span></Tooltip>
        <Typography aria-live="polite" sx={{ minWidth: 48, textAlign: "center", fontWeight: 700 }}>{fontScale}%</Typography>
        <Tooltip title={t("business:pos.increase_text_size")}><span><ActionButton aria-label={t("business:pos.increase_text_size")} disabled={fontScale >= 200} onClick={() => onFontScale(Math.min(200, fontScale + 10))}><AddOutlined /></ActionButton></span></Tooltip>
      </Box>}
    </Box>
    {imageError && <Alert severity="error" action={<Button disabled={imageFetching || disabled} onClick={retryImages}>{t("business:pos.retry")}</Button>}>{t("core:server_error_alert")}</Alert>}
    <Lines ref={listRef} role="region" aria-label={t("business:pos.selected_products")} tabIndex={0} data-enlarged={fontScale > 100} sx={{ "--sale-font-scale": fontScale / 100 }}>
      {lines.length === 0 ? <EmptyState><EmptyTitle component="h4">{t("business:pos.sale_empty_title")}</EmptyTitle><EmptyHelp>{t("business:pos.sale_empty_help")}</EmptyHelp></EmptyState> :
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {lines.map((line) => {
            const requested = quantityFromInput(quantityDrafts[line.product_id] ?? String(line.quantity));
            const insufficient = requested !== null && exceedsObservedStock(line, requested);
            const stockThousandths = quantityThousandths(line.stock_available);
            const currentQuantity = quantityThousandths(line.quantity);
            const subtotal = formatClp(lineSubtotal(cartLinePrice(line), line.quantity), i18n.language);
            return <Line key={line.product_id} data-price-editing={editingProductId === line.product_id}>
            <PictureSlot><Skeleton loading={imageLoading}><Picture variant="rounded" src={images[line.product_id]?.url} alt="" slotProps={{ img: { loading: "lazy" } }}><ImageOutlined /></Picture></Skeleton></PictureSlot>
            <Copy>
              <LineIdentity>
                <ProductDetails>
                  <Typography sx={{ fontSize: "calc(1rem * var(--sale-font-scale, 1))", fontWeight: 700 }}>{line.name}</Typography>
                  {line.stock_available !== undefined && <Typography variant="body2" color={insufficient ? "error" : "text.secondary"}>
                    {t(insufficient ? "business:stock_tracking.insufficient" : "business:stock_tracking.available_balance", { stock: formatQuantity(line.stock_available, i18n.language) })}
                  </Typography>}
                  {line.quantity === 0 && !disabled && <Typography variant="body2" color="warning.main">{t("business:pos.zero_quantity_help")}</Typography>}
                </ProductDetails>
                <SaleLinePrice key={`${editingScope ?? ""}:${line.product_id}`} line={line} disabled={(priceDisabled ?? disabled) || (editingProductId != null && editingProductId !== line.product_id)} onSave={onPrice}
                  onEditingChange={(editing) => onPriceEditingChange?.(line.product_id, editing)} />
              </LineIdentity>
            </Copy>
            <LineControls>
              <QuantityStepper name={line.name} quantity={line.quantity} inputValue={quantityDrafts[line.product_id]} disabled={disabled}
                incrementDisabled={stockThousandths !== null && currentQuantity !== null && currentQuantity + 1000n > stockThousandths}
                onIncrement={() => onStep(line.product_id, 1)} onDecrement={() => onStep(line.product_id, -1)} onInputChange={(raw) => onQuantity(line.product_id, raw)} />
              <LineTotal variant="body2">
                <Box component="span" sx={visuallyHidden}>{t("business:pos.line_total", { total: subtotal })}</Box>
                <span aria-hidden="true">{subtotal}</span>
              </LineTotal>
            </LineControls>
            {onRemove && <Tooltip title={t("business:pos.remove_product", { name: line.name })}><RemoveAction><RemoveButton aria-label={t("business:pos.remove_product", { name: line.name })} disabled={disabled} onClick={() => onRemove(line.product_id)}><CloseRounded /></RemoveButton></RemoveAction></Tooltip>}
          </Line>;
          })}
        </Box>}
    </Lines>
  </>;
}
