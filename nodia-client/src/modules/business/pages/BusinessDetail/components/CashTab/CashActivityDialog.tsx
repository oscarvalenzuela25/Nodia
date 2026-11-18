import { useState } from "react";
import { Alert, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import type { CashScope, CashMovement, CashMutationOutcome } from "../../../../infrastructure/cashTypes";
import { useCashMovement, useCashMutation } from "../../../../infrastructure/useCashServices";
import { isCashVersionConflict } from "./CashEditors";
import { cashMovementName } from "./cashLabels";

interface Props {
  scope: CashScope;
  movement: CashMovement;
  disabled: boolean;
  onClose: () => void;
}

export function CashActivityDialog({ scope, movement, disabled, onClose }: Props) {
  const { t } = useTranslation(["business", "core"]);
  const mutation = useCashMutation(scope);
  const [reviewed, setReviewed] = useState(movement);
  const current = useCashMovement(scope, movement.id, false);
  const desired = !movement.is_active;
  const conflict = isCashVersionConflict(mutation.outcome);

  const track = async (action: () => Promise<CashMutationOutcome | undefined>) => {
    if ((await action())?.status === "committed") onClose();
  };

  const review = async () => {
    if (disabled || current.isFetching) return;
    const { data, isSuccess } = await current.refetch();
    if (!isSuccess || !data) return;
    setReviewed(data);
    mutation.reset();
  };

  return (
    <ConfirmDialog
      open
      title={t(desired ? "business:cash.activate_movement" : "business:cash.deactivate_movement")}
      message={t("business:cash.confirm_movement_activity", { name: cashMovementName(reviewed, t) })}
      confirmText={t(desired ? "business:action_activate" : "business:action_deactivate")}
      onClose={() => { if (!mutation.pending && !mutation.busy && !current.isFetching) onClose(); }}
      onConfirm={() => track(() => mutation.pending
        ? mutation.retry()
        : mutation.submit({
          operation: "movement_update",
          id: movement.id,
          fields: { expected_version: reviewed.version, is_active: desired },
        }))}
      showCloseButton={!mutation.pending}
      isLoading={mutation.busy || current.isFetching}
      cancelDisabled={mutation.pending}
      confirmDisabled={disabled || conflict}
    >
      {conflict && (
        <Alert variant="outlined" severity="warning" action={
          <Button onClick={() => void review()} disabled={disabled || current.isFetching}>
            {t("business:cash.review_current")}
          </Button>
        }>
          {t("business:cash.version_changed")}
        </Alert>
      )}
      {reviewed !== movement && (
        <Alert severity="info">
          {t("business:cash.current_activity", {
            status: t(reviewed.is_active ? "business:status_active" : "business:status_inactive"),
          })}
        </Alert>
      )}
    </ConfirmDialog>
  );
}
