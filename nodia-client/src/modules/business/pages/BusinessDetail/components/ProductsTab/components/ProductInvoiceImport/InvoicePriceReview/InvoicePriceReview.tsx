import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import BaseModal from "../../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../../components/inputs/TextInput";
import { PRODUCT_PRICE_MAX } from "../../ProductModal/productPricing";
import { Actions, Content } from "./styles";

const schema = z.object({
  sale_price: z.string().trim().refine(value => /^\d+$/.test(value) && Number(value) <= PRODUCT_PRICE_MAX,
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
  const { control, handleSubmit, formState: { isValid } } = useForm<PriceForm>({
    resolver: zodResolver(schema), mode: "onChange",
    defaultValues: { sale_price: Number.isFinite(price) ? String(price) : "" },
  });
  const apply = handleSubmit(values => {
    if (!disabled && onApply(Number(values.sale_price))) onClose();
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
        disabled={disabled} required error={!!fieldState.error}
        helperText={fieldState.error ? t("business:invoice_validation_sale") : undefined} />}/>
    </Content>
  </BaseModal>;
}
