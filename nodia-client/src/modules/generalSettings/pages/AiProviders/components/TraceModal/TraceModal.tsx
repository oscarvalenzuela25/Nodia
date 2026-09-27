import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Button, Paper, Divider } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import BaseModal from "../../../../../../components/BaseModal";
import type { AiProviderEventEntity } from "../../infrastructure/types";

const DetailGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2.5),
}));

const DetailBlock = styled(Box)(() => ({
  display: "flex",
  flexDirection: "column",
  gap: 4,
}));

const DetailLabel = styled(Typography)(({ theme }) => ({
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: theme.palette.text.secondary,
}));

const DetailValue = styled(Typography)(({ theme }) => ({
  fontSize: "0.875rem",
  fontWeight: 600,
  color: theme.palette.text.primary,
}));

const MessagePaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.background.default, 0.7),
  border: `1px solid ${theme.palette.divider}`,
  fontFamily: "monospace",
  fontSize: "0.8125rem",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  color: theme.palette.text.primary,
}));

interface TraceModalProps {
  open: boolean;
  event: AiProviderEventEntity | null;
  onClose: () => void;
}

const TraceModal: FC<TraceModalProps> = ({ open, event, onClose }) => {
  const { t } = useTranslation(["ai_providers", "core"]);

  if (!event) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      const d = new Date(dateString);
      return d.toLocaleString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const initiatorText = event.actor_user
    ? `${event.actor_user.first_name || ""} ${event.actor_user.last_name || ""} (${event.actor_user.email})`.trim()
    : "Sistema / Daemon Automatizado";

  const modalActions = (
    <Button
      variant="contained"
      color="primary"
      onClick={onClose}
      sx={{ borderRadius: 2, px: 3 }}
    >
      {t("ai_providers:modal_trace.close", "Cerrar")}
    </Button>
  );

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={t("ai_providers:modal_trace.title", "Detalle de Traza de Auditoría")}
      size="md"
      actions={modalActions}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <DetailGrid>
          <DetailBlock>
            <DetailLabel>{t("ai_providers:modal_trace.event_type", "Tipo de evento")}</DetailLabel>
            <DetailValue>{event.event_type}</DetailValue>
          </DetailBlock>

          <DetailBlock>
            <DetailLabel>{t("ai_providers:modal_trace.reason_code", "Código de motivo")}</DetailLabel>
            <DetailValue sx={{ color: "primary.main" }}>{event.reason_code || "N/A"}</DetailValue>
          </DetailBlock>

          <DetailBlock>
            <DetailLabel>{t("ai_providers:modal_trace.provider", "Proveedor")}</DetailLabel>
            <DetailValue>{event.provider?.key || "Sistema"}</DetailValue>
          </DetailBlock>

          <DetailBlock>
            <DetailLabel>{t("ai_providers:modal_trace.timestamp", "Marca de tiempo")}</DetailLabel>
            <DetailValue>{formatDate(event.created_at)}</DetailValue>
          </DetailBlock>
        </DetailGrid>

        <Divider />

        <DetailBlock>
          <DetailLabel>{t("ai_providers:modal_trace.initiator", "Iniciador")}</DetailLabel>
          <DetailValue>{initiatorText}</DetailValue>
        </DetailBlock>

        <DetailBlock>
          <DetailLabel>{t("ai_providers:modal_trace.message", "Mensaje y detalles")}</DetailLabel>
          <MessagePaper elevation={0}>
            {event.message}
          </MessagePaper>
        </DetailBlock>
      </Box>
    </BaseModal>
  );
};

export default TraceModal;
