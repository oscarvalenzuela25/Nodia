import { styled } from "@mui/material/styles";

export const SwapLabel = styled("label")({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  cursor: "pointer",
  width: "2.5rem",
  height: "2.5rem",
});

export const HiddenInput = styled("input")({
  position: "absolute",
  opacity: 0,
  width: 0,
  height: 0,
});
