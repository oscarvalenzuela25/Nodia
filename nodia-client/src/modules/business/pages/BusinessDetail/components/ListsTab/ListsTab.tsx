import { useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Chip, LinearProgress, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
  useMediaQuery, useTheme,
} from "@mui/material";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Skeleton } from "boneyard-js/react";
import { useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import BaseModal from "../../../../../../components/BaseModal";
import InputSearch from "../../../../../../components/inputs/InputSearch";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import { TableSkeleton } from "../../../../../../components/skeletons";
import { notifyHttpError } from "../../../../../../config/httpFeedback";
import BusinessPagination from "../../../../components/BusinessPagination";
import { isShoppingListScopeError } from "./infrastructure/services";
import type { ShoppingListSummary } from "./infrastructure/services";
import {
  shoppingListDetailOptions,
  shoppingListKeys,
  useHasListScope,
  useOwnsListScope,
  useListScopeGuard,
  useShoppingLists,
} from "./infrastructure/useServices";
import type { ShoppingListScope } from "./infrastructure/useServices";
import ListActivityDialog from "./ListActivityDialog";
import ListChecklist from "./ListChecklist";
import ListEditor from "./ListEditor";
import { listClipboardText } from "./listDraft";
import { ListHeading, ListMobileCard, ListPanel, ListToolbar, TouchIconButton } from "./styles";

type ListOverlay =
  | { kind: "new" }
  | { kind: "edit" | "checklist" | "activity"; selected: ShoppingListSummary }
  | { kind: "copy"; text: string };
type RowAction = "edit" | "checklist" | "activity" | "copy";

const rowsPerPageOptions = [10, 20, 50, 100];

export default function ListsTab(scope: ShoppingListScope) {
  const { t, i18n } = useTranslation(["business", "core"]);
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));
  const client = useQueryClient();
  const active = useHasListScope(scope);
  const ownsScope = useOwnsListScope(scope);
  const canUseResult = useListScopeGuard(scope);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [overlay, setOverlay] = useState<ListOverlay>();
  const [copying, setCopying] = useState(false);
  const copyBusy = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const createButton = useRef<HTMLButtonElement | null>(null);
  const result = useShoppingLists(scope, page + 1, limit, search.trim());
  const data = !isShoppingListScopeError(result.error) ? result.data : undefined;
  const disabled = !active || result.isFetching || copying;
  const actionsDisabled = disabled || isShoppingListScopeError(result.error);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const title = t("business:market_lists.title");
  const emptyMessage = t(search.trim() ? "business:market_lists.no_results" : "business:market_lists.empty");
  const columns = [
    { header: t("business:market_lists.name") },
    { header: t("business:tab_products"), align: "right" as const },
    { header: t("business:market_lists.status"), align: "center" as const },
    { header: t("business:market_lists.actions"), align: "right" as const },
  ];

  const close = () => {
    setOverlay(undefined);
    requestAnimationFrame(() => {
      if (!canUseResult()) return;
      const origin = trigger.current;
      if (origin?.isConnected) origin.focus();
      else createButton.current?.focus();
    });
  };

  const open = (next: ListOverlay, event: MouseEvent<HTMLElement>) => {
    trigger.current = event.currentTarget;
    setOverlay(next);
  };

  const writeClipboard = async (text: string) => {
    if (!navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(text);
      if (canUseResult()) sileo.success({ title: t("business:market_lists.copied") });
      return true;
    } catch {
      return false;
    }
  };

  const copy = async (selected: ShoppingListSummary, event: MouseEvent<HTMLButtonElement>) => {
    if (copyBusy.current || !canUseResult()) return;
    copyBusy.current = true;
    trigger.current = event.currentTarget;
    setCopying(true);
    try {
      const detail = await client.fetchQuery(shoppingListDetailOptions(scope, selected.id));
      if (!canUseResult()) return;
      const text = listClipboardText(detail, locale);
      if (!text) {
        sileo.info({ title: t("business:market_lists.empty_items") });
      } else if (!(await writeClipboard(text)) && canUseResult()) {
        setOverlay({ kind: "copy", text });
      }
    } catch (error) {
      if (!canUseResult()) return;
      notifyHttpError(error);
      if (isShoppingListScopeError(error)) void client.invalidateQueries({ queryKey: shoppingListKeys.list(scope) });
    } finally {
      copyBusy.current = false;
      if (canUseResult()) setCopying(false);
    }
  };

  const handleAction = (kind: RowAction, list: ShoppingListSummary, event: MouseEvent<HTMLButtonElement>) => {
    if (kind === "copy") void copy(list, event);
    else open({ kind, selected: list }, event);
  };

  return <Stack component="section" sx={{ gap: 3, minWidth: 0 }}>
    <ListHeading>
      <Typography component="h2" variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
      <ListToolbar>
        <Box sx={{ width: { xs: "100%", sm: 320 } }}>
          <InputSearch
            value={search}
            onChange={value => { setSearch(value); setPage(0); }}
            placeholder={t("business:market_lists.search")}
            disabled={disabled}
          />
        </Box>
        <Button
          ref={createButton}
          variant="contained"
          startIcon={<AddCircleOutlinedIcon />}
          disabled={actionsDisabled}
          onClick={event => open({ kind: "new" }, event)}
          sx={{ borderRadius: 2 }}
        >{t("business:market_lists.create")}</Button>
      </ListToolbar>
    </ListHeading>
    <QueryErrorAlert isError={result.isError} isFetching={result.isFetching} onRetry={result.refetch} />
    <ListPanel elevation={0} aria-busy={result.isFetching || copying}>
      {result.isFetching && !result.isLoading && <LinearProgress aria-label={t("business:market_lists.loading")} />}
      <Skeleton loading={result.isLoading} fallback={mobile ? (
        <Stack aria-hidden="true" sx={{ gap: 2 }}>
          {[0, 1, 2].map(index => <Box key={index} sx={{ height: 106, borderRadius: 2, bgcolor: "action.hover" }} />)}
        </Stack>
      ) : <TableSkeleton columns={columns} paperSx={{ border: 0, borderRadius: 0 }} />}>
        {ownsScope && data && (mobile ? (
          data.items.length > 0 ? <Stack component="ul" sx={{ gap: 2, p: 0, m: 0 }}>
            {data.items.map(selected => <ListMobileCard key={selected.id}>
              <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                <Typography component="h3" sx={{ fontWeight: 600 }}>{selected.name}</Typography>
                <ListStatus active={selected.is_active} />
              </Stack>
              <Typography variant="body2" color="text.secondary">{t("business:market_lists.product_count", { count: selected.item_count })}</Typography>
              <ListRowActions selected={selected} mobile disabled={actionsDisabled} onAction={handleAction} />
            </ListMobileCard>)}
          </Stack> : !result.isError && <Typography sx={{ p: 2, textAlign: "center", fontWeight: 600 }}>{emptyMessage}</Typography>
        ) : (
          <TableContainer tabIndex={0} role="region" aria-label={title}>
            <Table aria-label={title}>
              <TableHead>
                <TableRow>
                  {columns.map(({ header, align }) => <TableCell key={header} align={align}>{header}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {!result.isError && data.items.length === 0 && <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{emptyMessage}</Typography>
                  </TableCell>
                </TableRow>}
                {data.items.map(selected => <TableRow key={selected.id} hover>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 600, overflowWrap: "anywhere", maxWidth: 320 }}>{selected.name}</TableCell>
                  <TableCell align="right">{selected.item_count}</TableCell>
                  <TableCell align="center"><ListStatus active={selected.is_active} /></TableCell>
                  <TableCell align="right">
                    <ListRowActions selected={selected} disabled={actionsDisabled} onAction={handleAction} />
                  </TableCell>
                </TableRow>)}
              </TableBody>
            </Table>
          </TableContainer>
        ))}
      </Skeleton>
      {ownsScope && data && <BusinessPagination
        component="div"
        count={data.pagination.total}
        page={Math.min(data.pagination.page - 1, Math.max(0, data.pagination.total_pages - 1))}
        rowsPerPage={data.pagination.limit}
        onPageChange={(_, next) => setPage(next)}
        onRowsPerPageChange={event => { setLimit(Number(event.target.value)); setPage(0); }}
        rowsPerPageOptions={rowsPerPageOptions}
        disabled={disabled}
        labelRowsPerPage={t("core:pagination.rows_per_page")}
        labelDisplayedRows={({ from, to, count }) => t("core:displayed_rows", { from, to, count })}
      />}
    </ListPanel>
    {ownsScope && (overlay?.kind === "new" || overlay?.kind === "edit") && <ListEditor
      scope={scope} selected={overlay.kind === "edit" ? overlay.selected : undefined} onClose={close}
    />}
    {ownsScope && overlay?.kind === "checklist" && <ListChecklist scope={scope} selected={overlay.selected} onClose={close} />}
    {ownsScope && overlay?.kind === "activity" && <ListActivityDialog scope={scope} selected={overlay.selected} onClose={close} />}
    {ownsScope && overlay?.kind === "copy" && <BaseModal
      open
      title={t("business:market_lists.copy_text_title")}
      subtitle={t("business:market_lists.copy_fallback")}
      onClose={close}
      actions={<Button variant="contained" onClick={async () => { if (await writeClipboard(overlay.text)) close(); }}>
        {t("business:market_lists.copy_text")}
      </Button>}
    >
      <TextField
        label={t("business:market_lists.items_and_quantities")}
        value={overlay.text}
        multiline
        minRows={3}
        maxRows={10}
        autoFocus
        onFocus={event => event.target.select()}
        slotProps={{ input: { readOnly: true } }}
      />
    </BaseModal>}
  </Stack>;
}

