import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Alert, Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../../../../components/BaseModal";
import QueryErrorAlert from "../../../../../../../components/QueryErrorAlert";
import SelectSingleInput from "../../../../../../../components/inputs/SelectSingleInput";
import type {
  CashCategory,
  CashMovement,
  CashMovementType,
  CashMutationOutcome,
  CashScope,
} from "../../../../../infrastructure/cashTypes";
import { cashToday, formatCashAmount } from "../../../../../infrastructure/cashValues";
import {
  useCashCategory,
  useCashCategoryOptions,
  useCashMovement,
  useCashMutation,
} from "../../../../../infrastructure/useCashServices";
import { CashActiveField, CashCategoryFields, CashTextField } from "./CashEditorFields";
import { CashMutationFeedback } from "./CashMutationFeedback";
import {
  categoryFields,
  changedFields,
  isCashVersionConflict,
  movementFields,
  type CategoryFields,
  type MovementFields,
} from "./fields";
import { CategoryPickerRow, EditorForm } from "./styles";

export type ManualCashMovement = Extract<CashMovement, { source: "manual" }>;

export type CashMovementEditorIntent =
  { mode: "create"; type: CashMovementType } | { mode: "edit"; movement: ManualCashMovement };

type Props = {
  scope: CashScope;
  editor: CashMovementEditorIntent;
  onClose: () => void;
  disabled?: boolean;
};

const toFields = ({
  category_id,
  amount,
  occurred_on,
  description,
  is_active,
}: ManualCashMovement): MovementFields => ({
  category_id,
  amount,
  occurred_on,
  description,
  is_active,
});

const emptyCategory = { name: "", description: "", is_active: true };

