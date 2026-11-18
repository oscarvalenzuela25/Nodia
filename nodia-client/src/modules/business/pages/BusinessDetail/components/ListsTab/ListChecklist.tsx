import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Checkbox, LinearProgress, Stack, Typography } from "@mui/material";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import { visuallyHidden } from "@mui/utils";
import { Skeleton } from "boneyard-js/react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent } from "react";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import { notifyHttpError } from "../../../../../../config/httpFeedback";
import { isShoppingListScopeError, isUncertainListWrite, shoppingListHttpStatus, updateListCheck } from "./infrastructure/services";
import type { ShoppingListDetail, ShoppingListItem, ShoppingListSummary } from "./infrastructure/services";
import { shoppingListKeys, useHasListScope, useListScopeGuard, useShoppingListDetail } from "./infrastructure/useServices";
import type { ShoppingListScope } from "./infrastructure/useServices";
import { formatListQuantity } from "./listDraft";
import { mergeListMark } from "./listMarks";
import {
  CheckControl, ChecklistDrawer, ChecklistProgress, ChecklistTitleIcon, CheckRow,
  DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, TouchIconButton,
} from "./styles";

interface ChecklistProps {
  scope: ShoppingListScope;
  selected: ShoppingListSummary;
  onClose: () => void;
}

export default function ListChecklist({ scope, selected, onClose }: ChecklistProps) {
  const { t } = useTranslation(["business", "core"]);
  const titleId = useId();
  const progressId = useId();
  const active = useHasListScope(scope);
  const detail = useShoppingListDetail(scope, selected.id, true);
  const [accessLost, setAccessLost] = useState(false);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const focusTicket = useRef(0);
  const visibleDetail = !accessLost && !isShoppingListScopeError(detail.error) ? detail.data : undefined;
  const items = visibleDetail?.items;
  const marked = items?.filter(item => item.checked).length ?? 0;

  const refresh = async () => {
    const result = await detail.refetch({ cancelRefetch: false });
    if (result.isError) return undefined;
    setAccessLost(false);
    return result.data;
  };

  const captureFocus = (row: HTMLLIElement | null) => {
    const origin = document.activeElement;
    if (!origin || !row?.contains(origin)) return undefined;
    const ticket = ++focusTicket.current;
    return (target: HTMLElement | null) => {
      requestAnimationFrame(() => {
        const current = document.activeElement;
        if (!closeButton.current || ticket !== focusTicket.current ||
            (current !== origin && current !== document.body && current !== closeButton.current.closest("[role=dialog]"))) return;
        (target?.isConnected ? target : closeButton.current).focus();
      });
    };
  };

  return <ChecklistDrawer
    anchor="right"
    open
    onClose={onClose}
    slotProps={{ paper: {
      role: "dialog", "aria-modal": true, "aria-labelledby": titleId,
      onFocusCapture: (event: FocusEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget) focusTicket.current += 1;
      },
    } }}
  >
    <DrawerHeader>
      <DrawerTitle>
        <ChecklistTitleIcon aria-hidden="true"><ChecklistOutlinedIcon /></ChecklistTitleIcon>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">{t("business:market_lists.checklist")}</Typography>
          <Typography id={titleId} component="h2" variant="h5" sx={theme => ({
            fontWeight: 700,
            [theme.breakpoints.down("sm")]: { fontSize: theme.typography.h6.fontSize },
          })}>
            {visibleDetail?.name ?? selected.name}
          </Typography>
        </Box>
        <TouchIconButton ref={closeButton} aria-label={t("core:close")} onClick={onClose} autoFocus>
          <CloseOutlinedIcon />
        </TouchIconButton>
      </DrawerTitle>
      {items && items.length > 0 && <ChecklistProgress>
        <Typography id={progressId} variant="body2" sx={{ fontWeight: 600 }} role="status">
          {t("business:market_lists.marked", { marked, count: items.length })}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={100 * marked / items.length}
          color={marked === items.length ? "success" : "primary"}
          aria-label={t("business:market_lists.checked_progress")}
          aria-describedby={progressId}
          sx={{ height: 6, borderRadius: 99 }}
        />
      </ChecklistProgress>}
    </DrawerHeader>
    <DrawerContent aria-busy={detail.isFetching}>
      <QueryErrorAlert isError={detail.isError || accessLost} isFetching={detail.isFetching} onRetry={refresh} />
      <Skeleton loading={detail.isLoading} fallback={<Stack aria-hidden="true" sx={{ gap: 1 }}>
        {[0, 1, 2].map(index => <Box key={index} sx={{ height: 58, borderRadius: 1.5, bgcolor: "action.hover" }} />)}
      </Stack>}>
        {items && (items.length > 0 ? (
            <Stack component="ul" sx={{ p: 0, m: 0, gap: 1, listStyle: "none" }}>
              {items.map(item => <ChecklistItem
                key={item.id}
                scope={scope}
                listId={selected.id}
                item={item}
                querying={!active || detail.isFetching}
                refresh={refresh}
                pauseAccess={() => setAccessLost(true)}
                captureFocus={captureFocus}
              />)}
            </Stack>
          ) : <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            {t("business:market_lists.empty_items")}
          </Typography>)}
      </Skeleton>
    </DrawerContent>
    {items && items.length > 0 && <DrawerFooter>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <CheckCircleOutlineOutlinedIcon fontSize="small" />
        <Typography variant="body2">{t("business:market_lists.auto_save")}</Typography>
      </Stack>
    </DrawerFooter>}
  </ChecklistDrawer>;
}

