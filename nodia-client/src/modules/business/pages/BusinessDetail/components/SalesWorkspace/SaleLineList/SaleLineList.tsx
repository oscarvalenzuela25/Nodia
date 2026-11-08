import { Alert, Box, Button, Tooltip, Typography } from "@mui/material";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import RemoveOutlined from "@mui/icons-material/RemoveOutlined";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import type { CartLine } from "../../../../../infrastructure/salesTypes";
import type { ProductEntity } from "../../../../../infrastructure/types";
import { cartLinePrice, formatClp } from "../../../../../infrastructure/salesPolicies";
import { lineSubtotal } from "../../../../../infrastructure/saleQuantities";
import SaleLinePrice from "../SaleLinePrice";
import QuantityStepper from "../QuantityStepper";
import { ActionButton, Copy, EmptyHelp, EmptyState, EmptyTitle, Line, Lines, Picture, Quantity, RemoveAction, RemoveButton } from "./styles";

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
  onRemove?: (id: string) => void;
  fontScale?: number;
  onFontScale?: (value: number) => void;
  editingScope?: string;
  onPrice?: (id: string, value: string, permanent: boolean) => Promise<boolean>;
  editingProductId?: string | null;
  priceDisabled?: boolean;
  onPriceEditingChange?: (id: string, editing: boolean) => void;
}
export default function SaleLineList({ lines, images, disabled, imageLoading, imageError, imageFetching, retryImages, quantityDrafts, onStep, onQuantity, onReview, onRemove, fontScale = 100, onFontScale, editingScope, onPrice, editingProductId, priceDisabled, onPriceEditingChange }: Props) {
  const { t, i18n } = useTranslation(["business", "core"]);
  return <>
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, minWidth: 0 }}><Typography component="h2" variant="h6" sx={{ flex: 1 }}>{t("business:pos.selected_products")}</Typography>
      {onReview && <Tooltip title={t("business:pos.review_prices")}><span><ActionButton aria-label={t("business:pos.review_prices")} disabled={disabled} onClick={onReview}><RefreshOutlined /></ActionButton></span></Tooltip>}
      {onFontScale && <Box role="group" aria-label={t("business:pos.list_text_size")} sx={{ display: "flex", alignItems: "center", gap: .5, ml: "auto" }}>
        <Tooltip title={t("business:pos.decrease_text_size")}><span><ActionButton aria-label={t("business:pos.decrease_text_size")} disabled={fontScale <= 80} onClick={() => onFontScale(Math.max(80, fontScale - 10))}><RemoveOutlined /></ActionButton></span></Tooltip>
        <Typography aria-live="polite" sx={{ minWidth: 48, textAlign: "center", fontWeight: 700 }}>{fontScale}%</Typography>
        <Tooltip title={t("business:pos.increase_text_size")}><span><ActionButton aria-label={t("business:pos.increase_text_size")} disabled={fontScale >= 200} onClick={() => onFontScale(Math.min(200, fontScale + 10))}><AddOutlined /></ActionButton></span></Tooltip>
      </Box>}
    </Box>
    {imageError && <Alert severity="error" action={<Button disabled={imageFetching || disabled} onClick={retryImages}>{t("business:pos.retry")}</Button>}>{t("core:server_error_alert")}</Alert>}
    <Lines role="region" aria-label={t("business:pos.selected_products")} tabIndex={0} data-enlarged={fontScale > 100} sx={{ "--sale-font-scale": fontScale / 100 }}>
      {lines.length === 0 ? <EmptyState><EmptyTitle component="h3">{t("business:pos.sale_empty_title")}</EmptyTitle><EmptyHelp>{t("business:pos.sale_empty_help")}</EmptyHelp></EmptyState> :
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {lines.map((line) => <Line key={line.product_id}>
            <Skeleton loading={imageLoading}><Picture variant="rounded" src={images[line.product_id]?.url} alt="" slotProps={{ img: { loading: "lazy" } }}><ImageOutlined /></Picture></Skeleton>
            <Copy>
              <Typography sx={{ fontSize: "calc(1.125rem * var(--sale-font-scale, 1))", fontWeight: 700 }}>{line.name}</Typography>
              <SaleLinePrice key={`${editingScope ?? ""}:${line.product_id}`} line={line} disabled={(priceDisabled ?? disabled) || (editingProductId != null && editingProductId !== line.product_id)} onSave={onPrice}
                onEditingChange={(editing) => onPriceEditingChange?.(line.product_id, editing)} />
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "calc(.875rem * var(--sale-font-scale, 1))" }}>{t("business:pos.line_total", { total: formatClp(lineSubtotal(cartLinePrice(line), line.quantity), i18n.language) })}</Typography>
              {line.quantity === 0 && !disabled && <Typography variant="body2" color="warning.main">{t("business:pos.zero_quantity_help")}</Typography>}
            </Copy>
            <Quantity><QuantityStepper name={line.name} quantity={line.quantity} inputValue={quantityDrafts[line.product_id]} disabled={disabled}
              onIncrement={() => onStep(line.product_id, 1)} onDecrement={() => onStep(line.product_id, -1)} onInputChange={(raw) => onQuantity(line.product_id, raw)} /></Quantity>
            {onRemove && <Tooltip title={t("business:pos.remove_product", { name: line.name })}><RemoveAction><RemoveButton aria-label={t("business:pos.remove_product", { name: line.name })} disabled={disabled} onClick={() => onRemove(line.product_id)}><DeleteOutlined /></RemoveButton></RemoveAction></Tooltip>}
          </Line>)}
        </Box>}
    </Lines>
  </>;
}
