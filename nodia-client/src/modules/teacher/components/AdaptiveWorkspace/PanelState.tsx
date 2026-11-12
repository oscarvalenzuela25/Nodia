import type { ReactNode } from "react";
import { LinearProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import TeacherLoading from "../TeacherLoading";

export default function PanelState({ loading, fetching, error, empty, retry, children }: { loading: boolean; fetching: boolean; error: boolean; empty?: boolean; retry: () => unknown; children: ReactNode }) {
  const { t } = useTranslation();
  return <Stack sx={{ gap: 2, minWidth: 0 }}>
    <QueryErrorAlert retryVariant="outlined" isError={error} isFetching={fetching} onRetry={retry} />
    {fetching && !loading && <LinearProgress />}
    <TeacherLoading loading={loading}>
      {empty && !error ? <Typography color="text.secondary">{t("teacher:adaptive.empty")}</Typography> : children}
    </TeacherLoading>
  </Stack>;
}
