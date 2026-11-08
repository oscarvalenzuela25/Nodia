import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Alert, Autocomplete, Box, Button, LinearProgress, TextField, Typography } from "@mui/material";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import { useTranslation } from "react-i18next";
import { usePosCatalog } from "../../../../../infrastructure/usePosCatalog";
import { productToCartLine } from "../../../../../infrastructure/salesPolicies";
import type { ProductEntity } from "../../../../../infrastructure/types";
import ProductPrice from "../ProductPrice";
import { measurementUnit } from "../../../../../infrastructure/measurementUnits";
import { OptionItem, ProductContent, ProductCopy, ProductPicture, catalogueScrollbars } from "./styles";

export interface PosProductCatalogProps {
  businessId: string;
  disabled: boolean;
  assignmentMode?: boolean;
  onSelect: (product: ProductEntity) => void;
  onFetchingChange?: (fetching: boolean) => void;

}
const eligible = (product: ProductEntity, assignmentMode: boolean) => {
  if (assignmentMode) return product.is_active;
  try { productToCartLine(product); return true; } catch { return false; }
};
function ProductSummary({ product }: { product: ProductEntity }) {
  return <ProductContent>
    <ProductPicture variant="rounded" src={product.image?.url} alt="" slotProps={{ img: { loading: "lazy" } }}><ImageOutlined /></ProductPicture>
    <ProductCopy>
      <Typography sx={{ fontWeight: 600, fontSize: { xs: "1rem", sm: "1.125rem" }, lineHeight: 1.3 }}>{product.name}</Typography>
      <ProductPrice price={product.effective_price} regularPrice={product.sale_price} onOffer={product.is_offer_enabled === true} measurementUnit={measurementUnit(product.measurement_unit)} />
    </ProductCopy>
  </ProductContent>;
}

export default function PosProductCatalog({ businessId, disabled, assignmentMode = false, onSelect, onFetchingChange }: PosProductCatalogProps) {
  const { t } = useTranslation(["business", "core"]);
  const catalog = usePosCatalog(businessId, assignmentMode);
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const appendScroll = useRef<{ element: HTMLElement; top: number; count: number; scope: string } | null>(null);
  const scope = JSON.stringify([catalog.context, catalog.search]);
  const blocked = disabled || catalog.fetching || catalog.isError;
  useEffect(() => { onFetchingChange?.(catalog.fetching); }, [catalog.fetching, onFetchingChange]);
  useLayoutEffect(() => {
    const saved = appendScroll.current;
    if (!saved) return;
    if (!open || disabled || saved.scope !== scope) { appendScroll.current = null; return; }
    if (catalog.products.length <= saved.count) return;
    // MUI can reset highlighted-option scroll while appending options, even on the same UL.
    saved.element.scrollTop = saved.top;
    const frame = requestAnimationFrame(() => {
      if (appendScroll.current === saved && saved.element.isConnected) {
        saved.element.scrollTop = saved.top;
        appendScroll.current = null;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [catalog.products.length, scope, open, disabled]);
  const choose = (product: ProductEntity) => {
    if (blocked) return;
    const current = catalog.resolveSelection(product.id);
    if (current && eligible(current, assignmentMode)) { onSelect(current); catalog.setSearch(""); setOpen(false); }
  };
  return <Box sx={{ minWidth: 0 }}>
    <Typography component="label" htmlFor={inputId} variant="body2" sx={{ display: "block", fontWeight: 600, mb: .75 }}>{t("business:pos.catalog_select_label")}</Typography>
    <Autocomplete<ProductEntity> id={inputId} fullWidth options={catalog.products} value={null} inputValue={catalog.search}
      open={open && !disabled} onOpen={() => setOpen(true)} onClose={() => { appendScroll.current = null; setOpen(false); }}
      filterOptions={(options) => options} getOptionLabel={(option) => option.name} getOptionKey={(option) => option.id} isOptionEqualToValue={(option, value) => option.id === value.id}
      disabled={disabled || (catalog.isLoading && !open)} loading={catalog.fetching}
      getOptionDisabled={(product) => blocked || !eligible(product, assignmentMode)}
      onInputChange={(_, value, reason) => { if (!disabled && !catalog.networkFetching && (reason === "input" || reason === "clear")) catalog.setSearch(value); }}
      onChange={(_, product) => { if (product) choose(product); }}
      noOptionsText={t(catalog.isError ? "core:server_error_alert" : "business:pos.catalog_empty")} loadingText={t("business:pos.catalog_loading")}
      openText={t("business:pos.catalog_open")} closeText={t("core:close")} clearText={t("core:clear_search")}
      slotProps={{ popupIndicator: { disabled: disabled || catalog.networkFetching }, clearIndicator: { disabled: disabled || catalog.networkFetching }, listbox: { sx: (theme) => ({ ...catalogueScrollbars(theme), maxHeight: "min(400px, calc((100svh - 88px) / 2))", p: 0, overflowAnchor: "none" }), onScroll: (event) => {
        const list = event.currentTarget;
        if (!disabled && !catalog.fetching && !catalog.isError && catalog.hasNextPage &&
          !(appendScroll.current && catalog.products.length > appendScroll.current.count) && list.scrollHeight - list.scrollTop - list.clientHeight < 100) {
          appendScroll.current = { element: list, top: list.scrollTop, count: catalog.products.length, scope };
          void catalog.loadMore();
        }
      } }, popper: { sx: { minWidth: 0, maxWidth: "calc(100vw - 32px)" } } }}
      renderInput={(params) => <TextField {...params} placeholder={t("business:pos.search_products")}
        slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, readOnly: catalog.networkFetching, "aria-busy": catalog.fetching, "aria-disabled": disabled || catalog.networkFetching } }} />}
      renderOption={({ key, ...props }, product) => <OptionItem key={key} {...props}><ProductSummary product={product} /></OptionItem>} />
    {catalog.fetching && !catalog.isLoading && <LinearProgress aria-label={t("business:pos.catalog_loading")} />}
    {catalog.isError && <Alert severity="error" action={<Button disabled={disabled || catalog.fetching} onClick={() => void catalog.retry()}>{t("business:pos.retry")}</Button>}>{t("core:server_error_alert")}</Alert>}
  </Box>;
}
