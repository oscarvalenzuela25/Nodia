import dayjs from "dayjs";
import DateInput from "../../../../../../../../components/inputs/DateInput";
import type { FC, ChangeEvent, DragEvent, ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";

import BaseModal from "../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../../../components/inputs/SelectSingleInput";
import type { SelectSingleInputProps } from "../../../../../../../../components/inputs/SelectSingleInput/types";
import type { InvoiceEntity, ProviderEntity } from "../../../../../../infrastructure/types";
import type { CashScope } from "../../../../../../infrastructure/cashTypes";
import { formatCashAmount, isCashCivilDate } from "../../../../../../infrastructure/cashValues";
import {
  CashExpenseCategoryPicker,
  QuickCashCategoryForm,
  type CashCategoryOption,
} from "../../../../../../components/CashExpenseCategoryPicker";
import {
  invoiceSchema,
  MAX_INVOICE_TOTAL,
  toInvoiceFormData,
  type InvoiceFormData,
  type InvoiceFormSource,
  type InvoiceFormSubmitData,
} from "./invoiceCommands";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  FileDropzoneBox,
  ModalActionsContainer,
} from "./styles";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: InvoiceFormSubmitData) => Promise<void>;
  initialData?: InvoiceFormSource | InvoiceEntity | null;
  providers?: ProviderEntity[];
  providerSearch?: Pick<SelectSingleInputProps, "onSearchChange" | "onLoadMore" | "hasMore" | "loadingOptions">;
  isSubmitting?: boolean;
  cash?: {
    scope: CashScope;
    feedback?: ReactNode;
    blocked?: boolean;
  };
}

