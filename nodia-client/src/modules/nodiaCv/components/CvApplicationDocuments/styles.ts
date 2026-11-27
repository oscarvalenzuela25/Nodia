import type { SxProps, Theme } from "@mui/material/styles";

export const documentAction: SxProps<Theme> = { minHeight: 44, width: { xs: "100%", sm: "auto" } };
export const documentPanel: SxProps<Theme> = {
  "&.MuiAccordion-root": { borderRadius: 2, border: 1, borderColor: "divider", m: 0 },
  "&::before": { display: "none" },
};
export const attachmentSummary: SxProps<Theme> = { overflowWrap: "anywhere" };
