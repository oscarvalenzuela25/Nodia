import { styled } from "@mui/material/styles";
import BaseModal from "../../../components/BaseModal";

export const ShortcutSheet = styled(BaseModal)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    "& .MuiDialog-container": { alignItems: "flex-end" },
    "& .MuiDialog-paper": { margin: 0, maxWidth: "100%", width: "100%", maxHeight: "85dvh", borderRadius: `${theme.spacing(3)} ${theme.spacing(3)} 0 0` },
    "& .MuiDialogActions-root": { paddingBottom: `calc(${theme.spacing(2)} + env(safe-area-inset-bottom, 0px))` },
  },
}));
