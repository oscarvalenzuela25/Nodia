import { useState } from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, LinearProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Skeleton } from "boneyard-js/react";
import BaseModal from "../../../../../../../../../components/BaseModal";
import SelectSingleInput from "../../../../../../../../../components/inputs/SelectSingleInput";
import QueryErrorAlert from "../../../../../../../../../components/QueryErrorAlert";
import type { ProductEntity } from "../../../../../../../infrastructure/types";
import { INVOICE_UPDATE_FIELDS, type InvoiceProvisionalRow, type InvoiceUpdateField } from "../helpers";
import { PRODUCT_PRICE_MAX } from "../../ProductModal/productPricing";
import { useInvoiceMatchProducts } from "./infrastructure/useServices";
import { Comparison } from "./styles";

type Props = { businessId: string; row: InvoiceProvisionalRow; disabled: boolean; onClose: () => void; onApply: (product: ProductEntity, fields: InvoiceUpdateField[]) => boolean };
const defaultFields: InvoiceUpdateField[] = ["code", "cost_price", "cost_price_tax"];

export default function InvoiceProductMatch({ businessId, row, disabled, onClose, onApply }: Props) {
  const { t } = useTranslation();
  const [productId, setProductId] = useState<string | null>(null);
  const [fields, setFields] = useState<InvoiceUpdateField[]>(defaultFields);
  const { products, selected, options, setSearch, canInteract, scopeKey } = useInvoiceMatchProducts(businessId, productId);
  const [openedScope] = useState(scopeKey);
  const staleScope = openedScope !== scopeKey;
  const product = selected.data;
  const loading = disabled || !canInteract || staleScope || products.isFetching || selected.isFetching;
  const invalid = (field: InvoiceUpdateField) => field === "name" || field === "code" ? !row[field].trim() : !Number.isInteger(row[field]) || row[field] < 0 || row[field] > PRODUCT_PRICE_MAX;
  const chosen = fields.filter(field => !invalid(field));
  const fieldLabel = (field: InvoiceUpdateField) => t(`business:${({ code: "product_code", name: "product_name", cost_price: "product_cost_price", cost_price_tax: "product_cost_tax", sale_price: "product_sale_price" } as const)[field]}`);
  const display = (value: unknown) => value === null || value === undefined || value === "" ? t("business:invoice_match_no_value") : String(value);
  const optionsList = options.map(item => ({ value: item.id, label: `${item.name} · ${item.code || t("business:invoice_match_no_code")}` }));
  return <BaseModal open onClose={onClose} title={t("business:invoice_match_title")} subtitle={t("business:invoice_match_help")} size="md" actions={<Stack direction={{ xs: "column-reverse", sm: "row" }} sx={{ gap: 2, width: "100%", justifyContent: "flex-end" }}>
    <Button variant="outlined" onClick={onClose} sx={{ width: { xs: "100%", sm: "auto" } }}>{t("core:cancel")}</Button>
    <Button variant="contained" disabled={loading || selected.isError || products.isError || !product || !chosen.length} onClick={() => { if (product && !loading && !selected.isError && !products.isError && chosen.length && onApply(product, chosen)) onClose(); }} sx={{ width: { xs: "100%", sm: "auto" } }}>{t("business:invoice_match_apply")}</Button>
  </Stack>}>
    <Stack sx={{ gap: 2, minWidth: 0 }}>
      <SelectSingleInput label={t("business:invoice_match_select")} placeholder={t("business:invoice_match_search")} options={optionsList} value={productId}
        onChange={id => { setProductId(id); setFields(defaultFields); }} onSearchChange={setSearch} loadingOptions={products.isFetching}
        hasMore={products.hasNextPage} onLoadMore={() => { if (canInteract && !staleScope) void products.fetchNextPage(); }} disabled={disabled || !canInteract || staleScope || products.isLoading || selected.isFetching} />
      {staleScope && <Alert severity="warning">{t("business:invoice_match_scope_changed")}</Alert>}
      <QueryErrorAlert isError={products.isError || selected.isError} isFetching={loading} onRetry={() => { if (canInteract && !staleScope) { void products.refetch(); if (productId) void selected.refetch(); } }} />
      {productId && <Box sx={{ minWidth: 0 }}>
        {selected.isFetching && !selected.isLoading && <LinearProgress />}
        <Skeleton loading={selected.isLoading}>
          <Box sx={{ minHeight: selected.isLoading ? 120 : undefined }}>
            {product && <Typography variant="body2" sx={{ fontWeight: 700 }}>{product.name}</Typography>}
            {!selected.isError && !selected.isLoading && !product && <Alert severity="warning">{t("business:invoice_match_invalid_product")}</Alert>}
          </Box>
        </Skeleton>
        {product && <Comparison>
          {INVOICE_UPDATE_FIELDS.map(field => <Box className="field" key={field}>
            <FormControlLabel control={<Checkbox checked={chosen.includes(field)} disabled={loading || selected.isError || invalid(field)} onChange={(_, checked) => setFields(previous => checked ? [...previous, field] : previous.filter(value => value !== field))} />} label={fieldLabel(field)} />
            <Box className="values"><Box><Typography variant="caption" color="text.secondary">{t("business:invoice_match_current")}</Typography><Typography variant="body2">{display(product[field])}</Typography></Box><Typography aria-hidden sx={{ pt: 2 }}>→</Typography><Box><Typography variant="caption" color="text.secondary">{t("business:invoice_match_invoice")}</Typography><Typography variant="body2">{display(Number.isFinite(row[field]) || typeof row[field] === "string" ? row[field] : null)}</Typography></Box></Box>
          </Box>)}
        </Comparison>}
      </Box>}
      <Alert severity="info">{t("business:invoice_match_preserve")}</Alert>
    </Stack>
  </BaseModal>;
}