type ChecklistItemProps = {
  scope: ShoppingListScope;
  listId: string;
  item: ShoppingListItem;
  querying: boolean;
  refresh: () => Promise<ShoppingListDetail | undefined>;
  pauseAccess: () => void;
  captureFocus: (row: HTMLLIElement | null) => ((target: HTMLElement | null) => void) | undefined;
};

function ChecklistItem({ scope, listId, item, querying, refresh, pauseAccess, captureFocus }: ChecklistItemProps) {
  const { t, i18n } = useTranslation(["business", "core"]);
  const rowId = useId();
  const nameId = `${rowId}-name`;
  const quantityId = `${rowId}-quantity`;
  const unavailableId = `${rowId}-unavailable`;
  const quantity = formatListQuantity(item.quantity, i18n.resolvedLanguage ?? i18n.language);
  const queryClient = useQueryClient();
  const canUseResult = useListScopeGuard(scope);
  const inFlight = useRef(false);
  const rowElement = useRef<HTMLLIElement | null>(null);
  const checkbox = useRef<HTMLInputElement | null>(null);
  const retryButton = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef<((target: HTMLElement | null) => void) | undefined>(undefined);
  const [settled, setSettled] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [retry, setRetry] = useState<{ checked: boolean; needsRead: boolean }>();
  const mark = useMutation({
    retry: false,
    mutationFn: (payload: { checked: boolean; check_version: number }) =>
      updateListCheck(scope.businessId, listId, item.id, payload),
  });

  const recheck = async (wanted: boolean) => {
    setRecovering(true);
    try {
      const current = await refresh();
      if (canUseResult()) {
        const row = current?.items.find(entry => entry.id === item.id);
        setRetry(current ? (row && row.checked !== wanted ? { checked: wanted, needsRead: false } : undefined) : { checked: wanted, needsRead: true });
      }
    } finally {
      if (canUseResult()) setRecovering(false);
    }
  };

  const save = async (checked: boolean) => {
    if (!canUseResult() || inFlight.current || querying || mark.isPending || recovering) return;
    inFlight.current = true;
    restoreFocus.current = captureFocus(rowElement.current);
    try {
      if (retry?.needsRead) {
        await recheck(retry.checked);
        return;
      }
      setRetry(undefined);
      if (checked === item.checked) return;
      const result = await mark.mutateAsync({ check_version: item.check_version, checked });
      if (!canUseResult()) return;
      queryClient.setQueryData<ShoppingListDetail>(shoppingListKeys.detail(scope, listId), old => old && ({
        ...old, items: old.items.map(entry => mergeListMark(entry, result)),
      }));
      sileo.success({ title: t("business:market_lists.check_saved") });
    } catch (error) {
      if (!canUseResult()) return;
      notifyHttpError(error);
      const status = shoppingListHttpStatus(error);
      if (status === 401 || status === 403) {
        pauseAccess();
        void queryClient.invalidateQueries({ queryKey: shoppingListKeys.list(scope) });
        void refresh();
      } else if (status === 409 || status === 404 || isUncertainListWrite(error)) {
        await recheck(checked);
      } else {
        setRetry({ checked, needsRead: false });
      }
    } finally {
      inFlight.current = false;
      if (canUseResult()) setSettled(previous => previous + 1);
    }
  };

  const busy = mark.isPending || recovering;
  useLayoutEffect(() => {
    if (busy || querying || inFlight.current || !restoreFocus.current) return;
    restoreFocus.current(checkbox.current?.disabled ? retryButton.current : checkbox.current);
    restoreFocus.current = undefined;
  }, [busy, querying, settled]);
  useLayoutEffect(() => () => { restoreFocus.current?.(null); }, []);

  return <CheckRow ref={rowElement}>
    <CheckControl
      disableTypography
      control={<Checkbox
        checked={item.checked}
        color="success"
        disabled={busy || querying || Boolean(retry?.needsRead)}
        onChange={(_, checked) => { void save(checked); }}
        slotProps={{ input: {
          ref: checkbox,
          "aria-labelledby": nameId,
          "aria-describedby": item.available ? quantityId : `${quantityId} ${unavailableId}`,
        } }}
        sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
      />}
      label={<Box component="span" sx={{ minWidth: 0, flex: 1, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 1 }}>
        <Box component="span" sx={{ display: "grid", minWidth: 0 }}>
          <Typography id={nameId} component="span" variant="body2" sx={{ fontWeight: 600, textDecoration: item.checked ? "line-through" : "none" }}>
            {item.name}
          </Typography>
          {!item.available && <Typography id={unavailableId} component="span" variant="caption" color="text.secondary">
            {t("business:market_lists.unavailable")}
          </Typography>}
        </Box>
        <Typography component="span" variant="body2" aria-hidden="true" sx={{ bgcolor: "action.hover", px: 1, py: 0.5, borderRadius: 1, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          × {quantity}
        </Typography>
        <Box component="span" id={quantityId} sx={visuallyHidden}>
          {t("business:market_lists.checked_quantity", { quantity })}
        </Box>
      </Box>}
    />
    {busy && <Typography variant="caption" role="status" sx={{ display: "block", mt: 0.5, px: 1, color: "text.secondary" }}>
      {t(recovering ? "business:market_lists.reconciling_check" : "business:market_lists.saving_check")}
    </Typography>}
    {retry && !busy && <Alert severity="warning" sx={{ mt: 0.5, flexWrap: "wrap", "& .MuiAlert-message": { flex: "1 1 140px" } }} action={
      <Button ref={retryButton} color="inherit" variant="outlined" size="small" disabled={querying} onClick={() => void save(retry.checked)}>
        {t("core:retry")}
      </Button>
    }>{t(retry.needsRead ? "business:market_lists.check_needs_read" : "business:market_lists.check_retry")}</Alert>}
  </CheckRow>;
}
