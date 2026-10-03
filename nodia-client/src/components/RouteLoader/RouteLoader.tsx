import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { CircularProgress, Box, Skeleton as MuiSkeleton } from "@mui/material";
import type { RouteLoaderProps } from "./types";
import {
  LoaderContainer,
  TopProgressBar,
  SkeletonHeader,
  SkeletonCard,
  FullscreenBox,
  LoaderMessage,
} from "./styles";

const RouteLoader: FC<RouteLoaderProps> = ({
  variant = "page",
  messageKey,
  defaultMessage,
}) => {
  const { t } = useTranslation(["core"]);
  const displayMessage = messageKey
    ? t(messageKey, defaultMessage || "Cargando página...")
    : defaultMessage || t("core:loading_route", "Cargando página...");

  if (variant === "fullscreen") {
    return (
      <LoaderContainer
        variant="fullscreen"
        role="status"
        aria-live="polite"
        aria-label={displayMessage}
      >
        <FullscreenBox>
          <CircularProgress size={44} thickness={4} color="primary" />
          <LoaderMessage>{displayMessage}</LoaderMessage>
        </FullscreenBox>
      </LoaderContainer>
    );
  }

  return (
    <LoaderContainer
      variant="page"
      role="status"
      aria-live="polite"
      aria-label={displayMessage}
    >
      <TopProgressBar aria-label={displayMessage} />
      <SkeletonHeader>
        <MuiSkeleton variant="text" width="60%" height={38} sx={{ borderRadius: 1 }} />
        <MuiSkeleton variant="text" width="90%" height={20} sx={{ borderRadius: 0.5 }} />
      </SkeletonHeader>
      <SkeletonCard>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <MuiSkeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <MuiSkeleton variant="text" width="40%" height={24} sx={{ borderRadius: 0.5 }} />
            <MuiSkeleton variant="text" width="25%" height={18} sx={{ borderRadius: 0.5 }} />
          </Box>
        </Box>
        <MuiSkeleton variant="rectangular" width="100%" height={160} sx={{ borderRadius: 1.5, mt: 1 }} />
      </SkeletonCard>
    </LoaderContainer>
  );
};

export default RouteLoader;
