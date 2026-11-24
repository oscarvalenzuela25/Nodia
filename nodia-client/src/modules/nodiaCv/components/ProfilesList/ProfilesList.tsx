import { Box, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import NavigateBeforeOutlined from "@mui/icons-material/NavigateBeforeOutlined";
import NavigateNextOutlined from "@mui/icons-material/NavigateNextOutlined";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import MobileRecordCard from "../../../../components/MobileRecordCard";
import type { ProfileSummary } from "../../infrastructure/profileSchema";

type Props = {
  data: ProfileSummary[];
  page: number;
  pages: number;
  disabled: boolean;
  onChangePage: (page: number) => void;
  onEdit: (profile: ProfileSummary) => void;
  onCopy: (profile: ProfileSummary) => void;
  onDelete: (profile: ProfileSummary) => void;
};

const target = { width: 44, height: 44 };
const textSx = { overflowWrap: "anywhere" };

export default function ProfilesList({ data, page, pages, disabled, onChangePage, onEdit, onCopy, onDelete }: Props) {
  const { t } = useTranslation("nodiaCv");
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      {narrow ? (
        <Stack component="ul" spacing={1.5} sx={{ m: 0, p: 0, listStyle: "none" }}>
          {data.map(profile => (
            <Box component="li" key={profile.id} sx={{ minWidth: 0 }}>
              <MobileRecordCard title={profile.profile_name} disabled={disabled}
                fields={[
                  { key: "person", label: t("fields.full_name"), value: profile.full_name, fullWidth: true },
                  ...(profile.professional_title ? [{ key: "position", label: t("fields.professional_title"), value: profile.professional_title, fullWidth: true }] : []),
                ]}
                primaryAction={{ key: "edit", label: t("edit_profile"), icon: <EditOutlined />, onClick: () => onEdit(profile) }}
                actions={[
                  { key: "copy", label: t("duplicate_profile"), icon: <ContentCopyOutlined />, onClick: () => onCopy(profile) },
                  { key: "delete", label: t("delete_profile"), color: "error", icon: <DeleteOutlined />, onClick: () => onDelete(profile) },
                ]} />
            </Box>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: "100%" }}>
          <Table aria-label={t("profiles_title")}>
            <TableHead>
              <TableRow>
                <TableCell>{t("fields.profile_name")}</TableCell>
                <TableCell>{t("fields.full_name")}</TableCell>
                <TableCell>{t("fields.professional_title")}</TableCell>
                <TableCell align="right" sx={{ width: 168 }}>{t("actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map(profile => (
                <TableRow hover key={profile.id}>
                  <TableCell component="th" scope="row" sx={textSx}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{profile.profile_name}</Typography>
                  </TableCell>
                  <TableCell sx={textSx}>{profile.full_name}</TableCell>
                  <TableCell sx={textSx}>{profile.professional_title || t("unassigned")}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                      <Tooltip title={t("edit_profile")}><span>
                        <IconButton sx={target} aria-label={t("edit_named", { name: profile.profile_name, interpolation: { escapeValue: false } })}
                          onClick={() => onEdit(profile)} disabled={disabled}><EditOutlined fontSize="small" /></IconButton>
                      </span></Tooltip>
                      <Tooltip title={t("duplicate_profile")}><span>
                        <IconButton sx={target} aria-label={t("copy_named", { name: profile.profile_name, interpolation: { escapeValue: false } })}
                          onClick={() => onCopy(profile)} disabled={disabled}><ContentCopyOutlined fontSize="small" /></IconButton>
                      </span></Tooltip>
                      <Tooltip title={t("delete_profile")}><span>
                        <IconButton sx={target} color="error" aria-label={t("delete_named", { name: profile.profile_name, interpolation: { escapeValue: false } })}
                          onClick={() => onDelete(profile)} disabled={disabled}><DeleteOutlined fontSize="small" /></IconButton>
                      </span></Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {pages > 1 && (
        <Stack component="nav" aria-label={t("pagination")} direction="row" sx={{ alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
          <Typography variant="body2" color="text.secondary" aria-live="polite">{t("page_count", { page, pages })}</Typography>
          <IconButton sx={target} aria-label={t("previous_page")} disabled={disabled || page <= 1} onClick={() => onChangePage(page - 1)}>
            <NavigateBeforeOutlined />
          </IconButton>
          <IconButton sx={target} aria-label={t("next_page")} disabled={disabled || page >= pages} onClick={() => onChangePage(page + 1)}>
            <NavigateNextOutlined />
          </IconButton>
        </Stack>
      )}
    </Stack>
  );
}
