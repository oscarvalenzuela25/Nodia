import { IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";

export const ThumbnailButton = styled(IconButton)(({ theme }) => ({
  width: 50,
  height: 50,
  padding: 0,
  flexShrink: 0,
  overflow: "hidden",
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.primary.main,
}));

export const Image = styled("img")({
  display: "block",
  width: 50,
  height: 50,
  objectFit: "contain",
});
