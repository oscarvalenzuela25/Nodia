import type { ReactNode } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import { Skeleton, type SkeletonProps } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { LoadingRegion, LoadingSpace } from "./styles";

// Geometry only: an initial request has no content for Boneyard to measure yet.
const contentBones: SkeletonProps["initialBones"] = {
  name: "teacher-content", viewportWidth: 600, width: 600, height: 160,
  bones: [[0, 8, 58, 24, 4], [0, 52, 94, 16, 4], [0, 84, 88, 16, 4], [0, 116, 72, 16, 4]],
};
const compactBones: SkeletonProps["initialBones"] = {
  name: "teacher-status", viewportWidth: 160, width: 160, height: 32,
  bones: [[0, 2, 100, 28, 14]],
};

type Props = { loading: boolean; compact?: boolean; children?: ReactNode };
export default function TeacherLoading({ loading, compact = false, children }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const color = alpha(theme.palette.text.primary, .12);
  return <LoadingRegion role={loading ? "status" : undefined} aria-label={loading ? t("core:loading_route") : undefined} aria-busy={loading || undefined}>
    <Skeleton loading={loading} initialBones={compact ? compactBones : contentBones} color={color} darkColor={color} animate={false}>
    {loading ? <LoadingSpace compact={compact} aria-hidden="true" /> : children}
    </Skeleton>
  </LoadingRegion>;
}
