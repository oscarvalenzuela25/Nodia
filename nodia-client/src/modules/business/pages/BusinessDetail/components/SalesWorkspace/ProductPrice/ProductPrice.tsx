import { useTranslation } from "react-i18next";
import { formatClp, moneyInteger } from "../../../../../infrastructure/salesPolicies";
import { Amount, OfferChip, Price, RegularAmount } from "./styles";
import type { MeasurementUnit } from "../../../../../infrastructure/measurementUnits";

export interface ProductPriceProps {
  price: string | number | null | undefined;
  regularPrice: string | number | null | undefined;
  onOffer: boolean;
  measurementUnit?: MeasurementUnit;
}

export default function ProductPrice({ price, regularPrice, onOffer, measurementUnit }: ProductPriceProps) {
  const { t, i18n } = useTranslation(["business", "product"]);
  const selected = moneyInteger(price);
  const regular = moneyInteger(regularPrice);
  const display = (value: string) => measurementUnit ? t("product:price_per_unit", { price: formatClp(value, i18n.language), unit: t(`product:units_price.${measurementUnit}`) }) : formatClp(value, i18n.language);
  return <Price>
    {onOffer && <OfferChip size="small" variant="outlined" label={t("business:pos.offer")} />}
    <Amount onOffer={onOffer}>{selected === null ? t("business:pos.catalog_price_unavailable") : display(selected)}</Amount>
    {onOffer && regular !== null && <RegularAmount variant="body2">{t("business:pos.regular_price")}: {display(regular)}</RegularAmount>}
  </Price>;
}
