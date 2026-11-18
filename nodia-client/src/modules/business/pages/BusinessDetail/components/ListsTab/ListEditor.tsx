import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, LinearProgress, Tooltip, Typography } from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../../../components/BaseModal";
import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../../../components/inputs/TextInput";
import { isShoppingListScopeError, maxListItems } from "./infrastructure/services";
import type { ShoppingListDetail, ShoppingListSummary } from "./infrastructure/services";
import { useHasListScope, useShoppingListCatalog, useShoppingListDetail } from "./infrastructure/useServices";
import type { ShoppingListScope } from "./infrastructure/useServices";
import { editorValues, listCommand, listDraftSchema } from "./listDraft";
import type { ListEditorValues } from "./listDraft";
import { EditorFields, EditorProductHeader, EditorProductList, EditorProductRow, TouchIconButton } from "./styles";
import { useListEditor } from "./useListEditor";

type EditorProps = {
  scope: ShoppingListScope;
  selected?: ShoppingListSummary;
  onClose: () => void;
};

export default function ListEditor({ scope, selected, onClose }: EditorProps) {
  const { t } = useTranslation(["business", "core"]);
  const detail = useShoppingListDetail(scope, selected?.id);
  const [initial, setInitial] = useState<ShoppingListDetail>();
  const restricted = isShoppingListScopeError(detail.error);
  if (!initial && detail.data && !detail.isError && !detail.isFetching) setInitial(detail.data);
  if (selected && !initial) {
    return <BaseModal open onClose={onClose} title={t("business:market_lists.edit")}>
      {detail.isFetching && <LinearProgress aria-label={t("business:market_lists.loading")} />}
      <QueryErrorAlert isError={detail.isError} isFetching={detail.isFetching} onRetry={detail.refetch} />
    </BaseModal>;
  }
  return <EditorForm scope={scope} detail={initial} restricted={restricted} readCurrent={async () => {
    const result = await detail.refetch();
    return result.isError ? undefined : result.data;
  }} onClose={onClose} />;
}

