import type { FC } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
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
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { Skeleton } from "boneyard-js/react";

import InputSearch from "../../../../../../components/inputs/InputSearch";
import {
  useInvoices,
  useCreateInvoiceWithFile,
  useUpdateInvoice,
  useProviders,
} from "../../../../infrastructure/useServices";
import type { InvoiceEntity } from "../../../../infrastructure/types";
import InvoiceModal, { type InvoiceFormSubmitData } from "./components/InvoiceModal";
import { StatusDot } from "../../styles";

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
  const { t } = useTranslation(["business", "core"]);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceEntity | null>(null);

  const { data: providersData } = useProviders({
    q: { business_id_eq: businessId },
    limit: 100,
  });
  const providers = providersData?.data ?? [];

  const {
    data: invoicesData,
    isLoading,
  } = useInvoices({
    q: {
      business_id_eq: businessId,
      code_cont: search || undefined,
    },
    limit: 100,
  });
  const invoices = invoicesData?.data ?? [];

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

  const handleToggleStatus = async (invoice: InvoiceEntity) => {
    await updateMutation.mutateAsync({
      id: invoice.id,
      payload: { is_active: !invoice.is_active },
    });
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
              status: data.status,
              issue_date: data.issue_date,
              due_date: data.due_date,
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
            status: data.status,
            issue_date: data.issue_date,
            due_date: data.due_date,
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Toolbar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ width: { xs: "100%", sm: 320 } }}>
          <InputSearch
            value={search}
            onChange={(val: string) => setSearch(val)}
            placeholder={t("business:search_invoices_placeholder")}
          />
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
                <TableCell>{t("business:invoice_path")}</TableCell>
                <TableCell align="center">{t("business:invoice_status")}</TableCell>
                <TableCell align="center">{t("business:active_label")}</TableCell>
                <TableCell align="right">{t("core:actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
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
                      {Boolean(inv.data?.issue_date) && (
                        <Typography variant="caption" color="text.secondary">
                          {String(inv.data?.issue_date)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{inv.provider?.name ?? "-"}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      ${(inv.total_amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {inv.path_storage ? (
                        <Tooltip title={inv.path_storage}>
                          <Typography
                            component="a"
                            href={inv.path_storage}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="caption"
                            sx={{
                              maxWidth: 200,
                              display: "inline-block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: "primary.main",
                              textDecoration: "none",
                              "&:hover": { textDecoration: "underline" },
                            }}
                          >
                            {inv.path_storage.split("/").pop() || inv.path_storage}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={
                          inv.data?.status === "overdue"
                            ? t("business:invoice_status_overdue")
                            : inv.data?.status === "pending"
                            ? t("business:invoice_status_pending")
                            : t("business:invoice_status_paid")
                        }
                        size="small"
                        color={
                          inv.data?.status === "overdue"
                            ? "error"
                            : inv.data?.status === "pending"
                            ? "warning"
                            : "success"
                        }
                        sx={{ height: 22, fontSize: "0.7rem", fontWeight: 600 }}
                      />
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
                      <Tooltip title={t("core:edit")}>
                        <IconButton size="small" onClick={() => handleOpenEdit(inv)} data-testid={`edit-invoice-${inv.id}`}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={inv.is_active ? t("business:action_deactivate") : t("business:action_activate")}>
                        <IconButton
                          size="small"
                          color={inv.is_active ? "error" : "success"}
                          onClick={() => handleToggleStatus(inv)}
                          data-testid={`toggle-invoice-${inv.id}`}
                        >
                          {inv.is_active ? (
                            <BlockOutlinedIcon fontSize="small" />
                          ) : (
                            <CheckCircleOutlineOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Skeleton>

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
    </Box>
  );
};

export default InvoicesTab;
