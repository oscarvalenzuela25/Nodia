import type { FC } from "react";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";

import type { BusinessCollaborator } from "../../../../infrastructure/types";
import { SectionCard, SectionHeader, SectionTitle } from "../../styles";

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
        <Stack spacing={2}>
          {collaborators.map((collab) => (
            <Box
              key={collab.id}
              sx={{
                p: 2,
                borderRadius: 2.5,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Avatar sx={{ bgcolor: "primary.main", width: 42, height: 42 }}>
                  <PersonOutlinedIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {collab.user?.name ?? `User #${collab.user_id}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {collab.position || collab.user?.email || "Colaborador"}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Chip
                  label={`${collab.action_ids?.length ?? 0} acciones asignadas`}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ fontWeight: 600 }}
                />
              </Box>
            </Box>
          ))}
        </Stack>
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
