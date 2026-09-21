import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button, Grid } from "@mui/material";

import BaseModal from "../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../../../components/inputs/SelectSingleInput";
import type { ProductEntity, ProviderEntity } from "../../../../../../infrastructure/types";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";

const productSchema = z.object({
  code: z.string().min(1, "Código requerido"),
  name: z.string().min(1, "Nombre requerido"),
  cost_price: z.number().min(0, "Costo debe ser >= 0"),
  cost_price_tax: z.number().min(0, "Impuesto debe ser >= 0"),
  profit_percentage: z.number().min(0, "Margen debe ser >= 0"),
  sale_price: z.number().min(0, "Precio venta debe ser >= 0"),
  stock: z.number().min(0, "Stock debe ser >= 0"),
  provider_id: z.string().optional().nullable(),
  is_active: z.boolean(),
});

export type ProductFormData = z.infer<typeof productSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => Promise<void>;
  initialData?: ProductEntity | null;
  providers?: ProviderEntity[];
  isSubmitting?: boolean;
}

export const ProductModal: FC<Props> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  providers = [],
  isSubmitting = false,
}) => {
  const { t } = useTranslation(["business", "core"]);

  const [prevInitialData, setPrevInitialData] = useState(initialData);
  const [taxRate, setTaxRate] = useState<number>(() => {
    if (initialData && initialData.cost_price > 0 && initialData.cost_price_tax > 0) {
      const derivedTax = Math.round(
        ((initialData.cost_price_tax - initialData.cost_price) / initialData.cost_price) * 100
      );
      return derivedTax >= 0 ? derivedTax : 19;
    }
    return 19;
  });

  if (prevInitialData !== initialData) {
    setPrevInitialData(initialData);
    if (initialData && initialData.cost_price > 0 && initialData.cost_price_tax > 0) {
      const derivedTax = Math.round(
        ((initialData.cost_price_tax - initialData.cost_price) / initialData.cost_price) * 100
      );
      setTaxRate(derivedTax >= 0 ? derivedTax : 19);
    } else {
      setTaxRate(19);
    }
  }

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: "",
      name: "",
      cost_price: 0,
      cost_price_tax: 0,
      profit_percentage: 30,
      sale_price: 0,
      stock: 0,
      provider_id: null,
      is_active: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code,
        name: initialData.name,
        cost_price: initialData.cost_price,
        cost_price_tax: initialData.cost_price_tax,
        profit_percentage: initialData.profit_percentage,
        sale_price: initialData.sale_price,
        stock: initialData.stock,
        provider_id: initialData.provider_id || null,
        is_active: initialData.is_active,
      });
    } else {
      reset({
        code: "",
        name: "",
        cost_price: 0,
        cost_price_tax: 0,
        profit_percentage: 30,
        sale_price: 0,
        stock: 0,
        provider_id: null,
        is_active: true,
      });
    }
  }, [initialData, reset]);

  // Handlers for interconnected recalculations
  const handleCostPriceChange = (val: number) => {
    setValue("cost_price", val, { shouldValidate: true });
    const computedTaxCost = Math.round(val * (1 + taxRate / 100));
    setValue("cost_price_tax", computedTaxCost, { shouldValidate: true });
    const margin = getValues("profit_percentage") ?? 30;
    const computedSale = Math.round(computedTaxCost * (1 + margin / 100));
    setValue("sale_price", computedSale, { shouldValidate: true });
  };

  const handleTaxRateChange = (val: number) => {
    setTaxRate(val);
    const currentCost = getValues("cost_price") || 0;
    const computedTaxCost = Math.round(currentCost * (1 + val / 100));
    setValue("cost_price_tax", computedTaxCost, { shouldValidate: true });
    const margin = getValues("profit_percentage") ?? 30;
    const computedSale = Math.round(computedTaxCost * (1 + margin / 100));
    setValue("sale_price", computedSale, { shouldValidate: true });
  };

  const handleCostPriceTaxChange = (val: number) => {
    setValue("cost_price_tax", val, { shouldValidate: true });
    const computedCost = Math.round(val / (1 + taxRate / 100));
    setValue("cost_price", computedCost, { shouldValidate: true });
    const margin = getValues("profit_percentage") ?? 30;
    const computedSale = Math.round(val * (1 + margin / 100));
    setValue("sale_price", computedSale, { shouldValidate: true });
  };

  const handleProfitMarginChange = (val: number) => {
    setValue("profit_percentage", val, { shouldValidate: true });
    const taxCost = getValues("cost_price_tax") || 0;
    const computedSale = Math.round(taxCost * (1 + val / 100));
    setValue("sale_price", computedSale, { shouldValidate: true });
  };

  const handleSalePriceChange = (val: number) => {
    setValue("sale_price", val, { shouldValidate: true });
    const taxCost = getValues("cost_price_tax") || 0;
    if (taxCost > 0) {
      const computedMargin = Math.round(((val - taxCost) / taxCost) * 100);
      setValue("profit_percentage", Math.max(0, computedMargin), { shouldValidate: true });
    }
  };

  const providerOptions = useMemo(() => {
    return providers.map((p) => ({
      value: p.id,
      label: p.name,
    }));
  }, [providers]);

  const modalActions = (
    <ModalActionsContainer>
      <Button
        variant="contained"
        color="error"
        onClick={onClose}
        disabled={isSubmitting}
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("business:cancel")}
      </Button>
      <Button
        variant="contained"
        color="primary"
        type="submit"
        form="product-form"
        disabled={isSubmitting}
        data-testid="save-product-btn"
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("business:save")}
      </Button>
    </ModalActionsContainer>
  );

  const onFormSubmit = async (data: ProductFormData) => {
    await onSubmit(data);
  };

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={
        initialData
          ? t("business:edit_product_modal_title")
          : t("business:new_product_modal_title")
      }
      size="md"
      actions={modalActions}
    >
      <FormContainer
        id="product-form"
        onSubmit={handleSubmit(onFormSubmit)}
      >
        {/* is_active Switch at top, matching Core pattern */}
        <SwitchWrapper>
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <StyledFormControlLabel
                control={
                  <StyledSwitch
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    name="is_active"
                    disabled={isSubmitting}
                    data-testid="product-active-switch"
                  />
                }
                label={t("business:active_label")}
                labelPlacement="start"
              />
            )}
          />
        </SwitchWrapper>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="code"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="product-code"
                  name={field.name}
                  label={t("business:product_code")}
                  placeholder="SKU-1001"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={!!errors.code}
                  helperText={errors.code?.message}
                  required
                  disabled={isSubmitting}
                  data-testid="product-code-input"
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="product-name"
                  name={field.name}
                  label={t("business:product_name")}
                  placeholder="Ej: Teclado Mecánico RGB"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  required
                  disabled={isSubmitting}
                  data-testid="product-name-input"
                />
              )}
            />
          </Grid>

          {/* Row 2: Costo Base sin Impuesto, Impuesto % auxiliar, Costo Base con Impuestos */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <Controller
              name="cost_price"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="product-cost-price"
                  name={field.name}
                  type="number"
                  label={t("business:product_cost_price")}
                  value={String(field.value ?? 0)}
                  onChange={(e) => handleCostPriceChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  error={!!errors.cost_price}
                  helperText={errors.cost_price?.message}
                  required
                  disabled={isSubmitting}
                  data-testid="product-cost-price-input"
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextInput
              id="product-tax-rate"
              name="tax_rate"
              type="number"
              label={t("business:product_tax_rate")}
              value={String(taxRate)}
              onChange={(e) => handleTaxRateChange(Number(e.target.value))}
              disabled={isSubmitting}
              data-testid="product-tax-rate-input"
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Controller
              name="cost_price_tax"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="product-cost-tax"
                  name={field.name}
                  type="number"
                  label={t("business:product_cost_tax")}
                  value={String(field.value ?? 0)}
                  onChange={(e) => handleCostPriceTaxChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  error={!!errors.cost_price_tax}
                  helperText={errors.cost_price_tax?.message}
                  disabled={isSubmitting}
                  data-testid="product-cost-tax-input"
                />
              )}
            />
          </Grid>

          {/* Row 3: Margen % y Precio Venta */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="profit_percentage"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="product-profit-margin"
                  name={field.name}
                  type="number"
                  label={t("business:product_profit_margin")}
                  value={String(field.value ?? 0)}
                  onChange={(e) => handleProfitMarginChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  error={!!errors.profit_percentage}
                  helperText={errors.profit_percentage?.message}
                  disabled={isSubmitting}
                  data-testid="product-profit-margin-input"
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="sale_price"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="product-sale-price"
                  name={field.name}
                  type="number"
                  label={t("business:product_sale_price")}
                  value={String(field.value ?? 0)}
                  onChange={(e) => handleSalePriceChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  error={!!errors.sale_price}
                  helperText={errors.sale_price?.message}
                  required
                  disabled={isSubmitting}
                  data-testid="product-sale-price-input"
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="stock"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="product-stock"
                  name={field.name}
                  type="number"
                  label={t("business:product_stock")}
                  value={String(field.value ?? 0)}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  error={!!errors.stock}
                  helperText={errors.stock?.message}
                  required
                  disabled={isSubmitting}
                  data-testid="product-stock-input"
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="provider_id"
              control={control}
              render={({ field }) => (
                <SelectSingleInput
                  id="product-provider"
                  label={t("business:product_provider")}
                  options={providerOptions}
                  value={field.value || null}
                  onChange={(val) => field.onChange(val || null)}
                  placeholder={t("business:select_provider_optional")}
                  disabled={isSubmitting}
                  clearable
                  data-testid="product-provider-select"
                />
              )}
            />
          </Grid>
        </Grid>
      </FormContainer>
    </BaseModal>
  );
};

export default ProductModal;
