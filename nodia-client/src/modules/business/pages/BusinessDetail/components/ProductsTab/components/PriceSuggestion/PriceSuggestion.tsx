import { useId, useState } from "react";
import { Box, InputAdornment, Tooltip, Typography } from "@mui/material";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import { visuallyHidden } from "@mui/utils";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import { suggestedProductPrice } from "../ProductModal/productPricing";
import { ApplyButton, ApplyButtonSlot, MarkupField, PriceResult, Suggestion, SuggestionLayout } from "./styles";

export interface PriceSuggestionProps {
  costPriceTax: number | null;
  disabled?: boolean;
  onApply: (salePrice: number) => void;
}

/** The suggested markup belongs only to this editor, never to a product. */
export default function PriceSuggestion({ costPriceTax, disabled = false, onApply }: PriceSuggestionProps) {
  const { t, i18n } = useTranslation("business");
  const descriptionId = useId();
  const [markup, setMarkup] = useState("30");
  const percentage = markup.trim() === "" ? Number.NaN : Number(markup.replace(",", "."));
  const price = suggestedProductPrice(costPriceTax, percentage);
  return <Suggestion><SuggestionLayout>
    <MarkupField>
      <TextInput label={t("product_suggested_markup_short")} inputMode="decimal" value={markup}
        aria-describedby={descriptionId} endAdornment={<InputAdornment position="end">%</InputAdornment>}
        onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
        onChange={(event) => setMarkup(event.target.value)} disabled={disabled}
        error={!Number.isFinite(percentage) || percentage < 0} data-testid="product-suggested-markup-input" />
      <Box component="span" id={descriptionId} sx={visuallyHidden}>{t("product_suggested_markup")}</Box>
    </MarkupField>
    <PriceResult>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{t("product_suggested_price")}</Typography>
      <Typography variant="body2" role="status" sx={{ display: "flex", alignItems: "center", fontWeight: price === null ? 400 : 700, color: price === null ? "text.secondary" : "text.primary", whiteSpace: price === null ? "normal" : "nowrap" }}>
        {price === null ? t("product_suggestion_unavailable") : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(price)}
      </Typography>
    </PriceResult>
    <Tooltip title={t("product_use_suggested_price")}>
      <ApplyButtonSlot>
        <ApplyButton type="button" aria-label={t("product_use_suggested_price")} disabled={disabled || price === null} onClick={() => {
          if (disabled || price === null) return;
          onApply(price);
          sileo.success({ title: t("product_suggestion_applied") });
        }}><ArrowDownwardRounded fontSize="small" /></ApplyButton>
      </ApplyButtonSlot>
    </Tooltip>
  </SuggestionLayout></Suggestion>;
}
