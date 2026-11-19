import { styled } from "@mui/material/styles";

export const SwapLabel = styled("label")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  cursor: "pointer",
  width: "2.5rem",
  height: "2.5rem",
  borderRadius: "50%",
  "&:has(input:focus-visible)": { outline: "2px solid CanvasText", outlineOffset: 2 },
  [`${theme.breakpoints.down("sm")}, (pointer: coarse)`]: { width: 44, height: 44 },
}));

export const HiddenInput = styled("input")({
  position: "absolute",
  opacity: 0,
  width: 0,
  height: 0,
});
