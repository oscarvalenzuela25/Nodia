import type { FC } from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  Button,
  Box,
  Typography,
  LinearProgress,
} from "@mui/material";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Skeleton } from "boneyard-js/react";
import InputSearch from "../../../../../../components/inputs/InputSearch";
import type { AiProviderEventEntity } from "../../infrastructure/types";
import {
  TablePanel,
  TablePanelHeader,
  HeaderTitleBox,
  HeaderIconBox,
  TableTitle,
  TableSubtitle,
  StyledTableContainer,
  StyledTableHead,
  HeadCell,
  BodyRow,
  BodyCell,
  ProviderBadge,
  ImpactBadge,
  EmptyBox,
} from "./styles";

interface AiEventsTableProps {
  events: AiProviderEventEntity[];
  isLoading: boolean;
  isFetching?: boolean;
  totalItems: number;
  page: number;
  limit: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newLimit: number) => void;
  onViewTrace: (event: AiProviderEventEntity) => void;
}

const AiEventsTable: FC<AiEventsTableProps> = ({
  events,
  isLoading,
  isFetching = false,
  totalItems,
  page,
  limit,
  searchValue,
  onSearchChange,
  onPageChange,
  onRowsPerPageChange,
  onViewTrace,
}) => {
  const { t } = useTranslation(["ai_providers", "core"]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getProviderIcon = (key?: string) => {
    const k = (key || "").toLowerCase();
    if (k.includes("gemini")) {
      return <AutoAwesomeOutlinedIcon sx={{ fontSize: 14, color: "#818cf8" }} />;
    }
    if (k.includes("mistral")) {
      return <HubOutlinedIcon sx={{ fontSize: 14, color: "#2dd4bf" }} />;
    }
    return <SmartToyOutlinedIcon sx={{ fontSize: 14, color: "#a78bfa" }} />;
  };

  const getImpactBadge = (code?: string, eventType?: string) => {
    const c = (code || "").toUpperCase();
    const type = (eventType || "").toUpperCase();

    if (c.includes("401") || c.includes("AUTH") || type.includes("EXPIRED")) {
      return <ImpactBadge severity="warning">• {code || "401 Invalidated"}</ImpactBadge>;
    }
    if (c.includes("429") || type.includes("FAILOVER") || type.includes("ROTAT")) {
      return <ImpactBadge severity="success">• {code ? `Failover OK (${code})` : "Failover OK (429)"}</ImpactBadge>;
    }
    if (c.includes("200") || type.includes("HEALTH") || type.includes("SUCCESS")) {
      return <ImpactBadge severity="success">• {code || "200 Exitosa"}</ImpactBadge>;
    }
    if (type.includes("KEY") || type.includes("SECRET") || type.includes("AUDIT")) {
      return (
        <ImpactBadge severity="info">
          <LockOutlinedIcon sx={{ fontSize: 12 }} />
          Auditoría Key
        </ImpactBadge>
      );
    }
    return <ImpactBadge severity="default">• {code || eventType || "Evento"}</ImpactBadge>;
  };

  const getInitiatorText = (event: AiProviderEventEntity) => {
    if (event.actor_user) {
      const name = `${event.actor_user.first_name || ""} ${event.actor_user.last_name || ""}`.trim();
      return name || event.actor_user.email || "Usuario del Sistema";
    }
    if (event.event_type?.includes("failover")) {
      return "Failover Arbiter Engine";
    }
    if (event.event_type?.includes("auth") || event.event_type?.includes("session")) {
      return "Sistema (Host Daemon)";
    }
    return "Sistema Automatizado";
  };

  return (
    <TablePanel>
      <TablePanelHeader>
        <HeaderTitleBox>
          <HeaderIconBox>
            <HistoryOutlinedIcon sx={{ fontSize: 24 }} />
          </HeaderIconBox>
          <Box>
            <TableTitle>
              {t(
                "ai_providers:events_table.title",
                "Historial de Incidentes, Rotaciones y Auditoría"
              )}
            </TableTitle>
            <TableSubtitle>
              {t(
                "ai_providers:events_table.subtitle",
                "Registro inmutable de transiciones de estado, fallbacks y llamadas a llaves maestras."
              )}
            </TableSubtitle>
          </Box>
        </HeaderTitleBox>

        <Box sx={{ width: { xs: "100%", sm: 340 } }}>
          <InputSearch
            value={searchValue}
            onChange={onSearchChange}
            placeholder={t(
              "ai_providers:events_table.search_placeholder",
              "Filtrar por evento o hash..."
            )}
            size="small"
            fullWidth
          />
        </Box>
      </TablePanelHeader>

      {isFetching && !isLoading && (
        <LinearProgress sx={{ borderRadius: 1, height: 2, my: -1 }} />
      )}

      <Skeleton loading={isLoading}>
        <StyledTableContainer>
          <Table size="small">
            <StyledTableHead>
              <TableRow>
                <HeadCell>
                  {t("ai_providers:events_table.col_datetime", "FECHA / HORA")}
                </HeadCell>
                <HeadCell>
                  {t("ai_providers:events_table.col_provider", "PROVEEDOR")}
                </HeadCell>
                <HeadCell>
                  {t("ai_providers:events_table.col_event", "EVENTO REGISTRADO")}
                </HeadCell>
                <HeadCell>
                  {t("ai_providers:events_table.col_impact", "IMPACTO / CÓDIGO")}
                </HeadCell>
                <HeadCell>
                  {t("ai_providers:events_table.col_initiator", "INICIADOR")}
                </HeadCell>
                <HeadCell align="right">
                  {t("ai_providers:events_table.col_trace", "TRAZA")}
                </HeadCell>
              </TableRow>
            </StyledTableHead>

            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                    <EmptyBox>
                      <HistoryOutlinedIcon sx={{ fontSize: 40, color: "text.disabled" }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t(
                          "ai_providers:events_table.empty_title",
                          "Sin registros de auditoría"
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          "ai_providers:events_table.empty_desc",
                          "No se han registrado eventos o transiciones recientes para los filtros seleccionados."
                        )}
                      </Typography>
                    </EmptyBox>
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <BodyRow key={event.id}>
                    <BodyCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>
                      {formatDate(event.created_at)}
                    </BodyCell>

                    <BodyCell>
                      <ProviderBadge>
                        {getProviderIcon(event.provider?.key)}
                        {event.provider?.key === "gemini"
                          ? "Gemini"
                          : event.provider?.key === "mistral"
                          ? "Mistral AI"
                          : event.provider?.key || "General"}
                      </ProviderBadge>
                    </BodyCell>

                    <BodyCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.8125rem" }}>
                        {event.event_type.replace(/_/g, " ")}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", fontSize: "0.75rem", mt: 0.25 }}
                      >
                        {event.message}
                      </Typography>
                    </BodyCell>

                    <BodyCell>
                      {getImpactBadge(event.reason_code, event.event_type)}
                    </BodyCell>

                    <BodyCell sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                      {getInitiatorText(event)}
                    </BodyCell>

                    <BodyCell align="right">
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => onViewTrace(event)}
                        sx={{
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          textTransform: "none",
                          color: "primary.main",
                          p: 0.5,
                          minWidth: 0,
                          "&:hover": {
                            textDecoration: "underline",
                            background: "transparent",
                          },
                        }}
                      >
                        {t("ai_providers:events_table.view_trace", "Ver Traza")}
                      </Button>
                    </BodyCell>
                  </BodyRow>
                ))
              )}
            </TableBody>
          </Table>
        </StyledTableContainer>
      </Skeleton>

      <TablePagination
        component="div"
        count={totalItems}
        page={page}
        onPageChange={(_, newPage) => onPageChange(newPage)}
        rowsPerPage={limit}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage={t("core:rows_per_page", "Filas por página:")}
        sx={{
          borderTop: 0,
          color: "text.secondary",
        }}
      />
    </TablePanel>
  );
};

export default AiEventsTable;
