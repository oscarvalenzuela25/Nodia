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
    "& .MuiOutlinedInput-input": {
      padding: "10px 14px",
      fontSize: "0.875rem",
    },
  };
});
