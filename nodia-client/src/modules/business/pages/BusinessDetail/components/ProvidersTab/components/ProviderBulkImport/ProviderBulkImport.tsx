import type { FC, ChangeEvent, DragEvent } from "react";
import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import BaseModal from "../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "../ProviderModal/styles";
import {
  useBulkCreateProviders,
  useBulkUpdateProviders,
} from "../../../../../../infrastructure/useServices";
import type {
  CreateProviderPayload,
  BulkUpdateProviderItemPayload,
} from "../../../../../../infrastructure/types";
import { DropzoneBox, ValidBadge, ErrorBadge } from "../../../../styles";
import {
  type ProvisionalProviderRow,
  validateRow,
  parseCSV,
  generateTemplateCSV,
} from "./helpers";

interface Props {
  businessId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export const ProviderBulkImport: FC<Props> = ({
  businessId,
  onCancel,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation(["business", "core"]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<ProvisionalProviderRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ProvisionalProviderRow>>({});

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

  const bulkCreateMutation = useBulkCreateProviders();
  const bulkUpdateMutation = useBulkUpdateProviders();
  const isBusy = bulkCreateMutation.isPending || bulkUpdateMutation.isPending;

  const hasErrors = useMemo(() => rows.some((r) => !r.isValid), [rows]);

  const handleDownloadTemplate = () => {
    const csvContent = generateTemplateCSV(i18n.language);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = i18n.language?.startsWith("en")
      ? "provider_template_nodia.csv"
      : "plantilla_proveedores_nodia.csv";
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsedRows = parseCSV(text);
      setRows(parsedRows);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isBusy) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isBusy) {
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
    if (isBusy) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      processFile(dropped);
    }
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOpenEdit = (index: number) => {
    const row = rows[index];
    setEditingIndex(index);
    setEditFormData({
      ...row,
      code: { ...row.code },
      cost_price: { ...row.cost_price },
      cost_price_tax: { ...row.cost_price_tax },
      packages: { ...row.packages },
      units_per_package: { ...row.units_per_package },
    });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const { errors, isValid } = validateRow(editFormData);
    const updatedRow: ProvisionalProviderRow = {
      ...rows[editingIndex],
      ...editFormData,
      name: (editFormData.name ?? "").trim(),
      tax: Number(editFormData.tax ?? 19),
      is_active: editFormData.is_active ?? true,
      code: editFormData.code ?? { value: "", instructions: "" },
      cost_price: editFormData.cost_price ?? { value: "", instructions: "" },
      cost_price_tax: editFormData.cost_price_tax ?? { value: "", instructions: "" },
      packages: editFormData.packages ?? { value: "", instructions: "" },
      units_per_package: editFormData.units_per_package ?? { value: "", instructions: "" },
      errors,
      isValid,
    };

    setRows((prev) => {
      const copy = [...prev];
      copy[editingIndex] = updatedRow;
      // Re-sort: Invalid (red) rows always first!
      return copy.sort((a, b) => (a.isValid === b.isValid ? 0 : a.isValid ? 1 : -1));
    });

    setEditingIndex(null);
  };

  const handleSubmitAll = async () => {
    if (rows.length === 0 || hasErrors || isBusy) return;

    const newItems: CreateProviderPayload[] = [];
    const updateItems: BulkUpdateProviderItemPayload[] = [];

    const buildFieldsObject = (r: ProvisionalProviderRow) => {
      const fields: Record<string, { value: string; instructions: string }> = {};
      const mappingKeys = [
        "code",
        "cost_price",
        "cost_price_tax",
        "packages",
        "units_per_package",
      ] as const;

      for (const k of mappingKeys) {
        const item = r[k];
        if (item && item.value?.trim()) {
          fields[k] = {
            value: item.value.trim(),
            instructions: item.instructions?.trim() || "",
          };
        }
      }
      return fields;
    };

    rows.forEach((r) => {
      const fields = buildFieldsObject(r);
      if (r.id) {
        updateItems.push({
          id: r.id,
          name: r.name,
          tax: r.tax,
          fields,
          is_active: r.is_active,
        });
      } else {
        newItems.push({
          business_id: businessId,
          name: r.name,
          tax: r.tax,
          fields,
          is_active: r.is_active,
        });
      }
    });

    if (newItems.length > 0) {
      await bulkCreateMutation.mutateAsync(newItems);
    }
    if (updateItems.length > 0) {
      await bulkUpdateMutation.mutateAsync(updateItems);
    }

    onSuccess();
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header with back button & Download template */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onCancel}
          sx={{ borderRadius: 2 }}
        >
          {t("business:back_to_providers")}
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileDownloadOutlinedIcon />}
          onClick={handleDownloadTemplate}
          sx={{ borderRadius: 2 }}
        >
          {t("business:download_template_btn")}
        </Button>
      </Box>

      {/* Instructions Alert Box */}
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          {t("business:bulk_instructions_title")}
        </Typography>
        <Typography variant="body2" component="div">
          1. {t("business:provider_bulk_instruction_1")}
          <br />
          2. {t("business:provider_bulk_instruction_2")}
          <br />
          3. <strong>{t("business:provider_bulk_instruction_3")}</strong>
        </Typography>
      </Alert>

      {/* Dropzone */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,text/csv"
        style={{ display: "none" }}
      />
      <DropzoneBox
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          borderColor: isDragging ? "primary.main" : undefined,
          backgroundColor: isDragging ? "action.hover" : undefined,
          opacity: isBusy ? 0.6 : 1,
          pointerEvents: isBusy ? "none" : "auto",
        }}
      >
        <CloudUploadOutlinedIcon
          sx={{ fontSize: 48, color: "text.secondary", mb: 1 }}
        />
        {fileName ? (
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} color="primary">
            {t("business:dropzone_selected", { filename: fileName })}
          </Typography>
        ) : (
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t("business:dropzone_prompt")}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {t("business:bulk_csv_format_hint")}
        </Typography>
      </DropzoneBox>

