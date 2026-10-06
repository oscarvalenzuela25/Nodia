import type { FC } from "react";
import { useTranslation } from "react-i18next";
import CircularProgress from "@mui/material/CircularProgress";
import type { RouteLoaderProps } from "./types";
import {
  LoaderContainer,
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
    ? t(messageKey)
    : defaultMessage || t("core:loading_route");

  return (
    <LoaderContainer
      variant={variant}
      role="status"
      aria-live="polite"
      aria-label={displayMessage}
    >
      <FullscreenBox>
        <CircularProgress size={44} thickness={4} color="primary" aria-label={displayMessage} />
        <LoaderMessage>{displayMessage}</LoaderMessage>
      </FullscreenBox>
    </LoaderContainer>
  );
};

export default RouteLoader;
