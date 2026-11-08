import type { FC } from "react";
import { useState } from "react";
import { Box, Button, Typography, Alert, Tooltip, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import BrokenImageIcon from "@mui/icons-material/BrokenImage";
import { Skeleton } from "boneyard-js/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";

import BaseModal from "../../../../../../../../components/BaseModal";
import { getInvoiceViewUrl } from "../../../../../../infrastructure/services";
import type { InvoiceEntity } from "../../../../../../infrastructure/types";

interface InvoicePreviewModalProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceEntity | null;
}

export const InvoicePreviewModal: FC<InvoicePreviewModalProps> = ({
  open,
  onClose,
  invoice,
}) => {
  const { t } = useTranslation(["business", "core"]);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["invoice-view-url", invoice?.id],
    queryFn: () => getInvoiceViewUrl(invoice!.id),
    enabled: Boolean(open && invoice?.id && invoice?.path_storage),
    staleTime: 10 * 60 * 1000,
  });

  const imageLoading = Boolean(
    data?.url && loadedUrl !== data.url && failedUrl !== data.url
  );
  const imageError = Boolean(data?.url && failedUrl === data.url);

  const handleCopyPath = async () => {
    if (!invoice?.path_storage) return;
    try {
      await navigator.clipboard.writeText(invoice.path_storage);
      sileo.success({
        title: t("business:invoice_path_copied_toast"),
        description: invoice.path_storage,
      });
    } catch {
      // ignore
    }
  };

  const isPdf = Boolean(
    invoice?.path_storage?.toLowerCase().endsWith(".pdf") ||
      data?.url?.toLowerCase().includes(".pdf")
  );

  const modalSubtitle = invoice?.path_storage
    ? invoice.path_storage.split("/").pop() || invoice.path_storage
    : undefined;

  const modalActions = (
    <Box sx={{ display: "flex", flexDirection: { xs: "column-reverse", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, gap: 1.5, width: "100%", justifyContent: "space-between" }}>
      <Tooltip title={t("business:invoice_copy_path_tooltip")}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ContentCopyIcon fontSize="small" />}
          onClick={handleCopyPath}
          disabled={!invoice?.path_storage}
          data-testid="preview-copy-path-btn"
        >
          {t("business:invoice_path")}
        </Button>
      </Tooltip>

      <Box sx={{ display: "flex", flexDirection: { xs: "column-reverse", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, gap: 1 }}>
        {data?.url && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon fontSize="small" />}
            onClick={() => window.open(data.url, "_blank", "noopener,noreferrer")}
            data-testid="preview-open-new-tab-btn"
          >
            {t("business:invoice_open_new_tab")}
          </Button>
        )}
        <Button variant="contained" size="small" onClick={onClose} data-testid="preview-close-btn">
          {t("core:close")}
        </Button>
      </Box>
    </Box>
  );

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={t("business:invoice_preview_title")}
      size="lg"
      actions={modalActions}
    >
      <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <Typography variant="subtitle2">{t("business:invoice_code")}: {invoice?.code}</Typography>
        {modalSubtitle && <Typography variant="body2" color="text.secondary">{modalSubtitle}</Typography>}
      </Box>
      <Box sx={{ minHeight: { xs: "min(240px, 35svh)", sm: 320 }, width: "100%", position: "relative" }}>
        {isLoading && (
          <Skeleton
            loading={isLoading}
            fallback={
              <Box
                data-testid="preview-skeleton-loader"
                sx={{
                  width: "100%",
                  height: { xs: 350, sm: 500, md: 580 },
                  borderRadius: 2,
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark"
                      ? alpha(theme.palette.background.paper, 0.4)
                      : alpha(theme.palette.grey[200], 0.6),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {t("core:loading")}
                </Typography>
              </Box>
            }
          >
            <Box
              data-testid="preview-skeleton-loader"
              sx={{
                width: "100%",
                height: { xs: 350, sm: 500, md: 580 },
                borderRadius: 2,
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? alpha(theme.palette.background.paper, 0.4)
                    : alpha(theme.palette.grey[200], 0.6),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t("core:loading")}
              </Typography>
            </Box>
          </Skeleton>
        )}

        {isError && !isLoading && (
          <Box sx={{ py: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <Alert
              severity="error"
              sx={{ width: "100%", minWidth: 0, flexWrap: { xs: "wrap", sm: "nowrap" }, "& .MuiAlert-action": { width: { xs: "100%", sm: "auto" }, margin: { xs: 0, sm: undefined }, padding: { xs: 0, sm: undefined } } }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  sx={{ minHeight: { xs: 44, sm: undefined }, width: { xs: "100%", sm: "auto" } }}
                  startIcon={<RefreshIcon />}
                  onClick={() => refetch()}
                >
                  {t("core:retry")}
                </Button>
              }
            >
              {t("business:invoice_preview_error")}
            </Alert>
          </Box>
        )}

        {!isLoading && !isError && data?.url && (
          <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
            {isPdf ? (
              <Box
                component="iframe"
                src={data.url}
                title={invoice?.code || "Invoice PDF"}
                data-testid="preview-iframe"
                sx={{
                  width: "100%",
                  height: { xs: 400, sm: 520, md: 620 },
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                  backgroundColor: "background.paper",
                }}
              />
            ) : (
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 1.5,
                  borderRadius: 2,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark"
                      ? alpha(theme.palette.background.paper, 0.5)
                      : alpha(theme.palette.grey[100], 0.7),
                  minHeight: 320,
                  maxHeight: { xs: 420, sm: 550, md: 650 },
                  overflow: "auto",
                  position: "relative",
                }}
              >
                {imageLoading && !imageError && (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1.5,
                      py: 6,
                    }}
                    data-testid="preview-image-spinner"
                  >
                    <CircularProgress size={32} />
                    <Typography variant="caption" color="text.secondary">
                      {t("core:loading")}
                    </Typography>
                  </Box>
                )}

                {imageError && (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1.5,
                      py: 4,
                      px: 2,
                      textAlign: "center",
                    }}
                    data-testid="preview-image-error"
                  >
                    <BrokenImageIcon sx={{ fontSize: 48, color: "text.disabled" }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {t("business:invoice_preview_empty_file_title")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 400 }}>
                      {t("business:invoice_preview_empty_file_desc")}
                    </Typography>
                  </Box>
                )}

                <Box
                  component="img"
                  src={data.url}
                  alt={invoice?.code || "Invoice file"}
                  data-testid="preview-image"
                  onLoad={() => setLoadedUrl(data.url)}
                  onError={() => setFailedUrl(data.url)}
                  sx={{
                    maxWidth: "100%",
                    maxHeight: { xs: 400, sm: 520, md: 620 },
                    objectFit: "contain",
                    borderRadius: 1,
                    display: imageLoading || imageError ? "none" : "block",
                  }}
                />
              </Box>
            )}
          </Box>
        )}
      </Box>
    </BaseModal>
  );
};

export default InvoicePreviewModal;
