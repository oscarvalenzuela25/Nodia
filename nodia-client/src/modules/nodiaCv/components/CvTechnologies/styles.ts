import type { SxProps, Theme } from "@mui/material";

export const technologyAction = { minHeight: 44 };

export const technologyRow: SxProps<Theme> = {
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  borderBottom: 1,
  borderColor: "divider",
  py: 0.25,
  minHeight: 44,
};
