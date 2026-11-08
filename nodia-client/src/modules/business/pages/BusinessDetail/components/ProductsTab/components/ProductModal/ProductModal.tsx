import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Alert, Box, Button, Chip, Grid, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import BaseModal from "../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../../../components/inputs/SelectSingleInput";
import type { SelectSingleInputProps } from "../../../../../../../../components/inputs/SelectSingleInput/types";
import type { ProductEntity, ProviderEntity } from "../../../../../../infrastructure/types";
import ProductImageDraft from "./ProductImageDraft";
import PriceSuggestion from "../PriceSuggestion";
import { useDeferredProductSave } from "./hooks/useDeferredProductSave";
import type { ProductImageChange, ProductSaveTarget } from "./hooks/useDeferredProductSave";
import { MEASUREMENT_UNITS } from "../../../../../../infrastructure/measurementUnits";
import { productCodeFits } from "../../../../../../infrastructure/productCodes";
import { barcodeValue } from "../../../../../../infrastructure/salesPolicies";
import { getProduct } from "../../../../../../infrastructure/salesServices";
import { notifyHttpError } from "../../../../../../../../config/httpFeedback";
import ConfirmDialog from "../../../../../../../../components/ConfirmDialog";
import { FormContainer, SwitchWrapper, StyledFormControlLabel, StyledSwitch, ModalActionsContainer } from "./styles";
import { calculateProductPricing, PRODUCT_PRICE_MAX, validProductTaxRate, type ProductPricingField } from "./productPricing";