export function CashMovementDialog({ scope, editor, onClose, disabled = false }: Props) {
  const { t, i18n } = useTranslation(["business", "core"]);
  const formId = useId();
  const categoryId = useId();
  const returnToPicker = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [base, setBase] = useState(editor.mode === "edit" ? editor.movement : undefined);
  const [latest, setLatest] = useState<ManualCashMovement>();
  const [quickOpen, setQuickOpen] = useState(false);
  const [picked, setPicked] = useState<Pick<CashCategory, "id" | "name" | "is_active">>();
  const [search, setSearch] = useState("");
  const type = editor.mode === "create" ? editor.type : editor.movement.type;
  const movement = useCashMutation(scope);
  const category = useCashMutation(scope);
  const movementForm = useForm<MovementFields>({
    resolver: zodResolver(movementFields),
    defaultValues: base
      ? toFields(base)
      : {
          category_id: "",
          amount: "",
          occurred_on: cashToday(),
          description: "",
          is_active: true,
        },
  });
  const categoryForm = useForm<CategoryFields>({
    resolver: zodResolver(categoryFields),
    defaultValues: emptyCategory,
  });
  const selectedId = useWatch({ control: movementForm.control, name: "category_id" });
  const options = useCashCategoryOptions(scope, { active: true, search }, !quickOpen && !disabled);
  const selected = useCashCategory(scope, selectedId || undefined, !quickOpen && !disabled);
  const details = useCashMovement(scope, base?.id, false);
  const activityLocked = movement.busy || movement.pending;
  const quickLocked = category.busy || category.pending;
  const locked = quickOpen ? quickLocked : activityLocked;
  const conflict = isCashVersionConflict(movement.outcome);

  const candidates = new Map(
    (options.data?.pages.flatMap((page) => page.data) ?? []).map((entry) => [entry.id, entry]),
  );
  const remembered = picked?.id === selectedId ? picked : undefined;
  const provedCategory = selected.data?.id === selectedId ? selected.data : undefined;
  const currentCategory = provedCategory ?? candidates.get(selectedId) ?? remembered;
  const canSaveCategory =
    !selected.isFetching &&
    !selected.isError &&
    (selectedId === base?.category_id || currentCategory?.is_active === true);
  const choices = new Map<string, Pick<CashCategory, "id" | "name" | "is_active">>(candidates);
  if (base?.category)
    choices.set(
      base.category.id,
      provedCategory?.id === base.category.id
        ? provedCategory
        : (choices.get(base.category.id) ?? base.category),
    );
  if (currentCategory?.is_active) choices.set(currentCategory.id, currentCategory);
  const categoryOptions = Array.from(choices.values(), (entry) => ({
    value: entry.id,
    label: entry.is_active
      ? entry.name
      : t("business:cash.category_inactive_option", { name: entry.name }),
  }));

  useLayoutEffect(() => {
    if (!quickOpen && returnToPicker.current) {
      returnToPicker.current = false;
      document.getElementById(categoryId)?.focus();
    }
  }, [categoryId, quickOpen]);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const changeSearch = (value: string) => {
    clearTimeout(searchTimer.current);
    if (!value) setSearch("");
    else searchTimer.current = setTimeout(() => setSearch(value), 300);
  };

  const returnToMovement = () => {
    category.reset();
    returnToPicker.current = true;
    setQuickOpen(false);
  };

  const acceptCategory = (outcome: CashMutationOutcome | undefined) => {
    if (outcome?.status !== "committed" || outcome.operation !== "category_create") return;
    setPicked(outcome.result.category);
    movementForm.setValue("category_id", outcome.result.category.id, {
      shouldValidate: true,
      shouldDirty: true,
    });
    returnToMovement();
  };

  const handleClose = () => {
    if (locked) return;
    if (quickOpen) returnToMovement();
    else onClose();
  };

  const saveCategory = async (fields: CategoryFields) => {
    if (quickLocked || disabled) return;
    acceptCategory(await category.submit({ operation: "category_create", fields }));
  };

  const acceptMovement = (outcome: CashMutationOutcome | undefined) => {
    if (
      outcome?.status === "committed" &&
      (outcome.operation === "movement_update" || outcome.operation === "movement_create")
    )
      onClose();
  };

  const saveMovement = movementForm.handleSubmit(async (fields) => {
    if (activityLocked || conflict || disabled) return;
    if (!canSaveCategory) {
      movementForm.setError("category_id", { message: "business:cash.category_selection_invalid" });
      return;
    }
    if (base) {
      const changes = changedFields(fields, toFields(base));
      acceptMovement(
        await movement.submit({
          operation: "movement_update",
          id: base.id,
          fields: { description: fields.description, ...changes, expected_version: base.version },
        }),
      );
    } else {
      acceptMovement(
        await movement.submit({ operation: "movement_create", fields: { ...fields, type } }),
      );
    }
  });

  const checkCurrent = async () => {
    const result = await details.refetch();
    if (result.isSuccess && result.data.source === "manual") setLatest(result.data);
  };

  const useCurrent = () => {
    if (!latest || !base) return;
    movementForm.reset({
      ...toFields(latest),
      ...changedFields(movementForm.getValues(), toFields(base)),
    });
    setBase(latest);
    setLatest(undefined);
    movement.reset();
  };

  const title = quickOpen
    ? "business:cash.category_add"
    : base
      ? "business:cash.movement_edit"
      : type === "income"
        ? "business:cash.movement_new_income"
        : "business:cash.movement_new_expense";
  const disableSubmit =
    locked || disabled || (!quickOpen && (conflict || (!!selectedId && !canSaveCategory)));
  const movementDisabled = activityLocked || disabled;

  return (
    <BaseModal
      open
      title={t(title)}
      onClose={handleClose}
      showCloseButton={!locked}
      disableEscapeKeyDown={locked}
      actions={
        <>
          <Button variant="outlined" onClick={handleClose} disabled={locked}>
            {t("core:cancel")}
          </Button>
          <Button variant="contained" type="submit" form={formId} disabled={disableSubmit}>
            {t("core:save")}
          </Button>
        </>
      }
    >
      {quickOpen ? (
        <>
          <EditorForm
            id={formId}
            onSubmit={(event) => {
              void categoryForm.handleSubmit(saveCategory)(event);
            }}
            noValidate
          >
            <CashCategoryFields
              control={categoryForm.control}
              disabled={quickLocked || disabled}
              hideActivity
            />
          </EditorForm>
          <CashMutationFeedback
            outcome={category.outcome}
            busy={category.busy || disabled}
            onRecover={() => {
              void category.recover().then(acceptCategory);
            }}
            onRetry={() => {
              void category.retry().then(acceptCategory);
            }}
          />
        </>
      ) : (
        <>
          {conflict && (
            <Alert severity="warning">
              {t("business:cash_version_conflict")}
              {latest ? (
                <Box sx={{ mt: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {t("business:cash.current_version", { version: latest.version })}
                  </Typography>
                  <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                    {latest.occurred_on} · {latest.category.name} ·{" "}
                    {formatCashAmount(latest.amount, i18n.language)}
                  </Typography>
                  <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                    {latest.description}
                  </Typography>
                  <Typography variant="body2">
                    {t(latest.is_active ? "business:status_active" : "business:status_inactive")}
                  </Typography>
                  <Button
                    onClick={useCurrent}
                    color="inherit"
                    disabled={disabled}
                    sx={{ minHeight: 44 }}
                  >
                    {t("business:cash.accept_current")}
                  </Button>
                </Box>
              ) : (
                <Button
                  color="inherit"
                  disabled={details.isFetching || disabled}
                  onClick={() => {
                    void checkCurrent();
                  }}
                  sx={{ minHeight: 44 }}
                >
                  {t("business:cash.review_current")}
                </Button>
              )}
            </Alert>
          )}
          <EditorForm
            id={formId}
            onSubmit={(event) => {
              void saveMovement(event);
            }}
            noValidate
          >
            <Typography component="p" variant="body2" color="text.secondary">
              {t("business:cash.type")} ·{" "}
              <strong>
                {t(type === "income" ? "business:cash.income" : "business:cash.expense")}
              </strong>
            </Typography>
            <CategoryPickerRow>
              <Controller
                control={movementForm.control}
                name="category_id"
                render={({ field, fieldState }) => (
                  <SelectSingleInput
                    id={categoryId}
                    label={t("business:cash.category")}
                    value={field.value || null}
                    onChange={(value) => {
                      setPicked(candidates.get(value ?? ""));
                      field.onChange(value ?? "");
                    }}
                    options={categoryOptions}
                    onSearchChange={changeSearch}
                    onLoadMore={() => {
                      void options.fetchNextPage();
                    }}
                    hasMore={options.hasNextPage}
                    loadingOptions={options.isFetching}
                    disabled={movementDisabled}
                    required
                    error={
                      !!fieldState.error ||
                      (!!selectedId && !selected.isFetching && !canSaveCategory)
                    }
                    helperText={
                      fieldState.error?.message
                        ? t(fieldState.error.message)
                        : selectedId && !selected.isFetching && !canSaveCategory
                          ? t("business:cash.review_selection_changed")
                          : undefined
                    }
                  />
                )}
              />
              <Tooltip title={t("business:cash.category_add")}>
                <span>
                  <IconButton
                    aria-label={t("business:cash.category_add")}
                    color="primary"
                    size="small"
                    disabled={movementDisabled}
                    onClick={() => {
                      categoryForm.reset(emptyCategory);
                      setQuickOpen(true);
                    }}
                    sx={{
                      mt: "26px",
                      width: 44,
                      height: 44,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 2,
                    }}
                  >
                    <AddOutlined />
                  </IconButton>
                </span>
              </Tooltip>
            </CategoryPickerRow>
            <QueryErrorAlert
              isError={!disabled && (options.isError || selected.isError)}
              isFetching={options.isFetching || selected.isFetching}
              onRetry={() => {
                if (options.isError) void options.refetch();
                if (selected.isError) void selected.refetch();
              }}
            />
            <CashTextField
              control={movementForm.control}
              name="amount"
              label={t("business:cash.amount")}
              disabled={movementDisabled}
              type="amount"
              autoFocus={!base}
            />
            <CashTextField
              control={movementForm.control}
              name="occurred_on"
              label={t("business:cash.date")}
              disabled={movementDisabled}
              type="date"
            />
            <CashTextField
              control={movementForm.control}
              name="description"
              label={t("business:description_label")}
              disabled={movementDisabled}
              multiline
            />
            <Controller
              control={movementForm.control}
              name="is_active"
              render={({ field }) => (
                <CashActiveField
                  checked={field.value}
                  disabled={movementDisabled}
                  onChange={field.onChange}
                />
              )}
            />
          </EditorForm>
          <CashMutationFeedback
            outcome={movement.outcome}
            busy={movement.busy || disabled}
            onRecover={() => {
              void movement.recover().then(acceptMovement);
            }}
            onRetry={() => {
              void movement.retry().then(acceptMovement);
            }}
          />
        </>
      )}
    </BaseModal>
  );
}
