import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import { PriceDivisionAction } from "../../../../../../../../../components/PriceDivisionDialog";
import { roundSalePrice } from "../../../../../../../../../utils/salePrice";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, IconButton, Tooltip } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import BaseModal from "../../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../../components/inputs/TextInput";
import { PRODUCT_PRICE_MAX } from "../../ProductModal/productPricing";
import { Actions, Content } from "./styles";

const schema = z.object({
  sale_price: z.string().trim().refine(value => /^\d+$/.test(value) && Number(value) <= PRODUCT_PRICE_MAX && roundSalePrice(Number(value)) !== null,
    "business:invoice_validation_sale"),
});
type PriceForm = z.infer<typeof schema>;

interface Props {
  price: number;
  disabled: boolean;
  onApply: (price: number) => boolean;
  onClose: () => void;
}

export default function InvoicePriceReview({ price, disabled, onApply, onClose }: Props) {
  const { t } = useTranslation();
  const { control, handleSubmit, setValue, formState: { isValid } } = useForm<PriceForm>({
    resolver: zodResolver(schema), mode: "onChange",
    defaultValues: { sale_price: Number.isFinite(price) ? String(price) : "" },
  });
  const apply = handleSubmit(values => {
    const rounded = roundSalePrice(Number(values.sale_price));
    if (!disabled && rounded !== null && onApply(rounded)) onClose();
  });
  return <BaseModal open size="sm" title={t("business:invoice_sale_price_review_title")}
    onClose={() => { if (!disabled) onClose(); }} showCloseButton={!disabled}
    actions={<Actions>
      <Button variant="outlined" disabled={disabled} onClick={onClose}>{t("core:cancel")}</Button>
      <Button variant="contained" data-testid="save-invoice-price" disabled={disabled || !isValid} onClick={() => void apply()}>{t("core:save")}</Button>
    </Actions>}>
    <Content onSubmit={apply}>
      <Controller name="sale_price" control={control} render={({ field, fieldState }) => <TextInput
        {...field} id="invoice-sale-price" type="number" label={t("business:product_sale_price")}
        labelAdornment={<><Tooltip title={t("business:product_field_help_sale_price")}><IconButton type="button" disabled={disabled} aria-label={t("business:pos.field_help_label", { field: t("business:product_sale_price") })} sx={{ width: 44, height: 44, flexShrink: 0 }}><HelpOutlineOutlinedIcon fontSize="small" /></IconButton></Tooltip>
          <PriceDivisionAction value={field.value.trim() ? Number(field.value) : null} mode="sale" label={t("business:product_sale_price")} disabled={disabled} onApply={value => setValue("sale_price", String(value), { shouldDirty: true, shouldValidate: true })} /></>}
        onBlur={() => { field.onBlur(); if (field.value.trim()) { const rounded = roundSalePrice(Number(field.value)); if (rounded !== null) setValue("sale_price", String(rounded), { shouldDirty: true, shouldValidate: true }); } }}
        disabled={disabled} required error={!!fieldState.error}
        helperText={fieldState.error ? t("business:invoice_validation_sale") : undefined} />}/>
    </Content>
  </BaseModal>;
}
