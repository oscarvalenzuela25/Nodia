import { alpha, styled } from "@mui/material/styles";

export const SelectionBar = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(0.75),
  minWidth: 0,
  flex: "1 1 32rem",
  "& > .MuiAlert-root": { flexBasis: "100%", minWidth: 0 },
}));

export const Selector = styled("div")(({ theme }) => ({
  flex: "1 1 8rem",
  maxWidth: "16rem",
  minWidth: 0,
  position: "relative",
  "& label": {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    border: 0,
  },
  "& [aria-haspopup='listbox']": {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    background: alpha(theme.palette.text.primary, 0.035),
    padding: theme.spacing(0.75, 1.25),
    "&:hover, &:focus-visible": {
      borderColor: alpha(theme.palette.primary.main, 0.35),
      background: alpha(theme.palette.primary.main, 0.06),
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    "& .MuiTypography-root": { fontSize: "0.75rem", fontWeight: 500 },
  },
  [theme.breakpoints.down("sm")]: { flexBasis: "calc(50% - 8px)", maxWidth: "none" },
}));

export const DraftActions = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  flexBasis: "100%",
  "& button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: {
    "& button": { flex: 1 },
    "& .MuiTypography-root": { flexBasis: "100%" },
  },
}));
