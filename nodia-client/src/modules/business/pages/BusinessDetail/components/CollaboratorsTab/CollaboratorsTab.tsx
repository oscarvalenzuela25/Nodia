import type { FC } from "react";
import { useTranslation } from "react-i18next";
import {
  Avatar,
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
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import type { BusinessCollaborator } from "../../../../infrastructure/types";
import { SectionCard, SectionHeader, SectionTitle, StatusDot } from "../../styles";

interface Props {
  collaborators?: BusinessCollaborator[];
  onOpenAddCollaborator: () => void;
  isBusy?: boolean;
}

export const CollaboratorsTab: FC<Props> = ({
  collaborators = [],
  onOpenAddCollaborator,
  isBusy = false,
}) => {
  const { t } = useTranslation(["business", "core"]);

  return (
    <SectionCard>
      <SectionHeader>
        <SectionTitle>{t("business:collaborators_title")}</SectionTitle>
        <Button
          variant="contained"
          startIcon={<GroupAddOutlinedIcon />}
          onClick={onOpenAddCollaborator}
          disabled={isBusy}
          sx={{ borderRadius: 2 }}
          data-testid="add-collab-tab-btn"
        >
          {t("business:action_add_collaborator")}
        </Button>
      </SectionHeader>

      {collaborators.length > 0 ? (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ borderRadius: 2, overflow: "hidden" }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  {t("business:collab_col_user")}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  {t("business:collab_col_position")}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  {t("business:collab_col_actions")}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>
                  {t("business:collab_col_status")}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {t("core:actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {collaborators.map((collab) => (
                <TableRow key={collab.id} hover>
                  {/* Colaborador / Usuario */}
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar
                        src={collab.user?.image_url ?? undefined}
                        sx={{
                          bgcolor: "primary.main",
                          width: 38,
                          height: 38,
                          fontSize: "0.875rem",
                          fontWeight: 600,
                        }}
                      >
                        {collab.user?.name ? (
                          collab.user.name.charAt(0).toUpperCase()
                        ) : (
                          <PersonOutlinedIcon fontSize="small" />
                        )}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {collab.user?.name ?? `User #${collab.user_id}`}
                        </Typography>
                        {collab.user?.email && (
                          <Typography variant="caption" color="text.secondary">
                            {collab.user.email}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Cargo / Posición */}
                  <TableCell>
                    <Typography
                      variant="body2"
                      color={collab.position ? "text.primary" : "text.secondary"}
                    >
                      {collab.position || t("business:collab_no_position")}
                    </Typography>
                  </TableCell>

                  {/* Acciones Asignadas */}
                  <TableCell>
                    <Chip
                      label={t("business:collab_actions_assigned_count", {
                        count: collab.action_ids?.length ?? 0,
                        defaultValue: `${collab.action_ids?.length ?? 0} asignadas`,
                      })}
                      size="small"
                      variant="outlined"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>

                  {/* Estado */}
                  <TableCell align="center">
                    <Box
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <StatusDot active={collab.is_active} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {collab.is_active
                          ? t("business:status_active")
                          : t("business:status_inactive")}
                      </Typography>
                    </Box>
                  </TableCell>

                  {/* Acciones */}
                  <TableCell align="right">
                    <Tooltip title={t("business:manage_collaborators")}>
                      <IconButton
                        size="small"
                        onClick={onOpenAddCollaborator}
                        disabled={isBusy}
                        aria-label={t("business:action_update")}
                        data-testid={`edit-collab-btn-${collab.id}`}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box
          sx={{
            py: 6,
            textAlign: "center",
            borderRadius: 2,
            border: (theme) => `1px dashed ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {t("business:collaborators_empty")}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<GroupAddOutlinedIcon />}
            onClick={onOpenAddCollaborator}
            disabled={isBusy}
            sx={{ mt: 2, borderRadius: 2 }}
          >
            {t("business:add_new_collaborator")}
          </Button>
        </Box>
      )}
    </SectionCard>
  );
};

export default CollaboratorsTab;
