import { IconButton, styled } from "@mui/material";

export const HelpButton = styled(IconButton)(({ theme }) => ({
  flexShrink: 0, width: 44, height: 44, color: theme.palette.text.secondary,
}));
