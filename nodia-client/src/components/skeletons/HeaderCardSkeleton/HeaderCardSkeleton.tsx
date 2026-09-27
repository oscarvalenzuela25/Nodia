import type { FC } from "react";
import { Box, Card, Skeleton } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledHeaderSkeletonCard = styled(Card)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: isDark
      ? "0 4px 20px rgba(0, 0, 0, 0.5)"
      : "0 4px 16px rgba(0, 0, 0, 0.04)",
    backgroundColor: isDark ? "#1a212b" : "#ffffff",
    overflow: "hidden",
  };
});

export const HeaderCardSkeleton: FC = () => {
  return (
    <StyledHeaderSkeletonCard data-testid="header-card-skeleton">
      <Box
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, flex: 1, minWidth: 280 }}>
          {/* Avatar */}
          <Skeleton
            variant="rounded"
            width={54}
            height={54}
            sx={{ borderRadius: 3, flexShrink: 0 }}
            animation="wave"
          />

          <Box sx={{ flex: 1 }}>
            {/* Title & Status */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 1 }}>
              <Skeleton variant="text" width={220} height={36} animation="wave" />
              <Skeleton
                variant="rounded"
                width={70}
                height={24}
                sx={{ borderRadius: 4 }}
                animation="wave"
              />
            </Box>

            {/* Meta row */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
              <Skeleton variant="text" width={80} height={20} animation="wave" />
              <Skeleton variant="text" width={140} height={20} animation="wave" />
            </Box>

            {/* Description */}
            <Skeleton variant="text" width="70%" height={22} animation="wave" />
          </Box>
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Skeleton
            variant="rounded"
            width={100}
            height={36}
            sx={{ borderRadius: 2 }}
            animation="wave"
          />
          <Skeleton
            variant="rounded"
            width={160}
            height={36}
            sx={{ borderRadius: 2 }}
            animation="wave"
          />
        </Box>
      </Box>

      {/* Tabs bar */}
      <Box
        sx={{
          px: { xs: 2, sm: 3.5 },
          pt: 1,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          display: "flex",
          gap: 3,
        }}
      >
        {Array.from({ length: 5 }).map((_, idx) => (
          <Skeleton
            key={`tab-skel-${idx}`}
            variant="text"
            width={100}
            height={38}
            animation="wave"
          />
        ))}
      </Box>
    </StyledHeaderSkeletonCard>
  );
};

export default HeaderCardSkeleton;
