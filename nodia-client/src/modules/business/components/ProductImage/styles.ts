import { styled } from "@mui/material/styles";
export const ImageFrame = styled("div")(({ theme }) => ({
  width: 112, height: 112, borderRadius: theme.shape.borderRadius, border: `1px solid ${theme.palette.divider}`,
  display: "grid", placeItems: "center", color: theme.palette.text.secondary, fontSize: theme.typography.caption.fontSize,
  "& img": { width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" },
}));
