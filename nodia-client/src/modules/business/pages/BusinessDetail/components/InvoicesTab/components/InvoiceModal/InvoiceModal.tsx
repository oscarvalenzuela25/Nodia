import type { FC, ChangeEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
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
import type { InvoiceEntity, ProviderEntity } from "../../../../../../infrastructure/types";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  FileDropzoneBox,
  ModalActionsContainer,
} from "./styles";

const invoiceSchema = z.object({
  code: z.string().min(1, "Código requerido"),
  provider_id: z.string().nullable().optional(),
  total_amount: z.number().min(0, "Monto debe ser >= 0"),
  path_storage: z.string(),
  issue_date: z.string(),
  notes: z.string(),
  is_active: z.boolean(),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

export interface InvoiceFormSubmitData extends InvoiceFormData {
  file?: File | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: InvoiceFormSubmitData) => Promise<void>;
  initialData?: InvoiceEntity | null;
  providers?: ProviderEntity[];
  isSubmitting?: boolean;
}

export const InvoiceModal: FC<Props> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  providers = [],
  isSubmitting = false,
}) => {
  const { t } = useTranslation(["business", "core"]);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [prevInitialData, setPrevInitialData] = useState(initialData);
  if (prevInitialData !== initialData) {
    setPrevInitialData(initialData);
    setFile(null);
  }
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    const preventBrowserFileDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", preventBrowserFileDrop);
    window.addEventListener("drop", preventBrowserFileDrop);
    return () => {
      window.removeEventListener("dragover", preventBrowserFileDrop);
      window.removeEventListener("drop", preventBrowserFileDrop);
    };
  }, []);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      code: "",
      provider_id: null,
      total_amount: 0,
      path_storage: "",
      issue_date: "",
      notes: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code,
        provider_id: initialData.provider_id || null,
        total_amount: initialData.total_amount,
        path_storage: initialData.path_storage || "",
        issue_date: (initialData.data?.issue_date as string) || "",
        notes: (initialData.data?.notes as string) || "",
        is_active: initialData.is_active,
      });
    } else {
      reset({
        code: "",
        provider_id: null,
        total_amount: 0,
        path_storage: "",
        issue_date: "",
        notes: "",
        is_active: true,
      });
    }
  }, [initialData, reset]);

  const providerOptions = useMemo(() => {
    return providers.map((p) => ({
      value: p.id,
      label: p.name,
    }));
  }, [providers]);

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
        form="invoice-form"
        disabled={isSubmitting}
        data-testid="save-invoice-btn"
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("business:save")}
      </Button>
    </ModalActionsContainer>
  );

  const onFormSubmit = async (data: InvoiceFormData) => {
    await onSubmit({
      ...data,
      file,
    });
  };

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
    >
      <FormContainer
        id="invoice-form"
        onSubmit={handleSubmit(onFormSubmit)}
      >
        {/* is_active Switch at top, matching Core pattern */}
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

        {/* File Upload Section */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
            {t("business:invoice_file_section_title")}
          </Typography>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isSubmitting}
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
            style={{ display: "none" }}
            data-testid="invoice-file-input"
          />

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
            ) : initialData?.path_storage ? (
              <Box
                data-testid="invoice-existing-file"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1.5,
                  width: "100%",
                }}
              >
                {getFileIcon(initialData.path_storage)}
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {initialData.path_storage.split("/").pop() || initialData.path_storage}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("business:invoice_existing_file_label")} • {t("business:dropzone_replace_hint")}
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
                  helperText={errors.code?.message}
                  required
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
                  options={providerOptions}
                  value={field.value || null}
                  onChange={(val) => field.onChange(val || null)}
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
                  value={String(field.value ?? 0)}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  error={!!errors.total_amount}
                  helperText={errors.total_amount?.message}
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
                <TextInput
                  id="invoice-issue-date"
                  name={field.name}
                  type="date"
                  label={t("business:invoice_issue_date")}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={isSubmitting}
                  data-testid="invoice-issue-date-input"
                />
              )}
            />
          </Grid>

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
        </Grid>
      </FormContainer>
    </BaseModal>
  );
};

export default InvoiceModal;
