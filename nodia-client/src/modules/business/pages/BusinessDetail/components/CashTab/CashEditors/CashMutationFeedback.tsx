import { Alert, Box, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { CashMutationOutcome } from "../../../../../infrastructure/cashTypes";

export function CashMutationFeedback({
  outcome,
  busy,
  onRecover,
  onRetry,
}: {
  outcome: CashMutationOutcome | undefined;
  busy: boolean;
  onRecover: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation("business");
  if (!outcome || outcome.status === "committed" || outcome.status === "rejected") return null;
  return (
    <Alert severity="info" role="status" sx={{ "& .MuiAlert-message": { minWidth: 0 } }}>
      {t(
        outcome.status === "retryable"
          ? "business:cash.receipt_retryable"
          : "business:cash.receipt_pending",
      )}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
        <Button color="inherit" disabled={busy} onClick={onRecover} sx={{ minHeight: 44 }}>
          {t("business:cash.receipt_check")}
        </Button>
        {(outcome.status === "retryable" || outcome.status === "unconfirmed") && (
          <Button color="inherit" disabled={busy} onClick={onRetry} sx={{ minHeight: 44 }}>
            {t("business:cash.receipt_retry")}
          </Button>
        )}
      </Box>
    </Alert>
  );
}
