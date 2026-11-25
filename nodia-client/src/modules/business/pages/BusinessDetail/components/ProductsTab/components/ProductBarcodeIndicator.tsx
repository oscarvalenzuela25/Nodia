import { useTranslation } from "react-i18next";
import { StatusDot } from "../../../styles";

export default function ProductBarcodeIndicator({ barcode }: { barcode?: string | null }) {
  const { t } = useTranslation("business");
  const present = Boolean(barcode?.trim());
  const label = t(present ? "product_barcode_present" : "product_barcode_missing");

  return <StatusDot active={present} role="img" aria-label={label} title={label} />;
}
