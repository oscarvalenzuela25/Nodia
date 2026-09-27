import type { FC } from "react";
import { Box, Card, Grid, Skeleton } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledKpiSkeletonCard = styled(Card)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    padding: theme.spacing(2.5),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    backgroundColor: isDark ? "#1a212b" : "#ffffff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
  };
});

export const KpiCardSkeleton: FC = () => {
  return (
    <StyledKpiSkeletonCard data-testid="kpi-card-skeleton">
      <Box>
        {/* Top: Label + Icon */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1,
          }}
        >
          <Skeleton variant="text" width={110} height={20} animation="wave" />
          <Skeleton variant="circular" width={22} height={22} animation="wave" />
        </Box>

        {/* Large Value */}
        <Box sx={{ my: 0.5, display: "flex", alignItems: "baseline", gap: 1 }}>
          <Skeleton variant="text" width={80} height={44} animation="wave" />
          <Skeleton variant="text" width={40} height={24} animation="wave" />
        </Box>

        {/* Chips row */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
          <Skeleton
            variant="rounded"
            width={85}
            height={22}
            sx={{ borderRadius: 2 }}
            animation="wave"
          />
          <Skeleton
            variant="rounded"
            width={95}
            height={22}
            sx={{ borderRadius: 2 }}
            animation="wave"
          />
          <Skeleton
            variant="rounded"
            width={75}
            height={22}
            sx={{ borderRadius: 2 }}
            animation="wave"
          />
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pt: 1.5,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          mt: 2,
        }}
      >
        <Skeleton variant="text" width="60%" height={18} animation="wave" />
      </Box>
    </StyledKpiSkeletonCard>
  );
};

export const KpiCardsGridSkeleton: FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <Grid container spacing={3} data-testid="kpi-cards-grid-skeleton">
      {Array.from({ length: count }).map((_, idx) => (
        <Grid size={{ xs: 12, md: 4 }} key={`kpi-card-skel-${idx}`}>
          <KpiCardSkeleton />
        </Grid>
      ))}
    </Grid>
  );
};

export default KpiCardSkeleton;
