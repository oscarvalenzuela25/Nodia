import type { FC } from "react";
import { Box, Card, Skeleton } from "@mui/material";
import { styled } from "@mui/material/styles";

const SkeletonCard = styled(Card)(({ theme }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: theme.spacing(2.5),
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow:
    theme.palette.mode === "dark"
      ? "0 2px 8px rgba(0, 0, 0, 0.4)"
      : "0 2px 10px rgba(0, 0, 0, 0.04)",
  backgroundColor:
    theme.palette.mode === "dark"
      ? "rgba(255, 255, 255, 0.02)"
      : "#ffffff",
  minHeight: 180,
}));

export const BusinessCardSkeleton: FC = () => {
  return (
    <SkeletonCard data-testid="business-card-skeleton">
      {/* Header: Status Dot + Name + More Icon */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.5,
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flex: 1 }}>
          <Skeleton
            variant="circular"
            width={10}
            height={10}
            animation="wave"
          />
          <Skeleton variant="text" width="60%" height={28} animation="wave" />
        </Box>
        <Skeleton variant="circular" width={24} height={24} animation="wave" />
      </Box>

      {/* Description Line */}
      <Box sx={{ mb: 2 }}>
        <Skeleton variant="text" width="85%" height={20} animation="wave" />
      </Box>

      {/* Chips */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2.5 }}>
        <Skeleton
          variant="rounded"
          width={80}
          height={24}
          sx={{ borderRadius: 2 }}
          animation="wave"
        />
        <Skeleton
          variant="rounded"
          width={95}
          height={24}
          sx={{ borderRadius: 2 }}
          animation="wave"
        />
        <Skeleton
          variant="rounded"
          width={70}
          height={24}
          sx={{ borderRadius: 2 }}
          animation="wave"
        />
      </Box>

      {/* Footer */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pt: 1.5,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          mt: "auto",
        }}
      >
        <Skeleton variant="text" width={100} height={18} animation="wave" />
        <Skeleton
          variant="rounded"
          width={65}
          height={26}
          sx={{ borderRadius: 1.5 }}
          animation="wave"
        />
      </Box>
    </SkeletonCard>
  );
};

export const CardsGridSkeleton: FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <Box
      data-testid="cards-grid-skeleton"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(1, 1fr)",
          sm: "repeat(2, 1fr)",
          md: "repeat(3, 1fr)",
        },
        gap: 3,
      }}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <BusinessCardSkeleton key={`card-skeleton-${idx}`} />
      ))}
    </Box>
  );
};

export default BusinessCardSkeleton;
