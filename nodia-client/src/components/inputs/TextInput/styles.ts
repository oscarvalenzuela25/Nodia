import { Box, TextField } from "@mui/material";
import { styled } from "@mui/material/styles";

export const InputContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== "fullWidth",
})<{ fullWidth?: boolean }>(({ fullWidth }) => ({
  display: "flex",
  flexDirection: "column",
  width: fullWidth ? "100%" : "auto",
  gap: "6px",
}));

export const LabelTypography = styled("label")(({ theme }) => ({
  ...theme.typography.body2,
  fontWeight: 600,
  color: theme.palette.text.primary,
  fontSize: "0.875rem",
  userSelect: "none",
  display: "block",
}));

export const RequiredStar = styled("span")(({ theme }) => ({
  color: theme.palette.error.main,
  marginLeft: "2px",
}));

export const StyledTextField = styled(TextField)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    "& .MuiOutlinedInput-root": {
      borderRadius:
        typeof theme.shape.borderRadius === "number"
          ? theme.shape.borderRadius * 1.5
          : 8,
      backgroundColor: theme.palette.background.paper,
      transition: theme.transitions.create(
        ["border-color", "box-shadow", "background-color"],
        { duration: theme.transitions.duration.shorter }
      ),
      "& fieldset": {
        borderColor,
        borderWidth: "1.5px",
      },
      "&:hover fieldset": {
        borderColor: theme.palette.text.secondary,
      },
      "&.Mui-focused fieldset": {
        borderColor: theme.palette.primary.main,
        borderWidth: "1.5px",
      },
      "&.Mui-error fieldset": {
        borderColor: theme.palette.error.main,
      },
    },
    '& input[type="date"], & input[type="datetime-local"]': {
      minWidth: 0,
      colorScheme: theme.palette.mode,
      '&::-webkit-calendar-picker-indicator': {
        backgroundColor: "currentColor",
        backgroundImage: "none",
        mask: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z'/%3E%3C/svg%3E") center / contain no-repeat`,
        opacity: 1,
        cursor: "pointer",
      },
    },
    "& .MuiOutlinedInput-input": {
      padding: "10px 14px",
      fontSize: "0.875rem",
    },
  };
});
