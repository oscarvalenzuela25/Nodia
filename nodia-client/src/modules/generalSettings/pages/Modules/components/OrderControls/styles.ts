import { IconButton } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const Controls = styled("div")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  gap: theme.spacing(0.5),
}));

export const TooltipTarget = styled("span")({ display: "inline-flex" });

export const OrderButton = styled(IconButton)(({ theme }) => ({
  width: 44,
  height: 44,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.18) },
}));
