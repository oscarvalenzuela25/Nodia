import { IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";

export const HandleButton = styled(IconButton)(({ theme }) => ({
  width: 44,
  height: 44,
  flexShrink: 0,
  touchAction: "none",
  cursor: "grab",
  color: theme.palette.text.secondary,
  "&:active": { cursor: "grabbing" },
  "&.Mui-disabled": { cursor: "default" },
}));
