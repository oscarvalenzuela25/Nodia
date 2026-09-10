import { styled, type Theme } from "@mui/material/styles";
import { Box } from "@mui/material";

interface CustomBackground {
  default: string;
  main?: string;
}

const getBackgroundColor = (theme: Theme): string => {
  const bg = theme.palette.background as unknown as CustomBackground;
  return bg.main ?? bg.default;
};

export const FullScreenLoadingWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100vw",
  height: "100vh",
  backgroundColor: getBackgroundColor(theme),
}));

export const FullScreenErrorWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100vw",
  height: "100vh",
  backgroundColor: getBackgroundColor(theme),
  padding: theme.spacing(2),
}));
