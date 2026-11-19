import type { FC } from "react";
import { Card, Grid, Skeleton } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledSettingsSkeleton = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: "none",
  backgroundColor: theme.palette.background.paper,
  backgroundImage: "none",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
  height: "100%",
  minHeight: 140,
  [theme.breakpoints.down("sm")]: {
    display: "grid",
    gridTemplateColumns: "44px minmax(0, 1fr)",
    alignItems: "center",
    gap: theme.spacing(0, 2),
    padding: theme.spacing(2),
    minHeight: 78,
    "& > .MuiSkeleton-root:first-of-type": { gridRow: "span 2" },
    "& > .MuiSkeleton-text": { gridColumn: 2 },
  },
}));

export const SettingsCardSkeleton: FC = () => {
  return (
    <StyledSettingsSkeleton data-testid="settings-card-skeleton">
      <Skeleton
        variant="rounded"
        width={44}
        height={44}
        sx={{ borderRadius: 3 }}
        animation="wave"
      />
      <Skeleton variant="text" width="65%" height={26} animation="wave" />
      <Skeleton variant="text" width="90%" height={20} animation="wave" />
    </StyledSettingsSkeleton>
  );
};

export const SettingsCardsGridSkeleton: FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <Grid container rowSpacing={3} columnSpacing={2} data-testid="settings-cards-grid-skeleton">
      {Array.from({ length: count }).map((_, idx) => (
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={`settings-skel-${idx}`}>
          <SettingsCardSkeleton />
        </Grid>
      ))}
    </Grid>
  );
};

export default SettingsCardSkeleton;