      {/* Provisional Table */}
      {rows.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t("business:provider_provisional_table_title", {
                count: rows.length,
              })}
            </Typography>

            <Tooltip
              title={
                hasErrors ? t("business:must_fix_errors_warning") : ""
              }
            >
              <span>
                <Button
                  variant="contained"
                  onClick={handleSubmitAll}
                  disabled={hasErrors || isBusy}
                  loading={isBusy}
                  sx={{ borderRadius: 2 }}
                >
                  {t("business:save_bulk_providers_btn")}
                </Button>
              </span>
            </Tooltip>
          </Box>

          <Paper
            sx={{
              borderRadius: 3,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              boxShadow: "none",
              overflow: "hidden",
            }}
          >
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={50} align="center" />
                    <TableCell width={100}>
                      {t("business:provisional_table_type")}
                    </TableCell>
                    <TableCell>{t("business:provider_name")}</TableCell>
                    <TableCell align="center" width={110}>
                      {t("business:provider_tax")}
                    </TableCell>
                    <TableCell>{t("business:provider_col_code")}</TableCell>
                    <TableCell>
                      {t("business:provider_col_cost_price")}
                    </TableCell>
                    <TableCell>
                      {t("business:provider_col_cost_price_tax")}
                    </TableCell>
                    <TableCell>
                      {t("business:provider_col_packages")}
                    </TableCell>
                    <TableCell>
                      {t("business:provider_col_units_per_package")}
                    </TableCell>
                    <TableCell align="center" width={100}>
                      {t("business:product_status")}
                    </TableCell>
                    <TableCell align="right" width={90}>
                      {t("core:actions")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow
                      key={`prov-row-${idx}-${row.name}`}
                      hover
                      sx={{
                        backgroundColor: !row.isValid
                          ? (theme) =>
                              theme.palette.mode === "dark"
                                ? "rgba(244, 67, 54, 0.08)"
                                : "rgba(244, 67, 54, 0.04)"
                          : undefined,
                      }}
                    >
                      {/* Validity Dot Badge */}
                      <TableCell align="center">
                        <Tooltip
                          title={
                            row.isValid
                              ? t("business:row_valid_tooltip")
                              : t("business:row_error_tooltip", {
                                  errors: row.errors.join(", "),
                                })
                          }
                        >
                          <Box
                            sx={{
                              display: "inline-flex",
                              cursor: "pointer",
                            }}
                          >
                            {row.isValid ? <ValidBadge /> : <ErrorBadge />}
                          </Box>
                        </Tooltip>
                      </TableCell>

                      {/* Row Type: New or Update */}
                      <TableCell>
                        <Chip
                          size="small"
                          label={
                            row.id
                              ? t("business:provisional_table_type_update")
                              : t("business:provisional_table_type_new")
                          }
                          color={row.id ? "secondary" : "primary"}
                          variant="outlined"
                          sx={{ fontWeight: 600, borderRadius: 1.5 }}
                        />
                      </TableCell>

                      {/* Name */}
                      <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>

                      {/* Tax */}
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={`${row.tax}%`}
                          variant="outlined"
                          sx={{ fontWeight: 600, borderRadius: 1.5 }}
                        />
                      </TableCell>

                      {/* Code mapping */}
                      <TableCell sx={{ fontSize: "0.85rem" }}>
                        {row.code.value || "-"}
                      </TableCell>

                      {/* Cost price mapping */}
                      <TableCell sx={{ fontSize: "0.85rem" }}>
                        {row.cost_price.value || "-"}
                      </TableCell>

                      {/* Cost price tax mapping */}
                      <TableCell sx={{ fontSize: "0.85rem" }}>
                        {row.cost_price_tax.value || "-"}
                      </TableCell>

                      {/* Packages mapping */}
                      <TableCell sx={{ fontSize: "0.85rem" }}>
                        {row.packages.value || "-"}
                      </TableCell>

                      {/* Units per package mapping */}
                      <TableCell sx={{ fontSize: "0.85rem" }}>
                        {row.units_per_package.value || "-"}
                      </TableCell>

                      {/* Status */}
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={
                            row.is_active
                              ? t("business:status_active")
                              : t("business:status_inactive")
                          }
                          color={row.is_active ? "success" : "default"}
                          sx={{ fontWeight: 600, borderRadius: 1.5 }}
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right">
                        <Tooltip title={t("business:edit_row_tooltip")}>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEdit(idx)}
                            disabled={isBusy}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t("business:remove_row_tooltip")}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveRow(idx)}
                            disabled={isBusy}
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* Edit Provisional Provider Modal */}
      <BaseModal
        open={editingIndex !== null}
        onClose={() => setEditingIndex(null)}
        title={t("business:edit_provisional_provider")}
        size="md"
        actions={
          <ModalActionsContainer>
            <Button
              variant="contained"
              color="error"
              onClick={() => setEditingIndex(null)}
              sx={{ borderRadius: 2, px: 2.5 }}
            >
              {t("core:cancel")}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveEdit}
              sx={{ borderRadius: 2, px: 2.5 }}
            >
              {t("business:save_changes")}
            </Button>
          </ModalActionsContainer>
        }
      >
        <FormContainer onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }}>
          <TextInput
            label={t("business:provider_name")}
            value={editFormData.name ?? ""}
            onChange={(e) =>
              setEditFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />

          <TextInput
            label={t("business:provider_tax")}
            type="number"
            value={String(editFormData.tax ?? 19)}
            onChange={(e) =>
              setEditFormData((prev) => ({
                ...prev,
                tax: Number(e.target.value),
              }))
            }
          />

          <SwitchWrapper>
            <StyledFormControlLabel
              control={
                <StyledSwitch
                  checked={editFormData.is_active ?? true}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                />
              }
              label={
                editFormData.is_active
                  ? t("business:status_active")
                  : t("business:status_inactive")
              }
              labelPlacement="start"
            />
          </SwitchWrapper>

          <Divider sx={{ my: 1 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {t("business:invoice_columns_mapping_title")}
          </Typography>

          <Grid container spacing={2}>
            {/* Code */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                label={t("business:mapping_field_code_label")}
                value={editFormData.code?.value ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    code: {
                      value: e.target.value,
                      instructions: prev.code?.instructions ?? "",
                    },
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                label={t("business:mapping_field_instructions_label")}
                value={editFormData.code?.instructions ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    code: {
                      value: prev.code?.value ?? "",
                      instructions: e.target.value,
                    },
                  }))
                }
              />
            </Grid>

            {/* Cost price */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                label={t("business:mapping_field_cost_price_label")}
                value={editFormData.cost_price?.value ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    cost_price: {
                      value: e.target.value,
                      instructions: prev.cost_price?.instructions ?? "",
                    },
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                label={t("business:mapping_field_instructions_label")}
                value={editFormData.cost_price?.instructions ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    cost_price: {
                      value: prev.cost_price?.value ?? "",
                      instructions: e.target.value,
                    },
                  }))
                }
              />
            </Grid>

            {/* Cost price tax */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                label={t("business:mapping_field_cost_price_tax_label")}
                value={editFormData.cost_price_tax?.value ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    cost_price_tax: {
                      value: e.target.value,
                      instructions: prev.cost_price_tax?.instructions ?? "",
                    },
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                label={t("business:mapping_field_instructions_label")}
                value={editFormData.cost_price_tax?.instructions ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    cost_price_tax: {
                      value: prev.cost_price_tax?.value ?? "",
                      instructions: e.target.value,
                    },
                  }))
                }
              />
            </Grid>

            {/* Packages */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                label={t("business:mapping_field_packages_label")}
                value={editFormData.packages?.value ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    packages: {
                      value: e.target.value,
                      instructions: prev.packages?.instructions ?? "",
                    },
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                label={t("business:mapping_field_instructions_label")}
                value={editFormData.packages?.instructions ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    packages: {
                      value: prev.packages?.value ?? "",
                      instructions: e.target.value,
                    },
                  }))
                }
              />
            </Grid>

            {/* Units per package */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                label={t("business:mapping_field_units_per_package_label")}
                value={editFormData.units_per_package?.value ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    units_per_package: {
                      value: e.target.value,
                      instructions: prev.units_per_package?.instructions ?? "",
                    },
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                label={t("business:mapping_field_instructions_label")}
                value={editFormData.units_per_package?.instructions ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    units_per_package: {
                      value: prev.units_per_package?.value ?? "",
                      instructions: e.target.value,
                    },
                  }))
                }
              />
            </Grid>
          </Grid>
        </FormContainer>
      </BaseModal>
    </Box>
  );
};
