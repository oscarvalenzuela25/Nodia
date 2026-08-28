import { TextField } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";

export const SearchTextField = styled(TextField)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    "& .MuiInput-root": {
      backgroundColor: "transparent",
      fontSize: "0.875rem",
      "&::before": {
        borderBottomColor: borderColor,
        borderBottomWidth: "1.5px",
      },
      "&:hover:not(.Mui-disabled, .Mui-error):before": {
        borderBottomColor: theme.palette.text.secondary,
        borderBottomWidth: "1.5px",
      },
      "&::after": {
        borderBottomColor: theme.palette.primary.main,
        borderBottomWidth: "2px",
      },
    },
    "& .MuiInput-input": {
      padding: "6px 0 7px",
      fontSize: "0.875rem",
      "&::placeholder": {
        color: theme.palette.text.secondary,
        opacity: 0.8,
      },
    },
    "& .MuiOutlinedInput-root": {
      borderRadius:
        typeof theme.shape.borderRadius === "number"
          ? theme.shape.borderRadius * 1.5
          : 8,
      backgroundColor: "transparent",
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
      "&.Mui-focused": {
        backgroundColor:
          theme.palette.mode === "dark"
            ? alpha(theme.palette.common.white, 0.02)
            : alpha(theme.palette.primary.main, 0.02),
        "& fieldset": {
          borderColor: theme.palette.primary.main,
          borderWidth: "1.5px",
        },
      },
    },
    "& .MuiOutlinedInput-input": {
      padding: "8.5px 14px",
      fontSize: "0.875rem",
      "&::placeholder": {
        color: theme.palette.text.secondary,
        opacity: 0.8,
      },
    },
  };
});
