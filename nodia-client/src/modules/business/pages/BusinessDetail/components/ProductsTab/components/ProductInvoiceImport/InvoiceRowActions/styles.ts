import { Menu } from "@mui/material";
import { styled } from "@mui/material/styles";

export const ActionsMenu = styled(Menu)(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: theme.spacing(2),
    minWidth: 200,
    maxWidth: "calc(100vw - 32px)",
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[3],
  },
  "& .MuiList-root": { display: "flex", flexDirection: "column", gap: theme.spacing(0.5), padding: theme.spacing(1) },
  "& .MuiMenuItem-root": { borderRadius: theme.shape.borderRadius, minHeight: 44, whiteSpace: "normal" },
}));
