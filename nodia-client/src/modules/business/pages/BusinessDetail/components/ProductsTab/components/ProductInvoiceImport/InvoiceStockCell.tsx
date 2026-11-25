import { useId } from "react";
import { Box, IconButton, TableCell, Tooltip, Typography } from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import SyncAltOutlinedIcon from "@mui/icons-material/SyncAltOutlined";
import { visuallyHidden } from "@mui/utils";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import { invoiceStockQuantity, type evaluateInvoiceStock, type InvoiceStockReview } from "./invoiceStock";

type Props = {
  name: string;
  invoicedQuantity: number;
  review?: InvoiceStockReview;
  result: ReturnType<typeof evaluateInvoiceStock>;
  disabled: boolean;
  onChange: (update: (review: InvoiceStockReview) => InvoiceStockReview) => void;
};

export default function InvoiceStockCell({ name, invoicedQuantity, review, result, disabled, onChange }: Props) {
  const { t, i18n } = useTranslation("business");
  const inputId = useId();
  if (!review?.tracking) return <TableCell align="right">—</TableCell>;

  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const mode = t(review.mode === "add" ? "ocr_stock_add" : "ocr_stock_replace");
  const format = (value: number | null) => value === null ? "—" :
    value.toLocaleString(i18n.language, { maximumFractionDigits: 3 });

  return (
    <TableCell sx={{ minWidth: 160 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Box sx={{ position: "relative", fontSize: "0.875rem", width: "calc(4ch + 28px)", flexShrink: 0 }}>
          <Box component="label" htmlFor={inputId} sx={visuallyHidden}>
            {t("ocr_stock_amount")}
          </Box>
          <TextInput
            id={inputId}
            inputMode="decimal"
            value={invoiceStockQuantity(review, invoicedQuantity)}
            disabled={disabled}
            error={Boolean(result.error)}
            aria-describedby={result.error ? errorId : descriptionId}
            onChange={(event) => {
              const quantity = event.target.value;
              onChange((current) => ({ ...current, quantity }));
            }}
          />
        </Box>
        <Tooltip title={mode}>
          <Box component="span" sx={{ display: "inline-flex" }}>
            <IconButton
              type="button"
              aria-label={t("ocr_stock_mode_for_product", { mode, name })}
              disabled={disabled}
              onClick={() => onChange((current) => ({
                ...current, mode: current.mode === "add" ? "replace" : "add",
              }))}
              sx={{ width: 44, height: 44 }}
            >
              {review.mode === "add" ? <AddOutlinedIcon /> : <SyncAltOutlinedIcon />}
            </IconButton>
          </Box>
        </Tooltip>
      </Box>
      {result.error && (
        <Typography id={errorId} component="p" variant="caption" color="error" sx={{ mt: 0.5 }}>
          {t(result.error)}
        </Typography>
      )}
      <Typography id={descriptionId} variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {mode} · {t("ocr_stock_current", { balance: format(review.observedBalance) })}
        {!result.error && result.projectedBalance !== undefined &&
          <> · {t("ocr_stock_projected", { balance: format(result.projectedBalance) })}</>}
      </Typography>
    </TableCell>
  );
}
