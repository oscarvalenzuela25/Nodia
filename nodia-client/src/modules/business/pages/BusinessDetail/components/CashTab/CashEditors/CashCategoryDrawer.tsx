import { useEffect, useId, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Paper,
  TablePagination,
  Tooltip,
  Typography,
} from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import CheckCircleOutlineOutlined from "@mui/icons-material/CheckCircleOutlineOutlined";
import { visuallyHidden } from "@mui/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../../../../components/ConfirmDialog";
import ActiveStatusSelect, {
  type ActiveFilterStatus,
} from "../../../../../../../components/Filter/components/ActiveStatusSelect";
import InputSearch from "../../../../../../../components/inputs/InputSearch";
import QueryErrorAlert from "../../../../../../../components/QueryErrorAlert";
import type {
  CashCategory,
  CashMutationOutcome,
  CashScope,
} from "../../../../../infrastructure/cashTypes";
import {
  useCashCategories,
  useCashCategory,
  useCashMutation,
} from "../../../../../infrastructure/useCashServices";
import { CashCategoryFields } from "./CashEditorFields";
import { StatusDot } from "../../../styles";
import {
  categoryFields,
  changedFields,
  isCashVersionConflict,
  type CategoryFields,
} from "./fields";
import {
  CategoryDrawer,
  CategoryRowActions,
  CategoryRowHeader,
  CategoryRowTitle,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  EditorForm,
} from "./styles";

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; category: CashCategory }
  | { kind: "activity"; category: CashCategory; active: boolean };
type Props = { scope: CashScope; open: boolean; onClose: () => void; disabled?: boolean };

const pageSize = 10;
const initialFields: CategoryFields = { name: "", description: "", is_active: true };
const getFields = ({ name, description, is_active }: CashCategory): CategoryFields => ({
  name,
  description,
  is_active,
});

