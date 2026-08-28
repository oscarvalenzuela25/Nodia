import {
  Box,
  Typography,
  Popover,
  MenuItem,
  TextField,
  MenuList,
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

export const SelectedChipsContainer = styled(Box)({
  display: "flex",
  flexWrap: "wrap",
  gap: "4px",
  flex: 1,
  minWidth: 0,
  alignItems: "center",
});

export const PlaceholderText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.disabled,
  fontSize: "0.875rem",
  lineHeight: 1.5,
}));

export const StyledPopover = styled(Popover)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    "& .MuiPopover-paper": {
      borderRadius:
        typeof theme.shape.borderRadius === "number"
          ? theme.shape.borderRadius * 1.5
          : 8,
      boxShadow:
        theme.palette.mode === "dark"
          ? `0 12px 28px -6px ${alpha(
              theme.palette.common.black,
              0.7
            )}, 0 0 0 1px ${borderColor}`
          : `0 12px 28px -6px ${alpha(
              theme.palette.primary.main,
              0.15
            )}, 0 0 0 1px ${borderColor}`,
      backgroundColor: theme.palette.background.paper,
      marginTop: theme.spacing(0.75),
      maxHeight: "300px",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    },
  };
});

export const SearchContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 1.5),
  borderBottom: `1px solid ${theme.palette.divider}`,
  position: "sticky",
  top: 0,
  backgroundColor: theme.palette.background.paper,
  zIndex: 1,
}));

export const SearchField = styled(TextField)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    "& .MuiOutlinedInput-root": {
      borderRadius:
        typeof theme.shape.borderRadius === "number"
          ? theme.shape.borderRadius
          : 6,
      fontSize: "0.875rem",
      backgroundColor:
        theme.palette.mode === "dark"
          ? alpha(theme.palette.common.white, 0.04)
          : alpha(theme.palette.common.black, 0.02),
      "& fieldset": {
        borderColor,
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
  };
});

export const OptionsList = styled(MenuList)({
  overflowY: "auto",
  flex: 1,
  padding: "4px 0",
  maxHeight: "220px",
});

export const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  padding: theme.spacing(0.75, 1.5),
  gap: theme.spacing(1),
  fontSize: "0.875rem",
  transition: theme.transitions.create(["background-color"], {
    duration: theme.transitions.duration.shorter,
  }),
  "&:hover": {
    backgroundColor:
      theme.palette.mode === "dark"
        ? alpha(theme.palette.common.white, 0.06)
        : alpha(theme.palette.primary.main, 0.08),
  },
  "&.Mui-selected": {
    backgroundColor:
      theme.palette.mode === "dark"
        ? alpha(theme.palette.primary.main, 0.15)
        : alpha(theme.palette.primary.main, 0.12),
    "&:hover": {
      backgroundColor:
        theme.palette.mode === "dark"
          ? alpha(theme.palette.primary.main, 0.22)
          : alpha(theme.palette.primary.main, 0.18),
    },
  },
}));

export const HelperTypography = styled(Typography)<{ isError?: boolean }>(
  ({ theme, isError }) => ({
    ...theme.typography.caption,
    color: isError ? theme.palette.error.main : theme.palette.text.secondary,
    fontSize: "0.75rem",
    marginTop: "2px",
  })
);
