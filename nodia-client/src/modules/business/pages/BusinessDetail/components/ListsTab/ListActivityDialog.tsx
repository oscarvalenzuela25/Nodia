import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, LinearProgress, Stack } from "@mui/material";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import { notifyHttpError } from "../../../../../../config/httpFeedback";
import { isUncertainListWrite, shoppingListHttpStatus, updateListActivity } from "./infrastructure/services";
import type { ShoppingListSummary } from "./infrastructure/services";
import { shoppingListKeys, useHasListScope, useListScopeGuard, useShoppingListDetail } from "./infrastructure/useServices";
import type { ShoppingListScope } from "./infrastructure/useServices";

export default function ListActivityDialog({ scope, selected, onClose }: {
  scope: ShoppingListScope;
  selected: ShoppingListSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation(["business", "core"]);
  const active = useHasListScope(scope);
  const canUseResult = useListScopeGuard(scope);
  const client = useQueryClient();
  const current = useShoppingListDetail(scope, selected.id);
  const inFlight = useRef(false);
  const desired = !selected.is_active;
  const alreadyChanged = current.data?.is_active === desired;
  const actionLabel = t(desired ? "business:market_lists.activate" : "business:market_lists.deactivate");
  const mutation = useMutation({
    retry: false,
    mutationFn: (version: number) => updateListActivity(scope.businessId, selected.id, { version, is_active: desired }),
  });

  const confirm = async () => {
    if (!active || !canUseResult() || inFlight.current || !current.data || current.isError || current.isFetching || alreadyChanged) return;
    inFlight.current = true;
    try {
      await mutation.mutateAsync(current.data.version);
      if (!canUseResult()) return;
      void client.invalidateQueries({ queryKey: shoppingListKeys.list(scope) });
      void client.invalidateQueries({ queryKey: shoppingListKeys.detail(scope, selected.id) });
      sileo.success({ title: t(desired ? "business:market_lists.activated" : "business:market_lists.deactivated") });
      onClose();
    } catch (error) {
      if (!canUseResult()) return;
      notifyHttpError(error);
      const status = shoppingListHttpStatus(error);
      if (status === 409 || status === 404 || status === 401 || status === 403 || isUncertainListWrite(error)) {
        void client.invalidateQueries({ queryKey: shoppingListKeys.list(scope) });
        await current.refetch();
      }
    } finally {
      inFlight.current = false;
    }
  };

  return <ConfirmDialog
    open
    onClose={onClose}
    title={actionLabel}
    message={t(desired ? "business:market_lists.activate_confirmation" : "business:market_lists.deactivate_confirmation", { name: selected.name })}
    confirmText={actionLabel}
    cancelText={alreadyChanged && !current.isError ? t("core:close") : undefined}
    onConfirm={confirm}
    isLoading={mutation.isPending}
    confirmDisabled={!active || !current.data || current.isFetching || current.isError || alreadyChanged}
  >
    <Stack sx={{ gap: 1, mt: 1 }}>
      {current.isFetching && <LinearProgress aria-label={t("business:market_lists.loading")} />}
      <QueryErrorAlert isError={current.isError} isFetching={current.isFetching} onRetry={current.refetch} />
      {alreadyChanged && !current.isError && <Alert severity="info">{t("business:market_lists.activity_already_changed")}</Alert>}
    </Stack>
  </ConfirmDialog>;
}