export function CashCategoryDrawer({ scope, open, onClose, disabled = false }: Props) {
  const { t } = useTranslation(["business", "core"]);
  const titleId = useId();
  const formId = useId();
  const [view, setView] = useState<View>({ kind: "list" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ActiveFilterStatus>("active");
  const [page, setPage] = useState(0);
  const [latest, setLatest] = useState<CashCategory>();
  const reviewAttempt = useRef(0);
  const activityButtons = useRef(new Map<string, HTMLButtonElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const activityFocus = useRef<{ categoryId?: string } | null>(null);
  const form = useForm<CategoryFields>({
    resolver: zodResolver(categoryFields),
    defaultValues: initialFields,
  });
  const listing = view.kind === "list" || view.kind === "activity";
  const base = view.kind === "edit" || view.kind === "activity" ? view.category : undefined;
  const query = useCashCategories(
    scope,
    {
      page: page + 1,
      limit: pageSize,
      active: status === "all" ? undefined : status === "active",
      search,
    },
    open && listing && !disabled,
  );
  const details = useCashCategory(scope, base?.id, false);
  const mutation = useCashMutation(scope);
  const locked = mutation.busy || mutation.pending;
  const conflict = isCashVersionConflict(mutation.outcome);
  const listBusy = query.isFetching || mutation.busy || disabled;
  const totalItems = query.data?.meta.total_items;
  const lastPage = Math.max(0, (query.data?.meta.total_pages ?? 1) - 1);

  useEffect(() => {
    const request = activityFocus.current;
    if (!open || view.kind !== "list" || listBusy || !request) return;
    const frame = requestAnimationFrame(() => {
      const trigger = request.categoryId ? activityButtons.current.get(request.categoryId) : undefined;
      activityFocus.current = null;
      const target = trigger?.isConnected && !trigger.disabled ? trigger : addButton.current;
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [listBusy, open, view.kind]);

  if (
    listing &&
    !query.isFetching &&
    !query.isError &&
    query.data?.meta.page === page + 1 &&
    page > lastPage
  )
    setPage(lastPage);

  const showView = (next: View) => {
    reviewAttempt.current += 1;
    mutation.reset();
    setLatest(undefined);
    if (next.kind === "create") form.reset(initialFields);
    if (next.kind === "edit") form.reset(getFields(next.category));
    setView(next);
  };

  const back = () => {
    if (locked || view.kind === "activity") return;
    if (view.kind === "list") {
      activityFocus.current = null;
      onClose();
    } else showView({ kind: "list" });
  };

  const closeActivity = (categoryId?: string) => {
    activityFocus.current = { categoryId };
    showView({ kind: "list" });
  };

  const accept = (outcome: CashMutationOutcome | undefined) => {
    if (
      outcome?.status === "committed" &&
      (outcome.operation === "category_create" || outcome.operation === "category_update")
    ) {
      if (view.kind === "activity") {
        const remainsInFilter = status === "all" || (status === "active") === outcome.result.category.is_active;
        closeActivity(remainsInFilter ? view.category.id : undefined);
      } else showView({ kind: "list" });
    }
  };

  const save = async (fields: CategoryFields) => {
    if (locked || conflict || disabled) return;
    if (view.kind === "create") {
      accept(await mutation.submit({ operation: "category_create", fields }));
    } else if (view.kind === "edit") {
      const changes = changedFields(fields, getFields(view.category));
      accept(
        await mutation.submit({
          operation: "category_update",
          id: view.category.id,
          fields: { name: fields.name, ...changes, expected_version: view.category.version },
        }),
      );
    }
  };

  const updateActivity = async () => {
    if (view.kind !== "activity" || mutation.busy || conflict || disabled) return;
    if (mutation.pending) {
      accept(await mutation.retry());
      return;
    }
    accept(
      await mutation.submit({
        operation: "category_update",
        id: view.category.id,
        fields: { expected_version: view.category.version, is_active: view.active },
      }),
    );
  };

  const checkCurrent = async () => {
    const attempt = ++reviewAttempt.current;
    const result = await details.refetch();
    if (result.isSuccess && reviewAttempt.current === attempt) setLatest(result.data);
  };

  const useCurrent = () => {
    if (!latest || (view.kind !== "edit" && view.kind !== "activity")) return;
    if (view.kind === "edit") {
      const changes = changedFields(form.getValues(), getFields(view.category));
      form.reset({ ...getFields(latest), ...changes });
    }
    setView({ ...view, category: latest });
    setLatest(undefined);
    mutation.reset();
  };

  const titleKey =
    view.kind === "create"
      ? "business:cash.category_add"
      : view.kind === "edit"
        ? "business:cash.category_edit"
        : "business:cash.categories";
  const conflictNotice = conflict && (
    <Alert severity="warning">
      {t("business:cash_version_conflict")}
      {latest ? (
        <Box sx={{ mt: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>
            {t("business:cash.current_version", { version: latest.version })}
          </Typography>
          <Typography variant="body2">{latest.name}</Typography>
          <Typography variant="body2">{latest.description}</Typography>
          <Typography variant="body2">
            {t(latest.is_active ? "business:status_active" : "business:status_inactive")}
          </Typography>
          <Button onClick={useCurrent} color="inherit" disabled={disabled} sx={{ minHeight: 44 }}>
            {t("business:cash.accept_current")}
          </Button>
        </Box>
      ) : (
        <Button color="inherit" disabled={details.isFetching || disabled} onClick={() => void checkCurrent()} sx={{ minHeight: 44 }}>
          {t("business:cash.review_current")}
        </Button>
      )}
    </Alert>
  );
  return (
    <CategoryDrawer
      anchor="right"
      open={open}
      onClose={(_, reason) => {
        if (listing || reason === "escapeKeyDown") back();
      }}
      slotProps={{ paper: { role: "dialog", "aria-modal": true, "aria-labelledby": titleId } }}
    >
      <DrawerHeader>
        <Typography id={titleId} component="h2" variant="h6" sx={{ fontWeight: 700 }}>
          {t(titleKey)}
        </Typography>
        <IconButton
          aria-label={t(listing ? "core:close" : "core:cancel")}
          disabled={locked}
          onClick={back}
          sx={{ width: 44, height: 44 }}
        >
          <CloseOutlined />
        </IconButton>
      </DrawerHeader>
      {listing ? (
        <>
          <DrawerBody>
            <InputSearch
              ariaLabel={t("business:cash.category_search")}
              placeholder={t("business:cash.category_search")}
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(0);
              }}
              disabled={listBusy}
              variant="outlined"
            />
            <ActiveStatusSelect
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(0);
              }}
              disabled={listBusy}
            />
            <Button
              ref={addButton}
              variant="contained"
              startIcon={<AddOutlined />}
              disabled={listBusy}
              onClick={() => showView({ kind: "create" })}
              sx={{ minHeight: 44, alignSelf: { xs: "stretch", sm: "flex-end" } }}
            >
              {t("business:cash.category_add")}
            </Button>
            <QueryErrorAlert
              isError={!disabled && query.isError}
              isFetching={query.isFetching}
              onRetry={query.refetch}
            />
            {query.isFetching && !query.isLoading && <LinearProgress sx={{ height: 2 }} />}
            <Skeleton
              loading={query.isLoading}
              fallback={
                <Box aria-hidden="true" sx={{ height: 212 }}>
                  {[0, 1, 2].map((row) => (
                    <Box
                      key={row}
                      sx={{ height: 60, mb: 1, bgcolor: "action.hover", borderRadius: 2 }}
                    />
                  ))}
                </Box>
              }
            >
              {query.data?.data.length ? (
                <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}>
                  {query.data.data.map((entry) => {
                    const editLabel = t("business:cash.edit");
                    const activityLabel = t(entry.is_active ? "business:cash.deactivate" : "business:cash.activate");
                    return (
                      <Paper
                        component="li"
                        variant="outlined"
                        key={entry.id}
                        sx={{ p: 1.5, minWidth: 0 }}
                      >
                        <CategoryRowHeader>
                          <CategoryRowTitle>
                            <StatusDot active={entry.is_active} aria-hidden="true" sx={{ flexShrink: 0 }} />
                            <Box component="span" sx={visuallyHidden}>
                              {t(entry.is_active ? "business:status_active" : "business:status_inactive")}
                            </Box>
                            <Typography component="h3" variant="subtitle2" sx={{ fontWeight: 700, minWidth: 0 }}>
                              {entry.name}
                            </Typography>
                          </CategoryRowTitle>
                          <CategoryRowActions role="group" aria-label={entry.name}>
                            <Tooltip title={editLabel}>
                              <span>
                                <IconButton
                                  color="primary"
                                  aria-label={editLabel}
                                  disabled={listBusy}
                                  onClick={() => showView({ kind: "edit", category: entry })}
                                >
                                  <EditOutlined fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title={activityLabel}>
                              <span>
                                <IconButton
                                  ref={(button) => {
                                    if (button) activityButtons.current.set(entry.id, button);
                                    else activityButtons.current.delete(entry.id);
                                  }}
                                  aria-label={activityLabel}
                                  disabled={listBusy}
                                  color={entry.is_active ? "error" : "success"}
                                  onClick={() => showView({ kind: "activity", category: entry, active: !entry.is_active })}
                                >
                                  {entry.is_active ? <DeleteOutlined fontSize="small" /> : <CheckCircleOutlineOutlined fontSize="small" />}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </CategoryRowActions>
                        </CategoryRowHeader>
                        {entry.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}
                          >
                            {entry.description}
                          </Typography>
                        )}
                      </Paper>
                    );
                  })}
                </Box>
              ) : query.data && !query.isError ? (
                <Typography variant="body2" color="text.secondary" align="center">
                  {t("business:cash.category_empty")}
                </Typography>
              ) : null}
            </Skeleton>
          </DrawerBody>
          {totalItems !== undefined && totalItems > pageSize && (
            <DrawerFooter sx={{ p: 0 }}>
              <TablePagination
                component="div"
                count={totalItems}
                page={Math.min(page, lastPage)}
                onPageChange={(_, value) => setPage(value)}
                rowsPerPage={pageSize}
                rowsPerPageOptions={[]}
                disabled={listBusy}
                labelDisplayedRows={({ count, from, to }) =>
                  t("core:displayed_rows", { count, from, to })
                }
                getItemAriaLabel={(kind) => t(`core:pagination.page_${kind}`)}
              />
            </DrawerFooter>
          )}
        </>
      ) : (
        <>
          <DrawerBody>
            {conflictNotice}
            <EditorForm
              id={formId}
              onSubmit={(event) => {
                void form.handleSubmit(save)(event);
              }}
              noValidate
            >
              <CashCategoryFields control={form.control} disabled={locked || disabled} />
            </EditorForm>
          </DrawerBody>
          <DrawerFooter>
            <Button
              variant="outlined"
              onClick={back}
              disabled={locked}
            >
              {t("core:cancel")}
            </Button>
            <Button
              variant="contained"
              type={mutation.pending ? "button" : "submit"}
              form={formId}
              disabled={mutation.busy || conflict || disabled}
              onClick={mutation.pending ? () => { void mutation.retry().then(accept); } : undefined}
            >
              {t("core:save")}
            </Button>
          </DrawerFooter>
        </>
      )}
      {open && view.kind === "activity" && (
        <ConfirmDialog
          open
          title={t(view.active ? "business:cash.activate" : "business:cash.deactivate")}
          message={t(
            view.active ? "business:cash.category_activate_message" : "business:cash.category_deactivate_message",
            { name: view.category.name },
          )}
          confirmText={t(view.active ? "business:cash.activate" : "business:cash.deactivate")}
          onConfirm={updateActivity}
          onClose={() => closeActivity(view.category.id)}
          isLoading={mutation.busy || details.isFetching}
          cancelDisabled={mutation.pending}
          showCloseButton={!mutation.pending}
          confirmDisabled={conflict || disabled}
        >
          {conflictNotice}
        </ConfirmDialog>
      )}
    </CategoryDrawer>
  );
}
