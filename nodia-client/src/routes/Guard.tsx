import type { FC, PropsWithChildren } from "react";
import { Alert, Box, LinearProgress } from "@mui/material";
import { useTranslation } from "react-i18next";
import useAuth from "../hooks/useAuth";

type Props = PropsWithChildren;

const Guard: FC<Props> = ({ children }) => {
  const { isSessionValid, isDemo } = useAuth();
  const { t } = useTranslation("auth");

  if (!isDemo && !isSessionValid) {
    return <LinearProgress aria-label={t("auth:session_restoring")} />;
  }

  return (
    <>
      {isDemo && <Alert severity="info" sx={{ m: 3, mb: 0 }}>{t("auth:demo_mode")}</Alert>}
      <Box>{children}</Box>
    </>
  );
};

export default Guard;
