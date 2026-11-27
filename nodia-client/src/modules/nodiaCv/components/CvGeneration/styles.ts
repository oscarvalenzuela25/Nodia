import { alpha, getContrastRatio, type Theme } from "@mui/material/styles";

export const cvPrimaryHover = ({ palette }: Theme) => {
  const { dark, contrastText } = palette.primary;
  const { black, white } = palette.common;
  const hoverText = [contrastText, white, black].find((color) => getContrastRatio(color, dark) >= 4.5);

  return {
    "@media (hover: hover)": { "&:hover": { "--variant-containedColor": hoverText ?? contrastText } },
  };
};

export const cvEvidenceHighlight = ({ palette }: Theme) => ({
  "&[data-cv-evidence-highlighted]": {
    backgroundColor: alpha(palette.primary.main, palette.action.selectedOpacity),
    outline: `2px solid ${palette.primary.main}`,
    outlineOffset: -2,
    borderRadius: 0,
    scrollMarginBlock: "4rem",
  },
});
