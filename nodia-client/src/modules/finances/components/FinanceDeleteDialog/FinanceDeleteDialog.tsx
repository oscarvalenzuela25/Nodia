import { useRef } from "react";
import { Alert } from "@mui/material";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import {
  useFinanceBusy,
  useFinanceDelete,
} from "../../infrastructure/useServices";
import type { FinanceResource } from "../../types";

export default function FinanceDeleteDialog({
  resource,
  record,
  onClose,
  onDeleted,
}: {
  resource: FinanceResource;
  record: { id: string; name: string };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const deletion = useFinanceDelete(resource);
  const busy = useFinanceBusy() || deletion.isPending || deletion.isReviewing;
  const submitting = useRef(false);
  const confirm = async () => {
    if (busy || submitting.current) return;
    submitting.current = true;
    try {
      if (deletion.isUncertain) {
        if (await deletion.reviewResult(record.id)) onDeleted();
      } else {
        await deletion.mutateAsync(record.id);
        onDeleted();
      }
    } catch {
      /* Hook owns feedback; preserve target on failure. */
    } finally {
      submitting.current = false;
    }
  };
  const consequence =
    resource === "obligations"
      ? "finance:delete_obligation_warning"
      : resource === "movements"
        ? "finance:delete_movement_warning"
        : resource === "categories"
          ? "finance:delete_category_warning"
          : "finance:delete_group_warning";
  return (
    <ConfirmDialog
      open
      title={t("finance:delete")}
      message={t("finance:confirm_delete", { name: record.name })}
      confirmText={t(
        deletion.isUncertain ? "finance:review_result" : "finance:delete",
      )}
      isLoading={busy}
      onClose={() => {
        if (!busy && !submitting.current) onClose();
      }}
      onConfirm={() => void confirm()}
    >
      <Alert severity="warning" sx={{ mt: 2 }}>
        {t(consequence)}
      </Alert>
      {deletion.isUncertain && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t("finance:uncertain_description")}
        </Alert>
      )}
    </ConfirmDialog>
  );
}
