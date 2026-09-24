import type { FC, MouseEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
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
import { alpha, styled } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";

import Filter from "../../../../../../components/Filter";
import FilterChips from "../../../../../../components/Filter/components/FilterChips";
import TextInput from "../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import SelectMultipleInput from "../../../../../../components/inputs/SelectMultipleInput";
import InputSearch from "../../../../../../components/inputs/InputSearch";
import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import {
  useInvoices,
  useCreateInvoiceWithFile,
  useUpdateInvoice,
  useProviders,
} from "../../../../infrastructure/useServices";
import type { InvoiceEntity } from "../../../../infrastructure/types";
import InvoiceModal, { type InvoiceFormSubmitData } from "./components/InvoiceModal";
import InvoicePreviewModal from "./components/InvoicePreviewModal/InvoicePreviewModal";
import { StatusDot } from "../../styles";

const ActiveFilters = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  alignItems: "center",
}));

interface Props {
  businessId: string;
  isCreateModalOpenDirectly?: boolean;
  onCloseDirectCreateModal?: () => void;
}

export const InvoicesTab: FC<Props> = ({
  businessId,
  isCreateModalOpenDirectly = false,
  onCloseDirectCreateModal,
}) => {
  const { t, i18n } = useTranslation(["business", "core"]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, y, m, d] = match;
        return i18n.language.startsWith("en") ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "-";
      const locale = i18n.language.startsWith("en") ? "en-US" : "es-CL";
      return d.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceEntity | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceEntity | null>(null);

  const handleCopyPath = async (path?: string) => {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(path);
      sileo.success({
        title: t("business:invoice_path_copied_toast"),
        description: path,
      });
    } catch {
      // ignore
    }
  };

  // 3-Dots Action Menu state
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuInvoice, setMenuInvoice] = useState<InvoiceEntity | null>(null);

  // Confirm Dialog state
  const [confirmToggleInvoice, setConfirmToggleInvoice] = useState<InvoiceEntity | null>(null);

  // Filter modal draft state
  const [draftFilterCodes, setDraftFilterCodes] = useState<string[]>([]);
  const [draftFilterProviders, setDraftFilterProviders] = useState<string[]>([]);
  const [draftFilterDateFrom, setDraftFilterDateFrom] = useState<string>("");
  const [draftFilterDateTo, setDraftFilterDateTo] = useState<string>("");
  const [draftFilterActive, setDraftFilterActive] = useState<"active" | "inactive" | null>(null);

  // Applied filter state
  const [appliedFilterCodes, setAppliedFilterCodes] = useState<string[]>([]);
  const [appliedFilterProviders, setAppliedFilterProviders] = useState<string[]>([]);
  const [appliedFilterDateFrom, setAppliedFilterDateFrom] = useState<string>("");
  const [appliedFilterDateTo, setAppliedFilterDateTo] = useState<string>("");
  const [appliedFilterActive, setAppliedFilterActive] = useState<"active" | "inactive" | null>(null);

  const { data: providersData } = useProviders({
    q: { business_id_eq: businessId },
    limit: 100,
  });
  const providers = providersData?.data ?? [];

  // All invoices to populate distinct codes in filter
  const { data: allInvoicesData } = useInvoices({
    q: { business_id_eq: businessId },
    all: true,
  });

  const codeOptions = useMemo(() => {
    return Array.from(
      new Set(
        (allInvoicesData?.data ?? [])
          .map((inv) => inv.code)
          .filter(Boolean) as string[]
      )
    );
  }, [allInvoicesData]);

  const providerOptions = useMemo(() => {
    return providers.map((p) => ({
      value: p.id,
      label: p.name,
    }));
  }, [providers]);

  const statusOptions = useMemo(
    () => [
      { value: "active", label: t("business:status_active") },
      { value: "inactive", label: t("business:status_inactive") },
    ],
    [t]
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterCodes.length > 0) count += appliedFilterCodes.length;
    if (appliedFilterProviders.length > 0) count += appliedFilterProviders.length;
    if (appliedFilterDateFrom) count += 1;
    if (appliedFilterDateTo) count += 1;
    if (appliedFilterActive !== null) count += 1;
    return count;
  }, [
    appliedFilterCodes,
    appliedFilterProviders,
    appliedFilterDateFrom,
    appliedFilterDateTo,
    appliedFilterActive,
  ]);

  const handleApplyFilters = () => {
    setAppliedFilterCodes(draftFilterCodes);
    setAppliedFilterProviders(draftFilterProviders);
    setAppliedFilterDateFrom(draftFilterDateFrom);
    setAppliedFilterDateTo(draftFilterDateTo);
    setAppliedFilterActive(draftFilterActive);
  };

  const handleClearFilters = () => {
    setDraftFilterCodes([]);
    setDraftFilterProviders([]);
    setDraftFilterDateFrom("");
    setDraftFilterDateTo("");
    setDraftFilterActive(null);

    setAppliedFilterCodes([]);
    setAppliedFilterProviders([]);
    setAppliedFilterDateFrom("");
    setAppliedFilterDateTo("");
    setAppliedFilterActive(null);
  };

  const {
    data: invoicesData,
    isLoading,
    isFetching,
  } = useInvoices({
    q: {
      business_id_eq: businessId,
      code_cont: search || undefined,
      code_in: appliedFilterCodes.length > 0 ? appliedFilterCodes : undefined,
      provider_id_in:
        appliedFilterProviders.length > 0 ? appliedFilterProviders : undefined,
      issue_date_gteq: appliedFilterDateFrom || undefined,
      issue_date_lteq: appliedFilterDateTo || undefined,
      is_active_eq:
        appliedFilterActive === "active"
          ? true
          : appliedFilterActive === "inactive"
          ? false
          : undefined,
      s: "created_at desc",
    },
    limit: 100,
  });
  const invoices = invoicesData?.data ?? [];

  const visibleInvoicesCount = invoices.length;
  const visibleTotalAmount = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + (Number(inv.total_amount) || 0), 0);
  }, [invoices]);

  const createMutation = useCreateInvoiceWithFile();
  const updateMutation = useUpdateInvoice();
  const isBusy = createMutation.isPending || updateMutation.isPending;

  const handleOpenCreate = () => {
    setSelectedInvoice(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (invoice: InvoiceEntity) => {
    setSelectedInvoice(invoice);
    setIsModalOpen(true);
  };

  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    invoice: InvoiceEntity
  ) => {
    setActionMenuAnchorEl(e.currentTarget);
    setMenuInvoice(invoice);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchorEl(null);
  };

  const handleConfirmToggle = async () => {
    if (!confirmToggleInvoice) return;
    try {
      await updateMutation.mutateAsync({
        id: confirmToggleInvoice.id,
        payload: { is_active: !confirmToggleInvoice.is_active },
      });
      setConfirmToggleInvoice(null);
    } catch {
      // Keep confirm dialog open on error
    }
  };

  const handleFormSubmit = async (data: InvoiceFormSubmitData) => {
    try {
      if (selectedInvoice) {
        await updateMutation.mutateAsync({
          id: selectedInvoice.id,
          payload: {
            code: data.code,
            provider_id: data.provider_id || null,
            total_amount: data.total_amount,
            path_storage: data.path_storage,
            data: {
              ...selectedInvoice.data,
              issue_date: data.issue_date,
              notes: data.notes,
            },
            is_active: data.is_active,
          },
        });
      } else {
        await createMutation.mutateAsync({
          file: data.file || undefined,
          business_id: businessId,
          code: data.code,
          provider_id: data.provider_id || null,
          total_amount: data.total_amount,
          path_storage: data.path_storage || "",
          data: {
            issue_date: data.issue_date,
            notes: data.notes,
          },
        });
      }

      setIsModalOpen(false);
      setSelectedInvoice(null);
      if (onCloseDirectCreateModal) onCloseDirectCreateModal();
    } catch {
      // Do not close modal on error, allowing user to retry
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      {/* Filter Row */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Filter
          onFilter={handleApplyFilters}
          onClear={handleClearFilters}
          activeCount={activeFiltersCount}
          title={t("business:filter_invoices_title")}
          subtitle={t("business:filter_invoices_subtitle")}
        >
          <SelectMultipleInput
            label={t("business:filter_invoice_code_label")}
            placeholder={t("business:filter_invoice_code_placeholder")}
            options={codeOptions}
            value={draftFilterCodes}
            onChange={setDraftFilterCodes}
            disabled={isLoading || isFetching}
          />

          <SelectMultipleInput
            label={t("business:filter_provider_label")}
            placeholder={t("business:filter_provider_placeholder")}
            options={providerOptions}
            value={draftFilterProviders}
            onChange={setDraftFilterProviders}
            disabled={isLoading || isFetching}
          />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 1.5,
            }}
          >
            <TextInput
              type="date"
              label={t("business:filter_date_from_label")}
              value={draftFilterDateFrom}
              onChange={(e) => setDraftFilterDateFrom(e.target.value)}
              disabled={isLoading || isFetching}
              dataTestId="filter-invoice-date-from-input"
            />
            <TextInput
              type="date"
              label={t("business:filter_date_to_label")}
              value={draftFilterDateTo}
              onChange={(e) => setDraftFilterDateTo(e.target.value)}
              disabled={isLoading || isFetching}
              dataTestId="filter-invoice-date-to-input"
            />
          </Box>

          <SelectSingleInput
            label={t("business:filter_status_label")}
            placeholder={t("business:filter_status_placeholder")}
            options={statusOptions}
            value={draftFilterActive}
            onChange={(val) =>
              setDraftFilterActive(val as "active" | "inactive" | null)
            }
            disabled={isLoading || isFetching}
            clearable
          />
        </Filter>
      </Box>

      {/* Active Filters Chips */}
      {activeFiltersCount > 0 && (
        <ActiveFilters sx={{ mb: 2 }}>
          {appliedFilterCodes.map((code) => (
            <FilterChips
              key={`code-${code}`}
              label={t("business:filter_chips_code", { value: code })}
              onAction={() => {
                setAppliedFilterCodes((prev) => prev.filter((c) => c !== code));
                setDraftFilterCodes((prev) => prev.filter((c) => c !== code));
              }}
            />
          ))}
          {appliedFilterProviders.map((provId) => {
            const prov = providers.find((p) => p.id === provId);
            const provName = prov?.name || provId;
            return (
              <FilterChips
                key={`prov-${provId}`}
                label={t("business:filter_chips_provider", { value: provName })}
                onAction={() => {
                  setAppliedFilterProviders((prev) =>
                    prev.filter((id) => id !== provId)
                  );
                  setDraftFilterProviders((prev) =>
                    prev.filter((id) => id !== provId)
                  );
                }}
              />
            );
          })}
          {appliedFilterDateFrom && (
            <FilterChips
              label={t("business:filter_chips_date_from", {
                value: formatDate(appliedFilterDateFrom),
              })}
              onAction={() => {
                setAppliedFilterDateFrom("");
                setDraftFilterDateFrom("");
              }}
            />
          )}
          {appliedFilterDateTo && (
            <FilterChips
              label={t("business:filter_chips_date_to", {
                value: formatDate(appliedFilterDateTo),
              })}
              onAction={() => {
                setAppliedFilterDateTo("");
                setDraftFilterDateTo("");
              }}
            />
          )}
          {appliedFilterActive !== null && (
            <FilterChips
              label={
                appliedFilterActive === "active"
                  ? t("business:status_active")
                  : t("business:status_inactive")
              }
              onAction={() => {
                setAppliedFilterActive(null);
                setDraftFilterActive(null);
              }}
            />
          )}
        </ActiveFilters>
      )}

      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
            flex: { xs: "1 1 100%", md: "1 1 auto" },
          }}
        >
          <Box sx={{ width: { xs: "100%", sm: 300 } }}>
            <InputSearch
              value={search}
              onChange={(val: string) => setSearch(val)}
              placeholder={t("business:search_invoices_placeholder")}
              fullWidth
            />
          </Box>

          {/* Visible Invoices Summary Box */}
          <Box
            sx={(theme) => ({
              display: "inline-flex",
              alignItems: "center",
              gap: 2.5,
              px: 2,
              py: 0.85,
              borderRadius: 2.5,
              backgroundColor:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.background.paper, 0.6)
                  : alpha(theme.palette.grey[100], 0.8),
              border: `1px solid ${theme.palette.divider}`,
              flexWrap: "wrap",
            })}
            data-testid="invoices-visible-summary"
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography sx={{ fontSize: "16px", color: "text.secondary" }}>
                {t("business:invoices_visible_count_label")}:
              </Typography>
              <Typography
                sx={{ fontSize: "16px", fontWeight: 700 }}
                data-testid="invoices-visible-count"
              >
                {visibleInvoicesCount}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography sx={{ fontSize: "16px", color: "text.secondary" }}>
                {t("business:invoices_visible_total_label")}:
              </Typography>
              <Typography
                sx={{ fontSize: "16px", fontWeight: 700, color: "primary.main" }}
                data-testid="invoices-visible-total"
              >
                ${visibleTotalAmount.toLocaleString()}
              </Typography>

              <Tooltip
                title={t("business:invoices_visible_info_tooltip")}
                arrow
                placement="top"
              >
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: "help",
                    color: "text.secondary",
                    "&:hover": { color: "primary.main" },
                    transition: "color 0.15s ease",
                  }}
                  data-testid="invoices-visible-info-icon"
                >
                  <InfoOutlinedIcon sx={{ fontSize: 20 }} />
                </Box>
              </Tooltip>
            </Box>
          </Box>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          sx={{ borderRadius: 2 }}
          data-testid="new-invoice-btn"
        >
          {t("business:new_invoice_btn")}
        </Button>
      </Box>

      {/* Table */}
      <Skeleton loading={isLoading}>
        <TableContainer
          component={Paper}
          sx={{
            borderRadius: 3,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            boxShadow: "none",
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t("business:invoice_code")}</TableCell>
                <TableCell>{t("business:invoice_provider")}</TableCell>
                <TableCell align="right">{t("business:invoice_total")}</TableCell>
                <TableCell>{t("business:invoice_issue_date_col")}</TableCell>
                <TableCell>{t("business:invoice_path")}</TableCell>
                <TableCell align="center">{t("business:invoice_view_file_column")}</TableCell>
                <TableCell align="center">{t("business:active_label")}</TableCell>
                <TableCell align="right">{t("core:actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {t("business:invoices_empty_title")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("business:invoices_empty_desc")}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {inv.code}
                      </Typography>
                    </TableCell>
                    <TableCell>{inv.provider?.name ?? "-"}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      ${(inv.total_amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(inv.data?.issue_date || inv.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {inv.path_storage ? (
                        <Tooltip title={t("business:invoice_copy_path_tooltip")}>
                          <Box
                            component="button"
                            type="button"
                            onClick={() => handleCopyPath(inv.path_storage)}
                            sx={{
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.75,
                              maxWidth: 180,
                              background: "none",
                              border: (theme) => `1px dashed ${theme.palette.divider}`,
                              borderRadius: 1.5,
                              px: 1,
                              py: 0.5,
                              textAlign: "left",
                              transition: "all 0.15s ease",
                              "&:hover": {
                                borderColor: "primary.main",
                                backgroundColor: (theme) =>
                                  alpha(theme.palette.primary.main, 0.08),
                              },
                            }}
                            data-testid={`invoice-path-btn-${inv.id}`}
                          >
                            <ContentCopyIcon
                              sx={{ fontSize: 13, color: "text.secondary", flexShrink: 0 }}
                            />
                            <Typography
                              variant="caption"
                              sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: "text.primary",
                                fontWeight: 500,
                              }}
                            >
                              {inv.path_storage.split("/").pop() || inv.path_storage}
                            </Typography>
                          </Box>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {inv.path_storage ? (
                        <Tooltip title={t("business:invoice_view_file_tooltip")}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => setPreviewInvoice(inv)}
                            data-testid={`invoice-view-file-btn-${inv.id}`}
                            aria-label={t("business:invoice_view_file_tooltip")}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                        <StatusDot active={inv.is_active} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {inv.is_active ? t("business:status_active") : t("business:status_inactive")}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenActionMenu(e, inv)}
                        disabled={isBusy}
                        data-testid={`invoice-actions-btn-${inv.id}`}
                        aria-label={t("core:actions")}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Skeleton>

      {/* 3-Dots Actions Menu */}
      <Menu
        anchorEl={actionMenuAnchorEl}
        open={Boolean(actionMenuAnchorEl)}
        onClose={handleCloseActionMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              borderRadius: 2,
              minWidth: 160,
              boxShadow: theme.shadows[3],
              border: `1px solid ${theme.palette.divider}`,
            }),
          },
          list: {
            sx: {
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              p: 1,
            },
          },
        }}
      >
        {menuInvoice?.path_storage && (
          <MenuItem
            onClick={() => {
              if (menuInvoice) {
                setPreviewInvoice(menuInvoice);
              }
              handleCloseActionMenu();
            }}
            sx={{ borderRadius: 1 }}
            data-testid="menu-item-view-invoice-file"
          >
            <ListItemIcon>
              <VisibilityOutlinedIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText primary={t("business:invoice_view_file_tooltip")} />
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            if (menuInvoice) {
              handleOpenEdit(menuInvoice);
            }
            handleCloseActionMenu();
          }}
          sx={{ borderRadius: 1 }}
          data-testid="menu-item-edit-invoice"
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("business:action_update")} />
        </MenuItem>

        {menuInvoice && (
          <MenuItem
            onClick={() => {
              setConfirmToggleInvoice(menuInvoice);
              handleCloseActionMenu();
            }}
            sx={{ borderRadius: 1 }}
            data-testid="menu-item-toggle-invoice"
          >
            <ListItemIcon>
              {menuInvoice.is_active ? (
                <BlockOutlinedIcon fontSize="small" color="error" />
              ) : (
                <CheckCircleOutlineOutlinedIcon
                  fontSize="small"
                  color="success"
                />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                menuInvoice.is_active
                  ? t("business:action_deactivate")
                  : t("business:action_activate")
              }
            />
          </MenuItem>
        )}
      </Menu>

      {/* Confirm Deactivate / Activate Dialog */}
      <ConfirmDialog
        open={Boolean(confirmToggleInvoice)}
        onClose={() => setConfirmToggleInvoice(null)}
        onCancel={() => setConfirmToggleInvoice(null)}
        onConfirm={handleConfirmToggle}
        title={
          confirmToggleInvoice?.is_active
            ? t("business:confirm_deactivate_invoice_title")
            : t("business:confirm_activate_invoice_title")
        }
        message={
          confirmToggleInvoice?.is_active
            ? t("business:confirm_deactivate_invoice_message")
            : t("business:confirm_activate_invoice_message")
        }
        confirmText={
          confirmToggleInvoice?.is_active
            ? t("business:action_deactivate")
            : t("business:action_activate")
        }
        isLoading={updateMutation.isPending}
      />

      {/* Modal */}
      {(isModalOpen || isCreateModalOpenDirectly) && (
        <InvoiceModal
          open={isModalOpen || isCreateModalOpenDirectly}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedInvoice(null);
            if (onCloseDirectCreateModal) onCloseDirectCreateModal();
          }}
          onSubmit={handleFormSubmit}
          initialData={selectedInvoice}
          providers={providers}
          isSubmitting={isBusy}
        />
      )}

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        open={Boolean(previewInvoice)}
        onClose={() => setPreviewInvoice(null)}
        invoice={previewInvoice}
      />
    </Box>
  );
};

export default InvoicesTab;