function EditorForm({ scope, detail, readCurrent, onClose, restricted }: Omit<EditorProps, "selected"> & {
  detail?: ShoppingListDetail;
  restricted: boolean;
  readCurrent: () => Promise<ShoppingListDetail | undefined>;
}) {
  const { t } = useTranslation(["business", "core"]);
  const active = useHasListScope(scope);
  const editorId = useId();
  const nameId = `${editorId}-name`;
  const productId = `${editorId}-product`;
  const productList = useRef<HTMLUListElement>(null);
  const [step, setStep] = useState(detail ? "items" : "name");
  const [baseline, setBaseline] = useState(detail);
  const [removeProductId, setRemoveProductId] = useState<string>();
  const [confirmReset, setConfirmReset] = useState<ShoppingListDetail>();
  const [confirmClose, setConfirmClose] = useState(false);
  const [checkingCurrent, setCheckingCurrent] = useState(false);
  const [currentReadError, setCurrentReadError] = useState(false);
  const { control, handleSubmit, reset, trigger } = useForm<ListEditorValues>({
    resolver: zodResolver(listDraftSchema),
    defaultValues: editorValues(detail),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const write = useListEditor(scope, onClose);
  const catalog = useShoppingListCatalog(scope, step === "items" && !write.pendingCreate);
  const pending = write.isPending || checkingCurrent;
  const locked = pending || write.pendingCreate || !active || restricted || write.accessLost;
  const removeIndex = fields.findIndex(item => item.product_id === removeProductId);
  const productIds = new Set(fields.map(item => item.product_id));
  const options = catalog.products.filter(product => !productIds.has(product.id))
    .map(product => ({ value: product.id, label: product.name }));

  const chooseProduct = (id: string | null) => {
    const product = catalog.products.find(candidate => candidate.id === id);
    if (!product || locked || productIds.has(product.id) || fields.length >= maxListItems) return;
    append({ product_id: product.id, name: product.name, quantity: "1", available: true }, { shouldFocus: false });
    requestAnimationFrame(() => {
      if (productList.current) productList.current.scrollTop = productList.current.scrollHeight;
    });
  };

  const close = () => {
    if (pending) return;
    if (write.pendingCreate) setConfirmClose(true);
    else onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (locked || write.needsCurrent) return;
    if (step === "name") {
      void trigger("name").then(valid => {
        if (valid) {
          setStep("items");
          requestAnimationFrame(() => document.getElementById(productId)?.focus());
        }
      });
      return;
    }
    void handleSubmit(values => write.save(listCommand(values), baseline))(event);
  };

  const loadCurrent = async () => {
    if (pending) return;
    setCheckingCurrent(true);
    setCurrentReadError(false);
    try {
      const current = await readCurrent();
      if (!current) setCurrentReadError(true);
      else if (current.version !== baseline?.version) setConfirmReset(current);
      else write.acceptCurrent();
    } finally {
      setCheckingCurrent(false);
    }
  };

  return <>
    <BaseModal
      open
      title={t(baseline ? "business:market_lists.edit" : "business:market_lists.create")}
      subtitle={step === "items" ? t("business:market_lists.items_and_quantities") : undefined}
      onClose={close}
      showCloseButton={!pending}
      disableEscapeKeyDown={pending}
      actions={<>
        <Button variant="outlined" type="button" disabled={pending} onClick={close}>{t("core:cancel")}</Button>
        {write.pendingCreate ? <>
          <Button variant="outlined" disabled={pending || !active || write.accessLost} onClick={write.verify}>{t("business:market_lists.verify_save")}</Button>
          {write.receiptMissing && <Button variant="contained" disabled={pending || !active || write.accessLost} onClick={write.retryCreate}>
            {t("business:market_lists.retry_save")}
          </Button>}
        </> : <Button variant="contained" type="submit" form={editorId} loading={write.isPending} disabled={locked || write.needsCurrent}>
          {t(step === "name" ? "business:market_lists.continue" : "business:market_lists.save")}
        </Button>}
      </>}
    >
      <EditorFields id={editorId} onSubmit={submit} noValidate>
        {write.pendingCreate && <Alert severity="warning">
          {t(write.receiptMissing ? "business:market_lists.receipt_missing" : "business:market_lists.save_uncertain")}
        </Alert>}
        {write.needsCurrent && <Alert severity="warning" action={
          <Button variant="outlined" size="small" color="inherit" disabled={pending} onClick={() => void loadCurrent()}>
            {t("business:market_lists.read_current")}
          </Button>
        }>{t("business:market_lists.review_current")}</Alert>}
        {(currentReadError || restricted || write.accessLost) && <Alert severity="error">{t("core:server_error_alert")}</Alert>}
        {!restricted && !write.accessLost && <Controller name="name" control={control} render={({ field, fieldState }) => (
          <TextInput
            id={nameId}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            label={t("business:market_lists.name")}
            placeholder={t("business:market_lists.name_example")}
            required
            autoFocus
            disabled={locked}
            error={fieldState.invalid}
            helperText={fieldState.invalid ? t("business:market_lists.invalid_name") : undefined}
          />
        )} />}
        {step === "items" && !restricted && !write.accessLost && <>
          <QueryErrorAlert isError={catalog.isError} isFetching={catalog.isFetching} onRetry={catalog.refetch} />
          <SelectSingleInput
            id={productId}
            label={t("business:market_lists.catalog")}
            placeholder={t("business:market_lists.choose_product")}
            searchPlaceholder={t("business:market_lists.search_products")}
            options={catalog.isSearching || isShoppingListScopeError(catalog.error) ? [] : options}
            value={null}
            onChange={chooseProduct}
            onSearchChange={catalog.setSearch}
            onLoadMore={() => { if (!catalog.isSearching && !catalog.isFetching) void catalog.fetchNextPage(); }}
            hasMore={catalog.hasNextPage && !catalog.isSearching}
            loadingOptions={catalog.isFetching}
            disabled={locked || isShoppingListScopeError(catalog.error) || fields.length >= maxListItems}
          />
          {fields.length === maxListItems && <Typography variant="body2" color="text.secondary">
            {t("business:market_lists.item_limit", { count: maxListItems })}
          </Typography>}
          {!fields.length && <Typography variant="body2" color="text.secondary">{t("business:market_lists.empty_items")}</Typography>}
          {!!fields.length && <EditorProductList ref={productList} tabIndex={0} aria-label={t("business:market_lists.items_and_quantities")}>
            <EditorProductHeader aria-hidden="true">
              <Typography variant="caption" color="text.secondary">{t("business:tab_products")}</Typography>
              <Typography variant="caption" color="text.secondary">{t("business:market_lists.quantity")}</Typography>
              <Box sx={{ width: 44 }} />
            </EditorProductHeader>
            {fields.map((item, index) => <EditorProductRow key={item.id}>
              <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <Typography variant="body2">{item.name}</Typography>
                {!item.available && <Typography variant="caption" color="text.secondary">{t("business:market_lists.unavailable")}</Typography>}
              </Box>
              <Controller name={`items.${index}.quantity`} control={control} render={({ field, fieldState }) => (
                <TextInput
                  id={`${editorId}-qty-${item.id}`}
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputMode="decimal"
                  label={t("business:market_lists.product_quantity", { name: item.name })}
                  error={fieldState.invalid}
                  helperText={fieldState.invalid ? t("business:market_lists.invalid_quantity") : undefined}
                  disabled={locked}
                />
              )} />
              <Tooltip title={t("business:market_lists.remove_product")}>
                <span>
                  <TouchIconButton
                    type="button"
                    color="error"
                    aria-label={t("business:market_lists.remove_named_product", { name: item.name })}
                    disabled={locked}
                    onClick={() => setRemoveProductId(item.product_id)}
                  ><DeleteOutlineOutlinedIcon fontSize="small" /></TouchIconButton>
                </span>
              </Tooltip>
            </EditorProductRow>)}
          </EditorProductList>}
        </>}
      </EditorFields>
    </BaseModal>
    {removeIndex >= 0 && <ConfirmDialog
      open
      onClose={() => setRemoveProductId(undefined)}
      title={t("business:market_lists.remove_product")}
      message={t("business:market_lists.remove_product_confirmation", { name: fields[removeIndex].name })}
      confirmText={t("business:market_lists.remove")}
      onConfirm={() => {
        remove(removeIndex);
        setRemoveProductId(undefined);
        requestAnimationFrame(() => document.getElementById(productId)?.focus());
      }}
    />}
    {confirmReset && <ConfirmDialog
      open
      onClose={() => setConfirmReset(undefined)}
      title={t("business:market_lists.replace_draft")}
      message={t("business:market_lists.replace_draft_description")}
      confirmText={t("business:market_lists.read_current")}
      onConfirm={() => {
        reset(editorValues(confirmReset));
        setBaseline(confirmReset);
        setConfirmReset(undefined);
        write.acceptCurrent();
      }}
    />}
    {confirmClose && <ConfirmDialog
      open
      onClose={() => setConfirmClose(false)}
      title={t("business:market_lists.close_uncertain")}
      message={t("business:market_lists.close_uncertain_description")}
      confirmText={t("core:close")}
      onConfirm={onClose}
    />}
  </>;
}
