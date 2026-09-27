import type { FC } from "react";
import { Card, Grid, Skeleton } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledSettingsSkeleton = styled(Card)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    backgroundColor: isDark ? "#1a212b" : "#ffffff",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    height: "100%",
    minHeight: 140,
  };
});

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
    <Grid container spacing={3} data-testid="settings-cards-grid-skeleton">
      {Array.from({ length: count }).map((_, idx) => (
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={`settings-skel-${idx}`}>
          <SettingsCardSkeleton />
        </Grid>
      ))}
    </Grid>
  );
};

export default SettingsCardSkeleton;
