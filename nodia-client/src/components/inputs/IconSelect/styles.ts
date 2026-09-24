import {
  Box,
  Typography,
  Popover,
  TextField,
} from "@mui/material";
import { styled, alpha } from "@mui/material/styles";

export const SelectContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== "fullWidth",
})<{ fullWidth?: boolean }>(({ fullWidth }) => ({
  display: "flex",
  flexDirection: "column",
  width: fullWidth ? "100%" : "auto",
  gap: "6px",
}));

export const LabelTypography = styled("label")<{ required?: boolean }>(
  ({ theme }) => ({
    ...theme.typography.body2,
    fontWeight: 600,
    color: theme.palette.text.primary,
    fontSize: "0.875rem",
    userSelect: "none",
    display: "block",
  })
);

export const RequiredStar = styled("span")(({ theme }) => ({
  color: theme.palette.error.main,
  marginLeft: "2px",
}));

export const SelectTrigger = styled(Box, {
  shouldForwardProp: (prop) =>
    prop !== "isOpen" && prop !== "isError" && prop !== "isDisabled",
})<{ isOpen?: boolean; isError?: boolean; isDisabled?: boolean }>(
  ({ theme, isOpen, isError, isDisabled }) => {
    const defaultBorder = theme.palette.border?.default ?? theme.palette.divider;
    let borderColor = defaultBorder;
    if (isError) {
      borderColor = theme.palette.error.main;
    } else if (isOpen) {
      borderColor = theme.palette.primary.main;
    }

    return {
      minHeight: "44px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 12px",
      borderRadius:
        typeof theme.shape.borderRadius === "number"
          ? theme.shape.borderRadius * 1.5
          : 8,
      border: `1.5px solid ${borderColor}`,
      backgroundColor: theme.palette.background.paper,
      cursor: isDisabled ? "not-allowed" : "pointer",
      opacity: isDisabled ? 0.6 : 1,
      transition: theme.transitions.create(
        ["border-color", "box-shadow", "background-color"],
        { duration: theme.transitions.duration.shorter }
      ),
      boxShadow: isOpen
        ? `0 0 0 3px ${alpha(
            isError ? theme.palette.error.main : theme.palette.primary.main,
            0.15
          )}`
        : "none",
      "&:hover": {
        borderColor: isError
          ? theme.palette.error.main
          : isOpen
          ? theme.palette.primary.main
          : theme.palette.text.secondary,
      },
    };
  }
);

export const ValueContainer = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
});

export const SelectedText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: "0.875rem",
  fontWeight: 500,
  lineHeight: 1.5,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}));

export const PlaceholderText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.disabled,
  fontSize: "0.875rem",
  lineHeight: 1.5,
}));

export const StyledPopover = styled(Popover)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    "& .MuiPaper-root": {
      borderRadius:
        typeof theme.shape.borderRadius === "number"
          ? theme.shape.borderRadius * 1.5
          : 8,
      boxShadow: theme.shadows[4],
      marginTop: "6px",
      border: `1px solid ${borderColor}`,
      maxHeight: "440px",
      display: "flex",
      flexDirection: "column",
      backgroundColor: theme.palette.background.paper,
      overflow: "hidden",
    },
  };
});

export const SearchContainer = styled(Box)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    padding: "10px 12px",
    borderBottom: `1px solid ${borderColor}`,
    position: "sticky",
    top: 0,
    backgroundColor: theme.palette.background.paper,
    zIndex: 1,
    boxSizing: "border-box",
    width: "100%",
  };
});

export const SearchField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    borderRadius:
      typeof theme.shape.borderRadius === "number"
        ? theme.shape.borderRadius
        : 6,
    fontSize: "0.875rem",
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(0, 0, 0, 0.03)",
    "& fieldset": {
      borderColor: "transparent",
    },
    "&:hover fieldset": {
      borderColor: theme.palette.primary.light,
    },
    "&.Mui-focused fieldset": {
      borderColor: theme.palette.primary.main,
    },
  },
  "& .MuiOutlinedInput-input": {
    padding: "6px 8px",
  },
}));

export const OptionsContainer = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  const thumbColor = isDark
    ? alpha("#ffffff", 0.2)
    : alpha("#000000", 0.2);
  const thumbHoverColor = isDark
    ? alpha("#ffffff", 0.35)
    : alpha("#000000", 0.35);

  return {
    padding: "10px 8px",
    overflowY: "auto",
    overflowX: "hidden",
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
    gap: "8px",
    boxSizing: "border-box",
    width: "100%",
    scrollbarWidth: "thin",
    scrollbarColor: `${thumbColor} transparent`,
    "&::-webkit-scrollbar": {
      width: "6px",
      height: "0px",
    },
    "&::-webkit-scrollbar-track": {
      background: "transparent !important",
    },
    "&::-webkit-scrollbar-button": {
      display: "none !important",
      width: 0,
      height: 0,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: thumbColor,
      borderRadius: "9999px",
      "&:hover": {
        backgroundColor: thumbHoverColor,
      },
    },
  };
});

export const IconOptionButton = styled(Box, {
  shouldForwardProp: (prop) => prop !== "isSelected",
})<{ isSelected?: boolean }>(({ theme, isSelected }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 6px",
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius
      : 8,
  cursor: "pointer",
  textAlign: "center",
  gap: "6px",
  backgroundColor: isSelected
    ? alpha(theme.palette.primary.main, 0.12)
    : "transparent",
  border: isSelected
    ? `1px solid ${theme.palette.primary.main}`
    : `1px solid transparent`,
  color: isSelected
    ? theme.palette.primary.main
    : theme.palette.text.primary,
  transition: theme.transitions.create(
    ["background-color", "border-color", "color", "transform"],
    { duration: theme.transitions.duration.shorter }
  ),
  "&:hover": {
    backgroundColor: isSelected
      ? alpha(theme.palette.primary.main, 0.18)
      : alpha(theme.palette.primary.main, 0.08),
    borderColor: isSelected
      ? theme.palette.primary.main
      : alpha(theme.palette.primary.main, 0.3),
    transform: "translateY(-1px)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
}));

export const IconLabel = styled(Typography)({
  fontSize: "0.6875rem",
  lineHeight: 1.2,
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "inherit",
  textAlign: "center",
});

export const HelperTypography = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "isError",
})<{ isError?: boolean }>(({ theme, isError }) => ({
  ...theme.typography.caption,
  color: isError ? theme.palette.error.main : theme.palette.text.secondary,
  marginLeft: "4px",
  marginTop: "2px",
}));
