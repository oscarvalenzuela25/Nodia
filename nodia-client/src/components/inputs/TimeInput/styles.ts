import { Box } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
export const ClockSurface = styled(Box)(({ theme }) => {
  const thumb = alpha(
    theme.palette.mode === "dark" ? "#ffffff" : "#000000",
    0.2,
  );
  return {
    minWidth: 160,
    ".MuiMultiSectionDigitalClockSection-root": {
      scrollbarWidth: "thin",
      scrollbarColor: `${thumb} transparent`,
      "&::-webkit-scrollbar": { width: 6 },
      "&::-webkit-scrollbar-track": { background: "transparent !important" },
      "&::-webkit-scrollbar-button": {
        display: "none !important",
        width: 0,
        height: 0,
      },
      "&::-webkit-scrollbar-thumb": {
        background: thumb,
        borderRadius: 9999,
        "&:hover": {
          background: alpha(
            theme.palette.mode === "dark" ? "#ffffff" : "#000000",
            0.35,
          ),
        },
      },
    },
  };
});
