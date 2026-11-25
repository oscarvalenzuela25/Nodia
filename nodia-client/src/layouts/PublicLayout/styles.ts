import { styled } from "@mui/material/styles";

export const PublicLayoutRoot = styled("div")(({ theme }) => ({
  display: "flex",
  minHeight: "100vh",
  flexDirection: "column",
  backgroundColor: theme.palette.background.default,
  position: "relative",
  width: "100%",
  "&:has(> [data-connection-notice])": {
    minHeight: "100dvh",
    "& > header": {
      position: "static",
      alignSelf: "flex-end",
      marginBlockStart: theme.spacing(2),
      marginInlineEnd: theme.spacing(3),
    },
    "& > [data-public-content] > main": { minHeight: 0, flexGrow: 1 },
  },
}));

export const ControlsWrapper = styled("header")(({ theme }) => ({
  position: "fixed",
  top: theme.spacing(3),
  right: theme.spacing(3),
  zIndex: 1100,
  display: "flex",
  alignItems: "center",
}));

export const PublicLayoutContent = styled("div")({
  display: "flex",
  flex: 1,
  width: "100%",
  flexDirection: "column",
});
