export { ComposerShell, InputRow, MessageInput, Toolbar } from "../../../../components/MessageComposer/styles";

import { alpha, styled } from "@mui/material/styles";

export const ReviewArea = styled("div")(({ theme }) => ({
  minWidth: 0, minHeight: 0, flex: "0 1 auto", maxHeight: "min(25dvh, 14rem)", overflowY: "auto", padding: theme.spacing(0.5),
  scrollbarWidth: "thin", scrollbarColor: `${alpha(theme.palette.text.primary, 0.2)} transparent`,
  "&::-webkit-scrollbar": { width: 6, height: 6 },
  "&::-webkit-scrollbar-track": { background: "transparent !important" },
  "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
  "&::-webkit-scrollbar-thumb": { background: alpha(theme.palette.text.primary, 0.2), borderRadius: 9999, border: 0, "&:hover": { background: alpha(theme.palette.text.primary, 0.35) } },
}));
