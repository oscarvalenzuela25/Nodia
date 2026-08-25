import Button from "@mui/material/Button";
import { styled, keyframes } from "@mui/material/styles";

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

export const Page = styled("main")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100dvh",
  padding: theme.spacing(4),
  textAlign: "center",
  position: "relative",
  overflow: "hidden",
  backgroundColor: theme.palette.background.default,
  color: theme.palette.text.primary,
  "&::before": {
    content: '""',
    position: "absolute",
    top: "-20%",
    left: "-10%",
    width: "60vw",
    height: "60vw",
    background: `radial-gradient(circle, ${theme.palette.primary.main}15 0%, transparent 70%)`,
    borderRadius: "50%",
    zIndex: 0,
    pointerEvents: "none",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    bottom: "-20%",
    right: "-10%",
    width: "60vw",
    height: "60vw",
    background: `radial-gradient(circle, ${theme.palette.tertiary.main}10 0%, transparent 70%)`,
    borderRadius: "50%",
    zIndex: 0,
    pointerEvents: "none",
  }
}));

export const ContentWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing(3),
  maxWidth: "500px",
  zIndex: 1,
}));

export const IconWrapper = styled("div")(({ theme }) => ({
  fontSize: "6rem",
  color: theme.palette.primary.main,
  animation: `${float} 6s ease-in-out infinite`,
  filter: `drop-shadow(0px 10px 20px ${theme.palette.primary.main}30)`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

export const Title = styled("h1")(({ theme }) => ({
  ...theme.typography.h3,
  fontWeight: 700,
  margin: 0,
  letterSpacing: "-0.02em",
}));

export const Description = styled("p")(({ theme }) => ({
  ...theme.typography.body1,
  margin: 0,
  color: theme.palette.text.secondary,
  lineHeight: 1.6,
}));

export const PrimaryButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1.2, 4),
  borderRadius: "100px",
  fontWeight: 600,
  textTransform: "none",
  fontSize: "1rem",
  boxShadow: `0 8px 16px ${theme.palette.primary.main}25`,
  "&:hover": {
    boxShadow: `0 12px 20px ${theme.palette.primary.main}40`,
    transform: "translateY(-2px)",
  },
  transition: "all 0.2s ease-in-out",
})) as typeof Button;
