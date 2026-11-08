import { useTranslation } from "react-i18next";
import type { MeasurementUnit } from "../../../../../../infrastructure/measurementUnits";
import { formatClp, moneyInteger } from "../../../../../../infrastructure/salesPolicies";
import { Amount, OfferAmount, Price } from "./styles";

interface Props {
  salePrice: number | null | undefined;
  measurementUnit?: MeasurementUnit;
  offerPrice?: number | null;
  offerEnabled?: boolean;
}

export default function ProductSalePrice({ salePrice, offerPrice, offerEnabled, measurementUnit = "unit" }: Props) {
  const { t, i18n } = useTranslation(["business", "product"]);
  const offer = typeof offerPrice === "number" && offerPrice <= 2147483647 ? moneyInteger(offerPrice) : null;
  const normal = moneyInteger(salePrice);
  const showOffer = offerEnabled === true && offer !== null;
  const perUnit = (price: string) => t("product:price_per_unit", { price: formatClp(price, i18n.language), unit: t(`product:units_price.${measurementUnit}`) });
  const regularAmount = normal === null ? "—" : perUnit(normal);

  return <Price>
    {showOffer && <OfferAmount>{t("business:product_offer_price", { price: perUnit(offer) })}</OfferAmount>}
    <Amount>{showOffer ? t("business:product_regular_price", { price: regularAmount }) : regularAmount}</Amount>
  </Price>;
}
