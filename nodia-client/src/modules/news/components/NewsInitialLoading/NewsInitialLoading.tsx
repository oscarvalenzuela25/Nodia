import { alpha, useTheme } from "@mui/material/styles";
import { Skeleton, type SkeletonProps } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { LoadingRegion, LoadingSpace } from "./styles";

// The first request has no article DOM to measure. These are layout bones only.
const initialBones: SkeletonProps["initialBones"] = {
  name: "news-initial-content",
  viewportWidth: 600,
  width: 600,
  height: 220,
  bones: [
    [0, 8, 32, 12, 4],
    [0, 44, 94, 28, 4],
    [0, 88, 88, 18, 4],
    [0, 122, 72, 18, 4],
    [0, 180, 24, 12, 4],
  ],
};

export default function NewsInitialLoading() {
  const { t } = useTranslation("news");
  const theme = useTheme();
  const color = alpha(theme.palette.text.primary, 0.12);
  return (
    <LoadingRegion role="status" aria-label={t("news:loading")} aria-busy="true">
      <Skeleton loading initialBones={initialBones} color={color} darkColor={color} animate={false}>
        <LoadingSpace aria-hidden="true" />
      </Skeleton>
    </LoadingRegion>
  );
}