function ListStatus({ active }: { active: boolean }) {
  const { t } = useTranslation("business");
  return <Chip
    label={t(active ? "business:status_active" : "business:status_inactive")}
    color={active ? "success" : "default"}
    size="small"
  />;
}

function ListRowActions({ selected, mobile, disabled, onAction }: {
  selected: ShoppingListSummary;
  mobile?: boolean;
  disabled: boolean;
  onAction: (action: RowAction, selected: ShoppingListSummary, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useTranslation("business");
  const activityAction = selected.is_active ? "business:market_lists.deactivate" : "business:market_lists.activate";
  const ActivityIcon = selected.is_active ? BlockOutlinedIcon : CheckCircleOutlineOutlinedIcon;
  const rowActions = [
    { kind: "edit", action: "business:market_lists.edit", Icon: EditOutlinedIcon },
    { kind: "activity", action: activityAction, Icon: ActivityIcon },
    { kind: "copy", action: "business:market_lists.copy", Icon: ContentCopyOutlinedIcon },
    { kind: "checklist", action: "business:market_lists.checklist", Icon: ChecklistOutlinedIcon },
  ] as const;
  return <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap", justifyContent: mobile ? "flex-start" : "flex-end" }}>
    {rowActions.map(({ kind, action, Icon }) => <Tooltip key={kind} title={t(action)}>
      <span><TouchIconButton
        aria-label={t("business:market_lists.named_action", { action: t(action), name: selected.name })}
        disabled={disabled}
        onClick={event => onAction(kind, selected, event)}
      ><Icon fontSize="small" /></TouchIconButton></span>
    </Tooltip>)}
  </Stack>;
}