const integerMoney = z.number().int().min(0).max(PRODUCT_PRICE_MAX);
const productSchema = z.object({
  code: z.string().trim().refine(productCodeFits).nullable().transform((value) => value || null), name: z.string().trim().min(1),
  measurement_unit: z.enum(MEASUREMENT_UNITS),
  barcode: z.string().nullable().refine((value) => { if (value === null) return true; try { return barcodeValue(value) === value; } catch { return false; } }),
  cost_price: integerMoney, cost_price_tax: integerMoney, sale_price: integerMoney,
  offer_price: integerMoney.nullable(), is_offer_enabled: z.boolean(), has_stock: z.boolean().nullable().refine((value) => value !== null),
  provider_id: z.string().optional().nullable(), is_active: z.boolean(),
  expected_version: z.number().int().positive().optional(),
}).refine((value) => !value.is_offer_enabled || value.offer_price !== null, { path: ["offer_price"] });
export type ProductFormData = z.infer<typeof productSchema>;
type ProductFormInput = z.input<typeof productSchema>;
interface Props {
  open: boolean; onClose: () => void; onSubmit: (data: ProductFormData, target?: ProductSaveTarget) => Promise<ProductEntity>;
  businessId: string;
  initialData?: ProductEntity | null; providers?: ProviderEntity[];
  providerSearch?: Pick<SelectSingleInputProps, "onSearchChange" | "onLoadMore" | "hasMore" | "loadingOptions">;
  isSubmitting?: boolean;
}
const defaults = (product?: ProductEntity | null): ProductFormInput => ({
  code: product?.code ?? null, name: product?.name ?? "", barcode: product?.barcode ?? null, measurement_unit: product?.measurement_unit ?? "unit",
  cost_price: product?.cost_price ?? 0, cost_price_tax: product?.cost_price_tax ?? 0,
  sale_price: product?.sale_price ?? 0,
  offer_price: product ? product.offer_price ?? null : 0, is_offer_enabled: product?.is_offer_enabled ?? false,
  has_stock: product ? product.has_stock ?? null : true, provider_id: product?.provider_id ?? null, is_active: product?.is_active ?? true,
});
const initialTaxRate = (product?: ProductEntity | null) => {
  if (!product || product.cost_price <= 0) return 19;
  const derived = Math.round((product.cost_price_tax / product.cost_price - 1) * 100);
  return derived >= 0 ? derived : 19;
};
export const ProductModal = ({ open, onClose, onSubmit, businessId, initialData, providers = [], providerSearch, isSubmitting: submitting = false }: Props) => {
  const { t, i18n } = useTranslation(["business", "core", "product"]);
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [imageChange, setImageChange] = useState<ProductImageChange>({ kind: "keep" });
  const saving = useDeferredProductSave({ businessId, initialProduct: initialData ?? null, persistFields: onSubmit });
  const [restoredProduct] = useState(() => saving.savedProduct ?? initialData);
  const [activeHelp, setActiveHelp] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latest, setLatest] = useState<ProductEntity | null>(null);
  const isSubmitting = submitting || imageBusy || checking || saving.busy;
  const form = useRef<HTMLFormElement>(null);
  const barcodeFocusPending = useRef(false);
  useEffect(() => { barcodeFocusPending.current = open; }, [open]);
  useEffect(() => {
    if (!open || isSubmitting || !barcodeFocusPending.current) return;
    const activeAtRequest = document.activeElement;
    const frame = requestAnimationFrame(() => {
      const input = form.current?.querySelector<HTMLInputElement>('input[name="barcode"]');
      if (input && !input.disabled && barcodeFocusPending.current) {
        barcodeFocusPending.current = false;
        if (document.activeElement !== activeAtRequest && document.activeElement !== input && form.current?.contains(document.activeElement)) return;
        input.focus();
        input.select();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, isSubmitting]);
  const [taxRate, setTaxRate] = useState(() => initialTaxRate(restoredProduct));
  const [pricingError, setPricingError] = useState<ProductPricingField | null>(null);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (previousOpen !== open) { setPreviousOpen(open); if (open) { setPricingError(null); setTaxRate(initialTaxRate(initialData ?? restoredProduct)); } }
  const [previousProduct, setPreviousProduct] = useState(initialData);
  if (previousProduct !== initialData) { setPreviousProduct(initialData); setTaxRate(initialTaxRate(initialData)); setPricingError(null); setImageChange({ kind: "keep" }); }
  const currentProduct = saving.savedProduct ?? initialData;
  const version = currentProduct?.version;
  const { control, reset, handleSubmit, getValues, setValue, formState: { errors } } = useForm<ProductFormInput, unknown, ProductFormData>({ resolver: zodResolver(productSchema), defaultValues: defaults(restoredProduct) });
  const costPriceTax = useWatch({ control, name: "cost_price_tax" });
  const salePrice = useWatch({ control, name: "sale_price" });
  const validSalePrice = Number.isInteger(salePrice) && salePrice >= 0 && salePrice <= PRODUCT_PRICE_MAX;
  useEffect(() => { if (open) reset(defaults(initialData ?? restoredProduct)); }, [initialData, restoredProduct, open, reset]);
  const help = (name: string, label: string) => <Tooltip title={t(name === "code" ? "product:supplier_code_optional_help" : name === "measurement_unit" ? "product:measurement_unit_help" : name === "sale_price" ? "business:product_field_help_sale_price" : `business:pos.field_help.${name}`)} open={activeHelp === name}
    onOpen={() => setActiveHelp(name)} onClose={() => setActiveHelp(null)}>
    <IconButton type="button" size="small" disabled={isSubmitting} aria-label={t("business:pos.field_help_label", { field: label })}
      onClick={() => setActiveHelp(activeHelp === name ? null : name)} onBlur={() => setActiveHelp(null)}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setActiveHelp(null); } }}
      sx={{ width: { xs: 44, sm: 28 }, height: { xs: 44, sm: 28 }, flexShrink: 0, p: 0.5, color: "text.secondary" }}><HelpOutlineOutlinedIcon sx={{ fontSize: 17 }} /></IconButton>
  </Tooltip>;
  const applyPricing = (source: ProductPricingField, value: number) => {
    const current = getValues();
    // A rate correction must not hide a failed primary calculation behind stale costs.
    const failedPrimary = pricingError === "cost_price" || pricingError === "cost_price_tax" ? pricingError : null;
    const recoverySource = failedPrimary && source === "tax_rate" ? failedPrimary : null;
    const calculationSource = recoverySource ?? source;
    const calculationValue = recoverySource ? current[recoverySource] : value;
    const result = calculateProductPricing(calculationSource, calculationValue, current, source === "tax_rate" ? value : taxRate);
    setPricingError(result.valid ? null : calculationSource);
    if (result.valid) for (const [name, derived] of Object.entries(result.values)) setValue(name as keyof typeof result.values, derived, { shouldDirty: true, shouldValidate: true });
  };
  const moneyField = (name: "cost_price" | "cost_price_tax" | "sale_price" | "offer_price", label: string) => <Controller name={name} control={control} render={({ field }) => <TextInput
    id={`product-${name.replaceAll("_", "-")}`} name={field.name} type="number" label={label} data-testid={`product-${name === "cost_price_tax" ? "cost-tax" : name.replaceAll("_", "-")}-input`}
    labelAdornment={help(name, label)} value={field.value === null || !Number.isFinite(field.value) ? "" : String(field.value)}
    onChange={(event) => {
      const raw = event.target.value;
      const value = raw === "" ? Number.NaN : Number(raw);
      field.onChange(name === "offer_price" && raw === "" ? null : value);
      if (name === "cost_price" || name === "cost_price_tax") applyPricing(name, value);
    }} onBlur={field.onBlur} error={Boolean(errors[name])} helperText={errors[name] ? t("business:pos.invalid_price") : undefined} disabled={isSubmitting} /> } />;
  const options = initialData?.provider && !providers.some((provider) => provider.id === initialData.provider?.id) ? [initialData.provider, ...providers] : providers;
  const inspectCurrent = async () => {
    if (!currentProduct || isSubmitting) return;
    setChecking(true);
    try { setLatest(await getProduct(currentProduct.id)); } catch (error) { notifyHttpError(error); } finally { setChecking(false); }
  };
  const reviewValue = (field: keyof ProductFormData, value: unknown) => {
    if (value === null || value === undefined || value === "") return t("business:pos.value_not_set");
    if (field === "measurement_unit") return t(`product:units.${String(value)}`);
    if (field === "provider_id") return options.find((provider) => provider.id === value)?.name ?? String(value);
    if (field === "has_stock") return t(value ? "business:pos.available" : "business:pos.unavailable");
    if (typeof value === "boolean") return t(value ? "business:pos.yes" : "business:pos.no");
    if (["sale_price", "offer_price", "cost_price", "cost_price_tax"].includes(field) && typeof value === "number") return new Intl.NumberFormat(i18n.language, { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
    return String(value);
  };
  const fieldLabels = { name: "product_name", code: "pos.supplier_code", measurement_unit: "measurement_unit", barcode: "pos.barcode", sale_price: "product_sale_price", offer_price: "pos.alternate_price", is_offer_enabled: "pos.use_alternate", has_stock: "pos.availability", is_active: "active_label", cost_price: "product_cost_price", cost_price_tax: "product_cost_tax", provider_id: "product_provider" } as const;
  const canonicalReviewValue = (field: keyof ProductFormData, value: unknown) => {
    if (field === "measurement_unit" && value === undefined) return "unit";
    if (field === "code" && typeof value === "string") return value.trim() || null;
    return value ?? null;
  };
  const reviewRows = latest ? (Object.keys(fieldLabels) as (keyof typeof fieldLabels)[]).map(field => {
    const saved = canonicalReviewValue(field, latest[field]);
    const draft = canonicalReviewValue(field, getValues(field));
    return { field, label: field === "measurement_unit" ? t("product:measurement_unit") : t(`business:${fieldLabels[field]}`), saved: reviewValue(field, saved), draft: reviewValue(field, draft), changed: saved !== draft };
  }) : [];
  const submitForm = async (data: ProductFormData) => {
    if (isSubmitting || pricingError || !validProductTaxRate(taxRate)) return;
    try { await saving.save({ ...data, expected_version: version }, imageChange); onClose(); } catch { /* Keep the form and image draft for recovery. */ }
  };
  return <BaseModal open={open} onClose={() => { if (!isSubmitting) { saving.cancel(); onClose(); } }} title={t(currentProduct ? "business:pos.edit_product" : "business:add_single_product")} size="md" actions={<ModalActionsContainer>
    <Button disabled={isSubmitting} onClick={() => { saving.cancel(); onClose(); }}>{t("business:cancel")}</Button>
    <Button variant="contained" disabled={isSubmitting || saving.phase === "fields_unknown" || Boolean(pricingError) || !validProductTaxRate(taxRate) || !validSalePrice} type="submit" form="product-form" data-testid="save-product-btn">{t("business:save")}</Button>
  </ModalActionsContainer>}>
    <FormContainer ref={form} id="product-form" onSubmit={handleSubmit(submitForm)}>
      {saving.phase === "fields_unknown" && <Alert severity="warning">{t("business:pos.product_save_unknown")}</Alert>}
      {saving.savedProduct && imageChange.kind !== "keep" && <Alert severity="info">{t("business:pos.product_saved_image_pending")}</Alert>}
      {(saving.pendingIntent || saving.phase === "image_pending" || saving.phase === "image_conflict") && <Alert severity="warning" action={<Button disabled={isSubmitting} onClick={() => void saving.reconcile().catch(() => undefined)}>{t("business:pos.reconcile")}</Button>}>{t(saving.phase === "image_conflict" ? "business:pos.image_review_before_retry" : "business:pos.image_pending")}</Alert>}
      {pricingError && <Alert severity="error">{t("business:product_price_calculation_invalid")}</Alert>}
      <Grid container spacing={2}>
        {(["barcode", "name", "code"] as const).map((name) => <Grid key={name} size={12}><Controller name={name} control={control} render={({ field }) => <TextInput
          id={`product-${name}`} name={name} label={t(name === "barcode" ? "business:pos.barcode" : name === "code" ? "business:pos.supplier_code" : "business:product_name")}
          labelAdornment={help(name, t(name === "barcode" ? "business:pos.barcode" : name === "code" ? "business:pos.supplier_code" : "business:product_name"))} type="text"
          autoFocus={name === "barcode"}
          value={field.value ?? ""} onChange={(event) => field.onChange(name === "barcode" && event.target.value === "" ? null : event.target.value)}
          onFocus={name === "barcode" ? (event) => event.currentTarget.select() : undefined}
          onKeyDown={name === "barcode" ? (event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); } } : undefined}
          error={Boolean(errors[name])} helperText={errors[name] ? t("business:pos.invalid_field") : name === "barcode" ? t("business:pos.barcode_input_help") : undefined} disabled={isSubmitting} required={name === "name"} data-testid={`product-${name}-input`} /> } /></Grid>)}
        <Grid size={12}><Controller name="measurement_unit" control={control} render={({ field }) => <SelectSingleInput id="product-measurement-unit" label={t("product:measurement_unit")} labelAdornment={help("measurement_unit", t("product:measurement_unit"))} required clearable={false}
          value={field.value} options={MEASUREMENT_UNITS.map((unit) => ({ value: unit, label: t(`product:units.${unit}`) }))}
          onChange={field.onChange} disabled={isSubmitting} error={Boolean(errors.measurement_unit)} helperText={errors.measurement_unit ? t("product:invalid_measurement_unit") : undefined} data-testid="product-measurement-unit-input" /> } /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}>{moneyField("cost_price", t("business:product_cost_price"))}</Grid>
        <Grid size={{ xs: 12, sm: 6 }}><TextInput label={t("business:product_tax_rate")} labelAdornment={help("tax_rate", t("business:product_tax_rate"))} type="number" value={Number.isFinite(taxRate) ? String(taxRate) : ""} data-testid="product-tax-rate-input" disabled={isSubmitting} error={!Number.isFinite(taxRate) || taxRate < 0} onChange={(event) => {
          const value = event.target.value === "" ? Number.NaN : Number(event.target.value); setTaxRate(value);
          applyPricing("tax_rate", value);
        }} /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}>{moneyField("cost_price_tax", t("business:product_cost_tax"))}</Grid>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ alignSelf: "end" }}><PriceSuggestion key={`${open}-${currentProduct?.id ?? "new"}`} costPriceTax={costPriceTax} disabled={isSubmitting || Boolean(pricingError) || !validProductTaxRate(taxRate)} onApply={(price) => setValue("sale_price", price, { shouldDirty: true, shouldValidate: true })} /></Grid>
        <Grid size={12}>{moneyField("sale_price", t("business:product_sale_price"))}</Grid>
        <Grid size={12}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2, alignItems: "end" }}>
          {moneyField("offer_price", t("business:pos.alternate_price"))}
          <Box><Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: "6px" }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{t("business:pos.use_alternate")}</Typography>{help("is_offer_enabled", t("business:pos.use_alternate"))}</Box>
            <Controller name="is_offer_enabled" control={control} render={({ field }) => <SwitchWrapper sx={{ height: { xs: "auto", sm: 42 }, minHeight: { xs: 44, sm: 0 }, boxSizing: "border-box" }}><StyledFormControlLabel labelPlacement="start" label={t(field.value ? "business:pos.alternate_applied" : "business:status_inactive")} control={<StyledSwitch checked={field.value} onChange={(_, value) => field.onChange(value)} disabled={isSubmitting} slotProps={{ input: { "aria-label": t("business:pos.use_alternate") } }} />} /></SwitchWrapper>} />
          </Box>
        </Box></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><Controller name="has_stock" control={control} render={({ field }) => <SelectSingleInput id="product-has-stock" label={t("business:pos.availability")} labelAdornment={help("has_stock", t("business:pos.availability"))} required clearable={false}
          value={field.value === null ? null : String(field.value)} data-testid="product-has-stock-input" options={[{ value: "true", label: t("business:pos.available") }, { value: "false", label: t("business:pos.unavailable") }]}
          onChange={(value) => field.onChange(value === null ? null : value === "true")} disabled={isSubmitting} error={Boolean(errors.has_stock)} helperText={errors.has_stock ? t("business:pos.choose_availability") : undefined} /> } /></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><Controller name="provider_id" control={control} render={({ field }) => <SelectSingleInput id="product-provider" label={t("business:product_provider")} labelAdornment={help("provider_id", t("business:product_provider"))} {...providerSearch}
          options={options.map((provider) => ({ value: provider.id, label: provider.name }))} value={field.value ?? null} onChange={field.onChange} disabled={isSubmitting} data-testid="product-provider-select" /> } /></Grid>
        <Grid size={12}><Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{t("business:active_label")}</Typography>{help("is_active", t("business:active_label"))}</Box><Controller name="is_active" control={control} render={({ field }) => <SwitchWrapper data-testid="product-active-switch"><StyledFormControlLabel labelPlacement="start" label={t("business:active_label")} control={<StyledSwitch checked={field.value} onChange={(_, value) => field.onChange(value)} disabled={isSubmitting} />} /></SwitchWrapper>} /></Grid>
      </Grid>
      <ProductImageDraft businessId={businessId} productId={currentProduct?.id} value={imageChange} onChange={setImageChange} disabled={isSubmitting} onBusyChange={setImageBusy} />
      {currentProduct && <Button disabled={isSubmitting} onClick={() => void inspectCurrent()}>{t("business:pos.inspect_product")}</Button>}
    </FormContainer>
    <ConfirmDialog open={Boolean(latest)} size="lg" onClose={() => setLatest(null)} confirmDisabled={!latest?.version || saving.phase === "fields_unknown" || Boolean(saving.pendingIntent && !saving.pendingIntent.needsReview)} onConfirm={() => {
      if (!latest?.version) return;
      try { saving.adoptReviewed(latest); setLatest(null); } catch (error) { notifyHttpError(error); }
    }} title={t("business:pos.inspect_product")} message={t("business:pos.inspect_product_explanation")}>
      {saving.pendingIntent && !saving.pendingIntent.needsReview && <Alert severity="warning" sx={{ mt: 2 }}>{t("business:pos.image_pending")}</Alert>}
      {latest && (mobile ? <Box sx={{ display: "grid", gap: 1.5, mt: 2 }}>{reviewRows.map(row => <Box key={row.field} sx={{ p: 1.5, border: "1px solid", borderColor: row.changed ? "primary.main" : "divider", borderRadius: 1 }}>
        <Typography sx={{ fontWeight: 600, mb: 1 }}>{row.label}</Typography>
        <Typography variant="caption" color="text.secondary">{t("business:pos.saved_value")}</Typography><Typography sx={{ overflowWrap: "anywhere", mb: 1 }}>{row.saved}</Typography>
        <Typography variant="caption" color="text.secondary">{t("business:pos.my_changes")}</Typography><Typography sx={{ overflowWrap: "anywhere" }}>{row.draft}</Typography>
        <Chip size="small" sx={{ mt: 1 }} color={row.changed ? "primary" : "default"} label={t(row.changed ? "business:pos.value_changed" : "business:pos.value_unchanged")} />
      </Box>)}</Box> : <TableContainer sx={{ mt: 2 }}><Table size="small" aria-label={t("business:pos.inspect_product")} sx={{ tableLayout: "fixed", minWidth: 650 }}><TableHead><TableRow>
        <TableCell sx={{ width: "28%" }}>{t("business:pos.field_name")}</TableCell><TableCell>{t("business:pos.saved_value")}</TableCell><TableCell>{t("business:pos.my_changes")}</TableCell>
      </TableRow></TableHead><TableBody>{reviewRows.map(row => <TableRow key={row.field} sx={row.changed ? { backgroundColor: "action.selected" } : undefined}>
        <TableCell component="th" scope="row" sx={{ overflowWrap: "anywhere", verticalAlign: "top" }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{row.label}</Typography><Chip size="small" sx={{ mt: 1 }} color={row.changed ? "primary" : "default"} label={t(row.changed ? "business:pos.value_changed" : "business:pos.value_unchanged")} /></TableCell>
        <TableCell sx={{ overflowWrap: "anywhere", verticalAlign: "top" }}>{row.saved}</TableCell><TableCell sx={{ overflowWrap: "anywhere", verticalAlign: "top" }}>{row.draft}</TableCell>
      </TableRow>)}</TableBody></Table></TableContainer>)}
    </ConfirmDialog>
  </BaseModal>;
};
export default ProductModal;