export const InvoiceModal: FC<Props> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  providers = [],
  providerSearch,
  isSubmitting = false,
  cash,
}) => {
  const { t, i18n } = useTranslation(["business", "core"]);
  const formId = useId();
  const pickerId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cashCategory, setCashCategory] = useState<CashCategoryOption | null>();
  const [quickOpen, setQuickOpen] = useState(false);
  const returnToPicker = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canUploadAttachment = !initialData;

  const previewUrl = useMemo(() => {
    if (!file) return null;
    const isImg =
      file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name);
    if (isImg) {
      return URL.createObjectURL(file);
    }
    return null;
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const isImage = Boolean(
    file &&
      (file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name))
  );
  const isPdf = Boolean(
    file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name))
  );

  // Prevent browser default behavior of opening dropped files in tab
  useEffect(() => {
    if (!canUploadAttachment) return;
    const preventBrowserFileDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", preventBrowserFileDrop);
    window.addEventListener("drop", preventBrowserFileDrop);
    return () => {
      window.removeEventListener("dragover", preventBrowserFileDrop);
      window.removeEventListener("drop", preventBrowserFileDrop);
    };
  }, [canUploadAttachment]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, defaultValues, dirtyFields },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: initialData ? toInvoiceFormData(initialData) : {
      code: "",
      provider_id: null,
      total_amount: 0,
      path_storage: "",
      issue_date: dayjs().format("YYYY-MM-DD"),
      notes: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (initialData) reset(toInvoiceFormData(initialData), { keepDirtyValues: true });
  }, [initialData, reset]);

  useEffect(() => {
    if (quickOpen || !returnToPicker.current) return;
    const frame = requestAnimationFrame(() => {
      returnToPicker.current = false;
      document.getElementById(pickerId)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pickerId, quickOpen]);

  const [amount, issueDate, providerId] = useWatch({ control, name: ["total_amount", "issue_date", "provider_id"] });
  const currentCategory = initialData?.cash_expense?.category ?? null;
  const category = cashCategory === undefined ? currentCategory : cashCategory;
  const invalidAmount = Boolean(category) && !(amount > 0 && Number.isInteger(amount) && amount <= MAX_INVOICE_TOTAL);
  const invalidDate = Boolean(category) && !isCashCivilDate(issueDate);
  const invalidCategory = Boolean(category && !category.is_active && category.id !== currentCategory?.id);
  const changesExpense = category?.id !== currentCategory?.id ||
    Boolean(category && (amount !== defaultValues?.total_amount || issueDate !== defaultValues?.issue_date));
  const cashEffect = changesExpense && (category && !invalidAmount && !invalidDate && !invalidCategory
    ? t(currentCategory ? "business:cash.invoice_effect_update" : "business:cash.invoice_effect_activate", {
        amount: formatCashAmount(String(amount), i18n.language),
        date: issueDate,
        category: category.name,
      })
    : !category && currentCategory && t("business:cash.invoice_effect_withdraw"));
  const locked = isSubmitting || Boolean(cash?.blocked);
  // Subscribing dirtyFields lets RHF keep the user's modified values when the
  // base version is replaced after an explicit review.
  const keepProviderChoice = dirtyFields.provider_id && providerId !== initialData?.provider?.id;
  const [providerChoice, setProviderChoice] = useState<{ id: string; name: string }>();

  const providerOptions = useMemo(() => {
    const selected = keepProviderChoice && providerChoice?.id === providerId ? providerChoice : initialData?.provider;
    const items = selected && !providers.some((provider) => provider.id === selected.id) ? [selected, ...providers] : providers;
    return items.map((p) => ({
      value: p.id,
      label: p.name,
    }));
  }, [providers, initialData?.provider, keepProviderChoice, providerChoice, providerId]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSubmitting) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSubmitting) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isSubmitting) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".pdf")) {
      return <PictureAsPdfOutlinedIcon color="error" />;
    }
    if (/\.(png|jpg|jpeg|webp)$/.test(lower)) {
      return <ImageOutlinedIcon color="primary" />;
    }
    return <DescriptionOutlinedIcon color="action" />;
  };

  const modalActions = (
    <ModalActionsContainer>
      <Button
        variant="contained"
        color="error"
        onClick={onClose}
        disabled={isSubmitting}
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("business:cancel")}
      </Button>
      <Button
        variant="contained"
        color="primary"
        type="submit"
        form={formId}
        disabled={locked || invalidAmount || invalidDate || invalidCategory}
        data-testid="save-invoice-btn"
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("business:save")}
      </Button>
    </ModalActionsContainer>
  );

  const onFormSubmit = async (data: InvoiceFormData) => {
    if (locked || invalidAmount || invalidDate || invalidCategory) return;
    await onSubmit({
      ...data,
      file,
      ...(cashCategory === undefined ? {} : { cashCategory }),
    });
  };

  const closeQuickCategory = () => {
    returnToPicker.current = true;
    setQuickOpen(false);
  };

  if (cash && quickOpen) {
    return (
      <QuickCashCategoryForm
        scope={cash.scope}
        onCreated={(created) => {
          setCashCategory(created);
          closeQuickCategory();
        }}
        onCancel={closeQuickCategory}
      >
        {({ content, actions, locked, onClose }) => (
          <BaseModal
            open={open}
            title={t("business:cash.category_add")}
            onClose={onClose}
            actions={actions}
            showCloseButton={!locked}
            disableEscapeKeyDown={locked}
          >
            {content}
          </BaseModal>
        )}
      </QuickCashCategoryForm>
    );
  }

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={
        initialData
          ? t("business:edit_invoice_modal_title")
          : t("business:new_invoice_modal_title")
      }
      size="sm"
      actions={modalActions}
      disableEscapeKeyDown={isSubmitting}
      showCloseButton={!isSubmitting}
    >
      <FormContainer
        id={formId}
        noValidate
        onSubmit={handleSubmit(onFormSubmit)}
      >
        {cash?.feedback}

        {/* File Upload Section */}
        {initialData?.path_storage && (
          <Box data-testid="invoice-existing-file" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {getFileIcon(initialData.path_storage)}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                {initialData.path_storage.split("/").pop() || initialData.path_storage}
              </Typography>
              {!dirtyFields.path_storage && (
                <Typography variant="caption" color="text.secondary">
                  {t("business:cash.invoice_attachment_edit_hint")}
                </Typography>
              )}
            </Box>
          </Box>
        )}
        {canUploadAttachment && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
              {t("business:invoice_file_section_title")}
            </Typography>

            <FileDropzoneBox
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                ...(isDragging && {
                  borderColor: "primary.main",
                  borderStyle: "solid",
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(33, 150, 243, 0.08)"
                      : "rgba(25, 118, 210, 0.06)",
                }),
              }}
              data-testid="invoice-dropzone"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                onClick={(event) => event.stopPropagation()}
                disabled={isSubmitting}
                aria-label={t("business:invoice_file_section_title")}
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                style={{ position: "absolute", width: 1, height: 1, clipPath: "inset(50%)" }}
                data-testid="invoice-file-input"
              />
              {file ? (
                <Box
                  data-testid="invoice-file-selected"
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1.5,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  <Box sx={{ position: "absolute", top: -8, right: -4 }}>
                    <Tooltip title={t("business:invoice_remove_file_btn")}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile();
                        }}
                        disabled={isSubmitting}
                        data-testid="remove-invoice-file"
                      >
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {isImage && previewUrl ? (
                    <Box
                      component="img"
                      src={previewUrl}
                      alt={file.name}
                      sx={{
                        maxHeight: 160,
                        maxWidth: "100%",
                        objectFit: "contain",
                        borderRadius: 2,
                        border: (theme) => `1px solid ${theme.palette.divider}`,
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                      }}
                    />
                  ) : isPdf ? (
                    <PictureAsPdfOutlinedIcon
                      sx={{
                        fontSize: 54,
                        color: "error.main",
                        mb: 0.5,
                      }}
                    />
                  ) : (
                    <DescriptionOutlinedIcon
                      sx={{
                        fontSize: 54,
                        color: "primary.main",
                        mb: 0.5,
                      }}
                    />
                  )}

                  <Box sx={{ textAlign: "center", px: 4 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(file.size)} • {t("business:dropzone_replace_hint")}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <>
                  <CloudUploadOutlinedIcon sx={{ fontSize: 36, color: "primary.main", mb: 0.5 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t("business:invoice_file_dropzone_prompt")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("business:invoice_file_dropzone_hint")}
                  </Typography>
                </>
              )}
            </FileDropzoneBox>
          </Box>
        )}

        {/* Form Inputs (filled manually) */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="code"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="invoice-code"
                  name={field.name}
                  label={t("business:invoice_code")}
                  placeholder="FAC-2026-001"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={!!errors.code}
                  helperText={errors.code?.message ? t(errors.code.message) : t("business:invoice_code_optional_helper")}
                  disabled={isSubmitting}
                  data-testid="invoice-code-input"
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="provider_id"
              control={control}
              render={({ field }) => (
                <SelectSingleInput
                  id="invoice-provider"
                  label={t("business:invoice_provider")}
                  {...providerSearch}
                  options={providerOptions}
                  value={field.value || null}
                  onChange={(val) => {
                    const option = providerOptions.find((item) => item.value === val);
                    setProviderChoice(option ? { id: option.value, name: option.label } : undefined);
                    field.onChange(val || null);
                  }}
                  placeholder={t("business:select_provider_optional")}
                  disabled={isSubmitting}
                  clearable
                  data-testid="invoice-provider-select"
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="total_amount"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="invoice-total-amount"
                  name={field.name}
                  type="number"
                  label={t("business:invoice_total")}
                  value={Number.isNaN(field.value) ? "" : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
                  onBlur={field.onBlur}
                  error={!!errors.total_amount || invalidAmount}
                  helperText={invalidAmount ? t("business:cash_invoice_invalid_amount") : errors.total_amount?.message && t(errors.total_amount.message)}
                  required
                  disabled={isSubmitting}
                  data-testid="invoice-total-amount-input"
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="issue_date"
              control={control}
              render={({ field }) => (
                <DateInput
                  id="invoice-issue-date"
                  name={field.name}
                  label={t("business:invoice_issue_date")}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={isSubmitting}
                  required={Boolean(category)}
                  error={invalidDate}
                  helperText={invalidDate ? t("business:cash_invoice_invalid_date") : undefined}
                  data-testid="invoice-issue-date-input"
                />
              )}
            />
          </Grid>

          {cash && (
            <Grid size={{ xs: 12 }}>
              <CashExpenseCategoryPicker
                id={pickerId}
                scope={cash.scope}
                selected={category}
                onChange={setCashCategory}
                onQuickCreate={() => setQuickOpen(true)}
                disabled={isSubmitting}
                error={invalidCategory}
                helperText={invalidCategory ? t("business:cash_category_inactive") : undefined}
              />
              {((currentCategory && initialData) || cashEffect) && (
                <Alert severity="info" role="status" sx={{ mt: 1 }}>
                  {currentCategory && initialData && (
                    <Typography variant="body2">
                      {t("business:cash.invoice_current_effect", {
                        amount: formatCashAmount(String(initialData.total_amount), i18n.language),
                        date: defaultValues?.issue_date || "—",
                        category: currentCategory.name,
                      })}
                    </Typography>
                  )}
                  {cashEffect && <Typography variant="body2">{cashEffect}</Typography>}
                </Alert>
              )}
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <Controller
              name="path_storage"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="invoice-path-storage"
                  name={field.name}
                  label={t("business:invoice_path")}
                  placeholder="https://storage.nodia.app/invoices/fac-001.pdf"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={!!errors.path_storage}
                  helperText={errors.path_storage?.message}
                  disabled={isSubmitting}
                  data-testid="invoice-path-input"
                />
              )}
            />
          </Grid>


          <Grid size={{ xs: 12 }}>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextInput
                  id="invoice-notes"
                  name={field.name}
                  label={t("business:invoice_notes")}
                  placeholder={t("business:invoice_notes_placeholder")}
                  multiline
                  rows={2}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={isSubmitting}
                  data-testid="invoice-notes-input"
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <SwitchWrapper>
              <Controller
                name="is_active"
                control={control}
                render={({ field }) => (
                  <StyledFormControlLabel
                    control={
                      <StyledSwitch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        name="is_active"
                        disabled={isSubmitting}
                        data-testid="invoice-active-switch"
                      />
                    }
                    label={t("business:active_label")}
                    labelPlacement="start"
                  />
                )}
              />
            </SwitchWrapper>
          </Grid>

        </Grid>
      </FormContainer>
    </BaseModal>
  );
};

export default InvoiceModal;
