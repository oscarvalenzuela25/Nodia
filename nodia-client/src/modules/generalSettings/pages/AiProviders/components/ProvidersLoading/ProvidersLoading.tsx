import { Box, Typography, useTheme, alpha } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { LoadingPanel } from "./styles";

const loadingBones = {
  name: "ai-providers-loading",
  viewportWidth: 600,
  width: 600,
  height: 216,
  bones: [
    { x: 0, y: 8, w: 42, h: 24, r: 8 },
    { x: 0, y: 48, w: 70, h: 14, r: 6 },
    { x: 0, y: 88, w: 100, h: 48, r: 12 },
    { x: 0, y: 152, w: 100, h: 48, r: 12 },
  ],
};

const ProvidersLoading = () => {
  const { t } = useTranslation("ai_providers");
  const theme = useTheme();
  const color = alpha(theme.palette.text.primary, 0.1);
  return (
    <LoadingPanel aria-busy="true" aria-label={t("ai_providers:loading.title")}>
      <Typography role="status" sx={{ mb: 2, fontWeight: 600 }}>
        {t("ai_providers:loading.title")}
      </Typography>
      <Skeleton loading initialBones={loadingBones} color={color} darkColor={color}>
        <Box aria-hidden="true" sx={{ minHeight: 216 }} />
      </Skeleton>
    </LoadingPanel>
  );
};

export default ProvidersLoading;
