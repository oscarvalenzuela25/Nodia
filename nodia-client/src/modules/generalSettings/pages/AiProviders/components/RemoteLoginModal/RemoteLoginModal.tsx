import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import { useQueryClient } from "@tanstack/react-query";
import { notifyHttpError } from "../../../../../../config/httpFeedback";
import BaseModal from "../../../../../../components/BaseModal";
import {
  useCancelGeminiLogin,
  useGeminiLoginStatus,
  useStartGeminiLogin,
} from "../../infrastructure/useServices";

interface RemoteLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

const RemoteLoginModal: FC<RemoteLoginModalProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation(["ai_providers", "core"]);
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const notifiedResult = useRef<string | null>(null);
  const startLogin = useStartGeminiLogin();
  const cancelLogin = useCancelGeminiLogin();
  const loginStatus = useGeminiLoginStatus(jobId, open);
  const isRunning =
    jobId !== null &&
    !["succeeded", "failed", "cancelled"].includes(
      loginStatus.data?.state ?? "running"
    );
  const isActionBlocked =
    startLogin.isPending ||
    cancelLogin.isPending ||
    loginStatus.isFetching;

  useEffect(() => {
    const result = loginStatus.data;
    if (!open || !result || result.state === "running" || notifiedResult.current === `${result.id}:${result.state}`) {
      return;
    }
    notifiedResult.current = `${result.id}:${result.state}`;
    if (result.state === "succeeded") {
      sileo.success({ title: t("ai_providers:modal_login.status_success") });
      void (async () => {
        try {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["ai-providers-health"] }),
            queryClient.invalidateQueries({ queryKey: ["gemini-engines"] }),
            queryClient.invalidateQueries({ queryKey: ["ai-providers"] }),
            queryClient.invalidateQueries({ queryKey: ["ai-enabled-web-providers"] }),
            queryClient.invalidateQueries({ queryKey: ["ai-selectable-models"] }),
          ]);
          if (onSuccess) {
            await onSuccess();
          }
        } finally {
          onClose();
        }
      })();
    } else if (result.state === "failed") {
      sileo.error({
        title: t("ai_providers:modal_login.error_title"),
        description: t("ai_providers:modal_login.error_desc"),
      });
    }
  }, [loginStatus.data, onClose, onSuccess, open, queryClient, t]);

  useEffect(() => {
    if (!open || !jobId || !loginStatus.isError || notifiedResult.current === `error:${jobId}`) {
      return;
    }
    notifiedResult.current = `error:${jobId}`;
    notifyHttpError(loginStatus.error);
  }, [jobId, loginStatus.isError, loginStatus.error, open]);

  const showError = (error: unknown) => {
    const serverMessage = isAxiosError<{ message?: string }>(error)
      ? error.response?.data?.message
      : undefined;
    sileo.error({
      title: t("ai_providers:modal_login.error_title"),
      description: typeof serverMessage === "string"
        ? serverMessage
        : t("core:server_error_toast"),
    });
  };

  const handleStart = async () => {
    try {
      const job = await startLogin.mutateAsync();
      notifiedResult.current = null;
      setJobId(job.id);
      sileo.success({ title: t("ai_providers:modal_login.started") });
    } catch (error) {
      showError(error);
    }
  };

  const handleClose = async () => {
    if (isActionBlocked) {
      return;
    }
    if (jobId && isRunning) {
      try {
        await cancelLogin.mutateAsync(jobId);
        sileo.success({ title: t("ai_providers:modal_login.cancelled") });
      } catch (error) {
        showError(error);
        return;
      }
    }
    setJobId(null);
    onClose();
  };

  const modalActions = (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5, justifyContent: "flex-end", width: "100%" }}>
      <Button
        variant="outlined"
        color="inherit"
        onClick={handleClose}
        disabled={isActionBlocked}
        sx={{ borderRadius: 2 }}
      >
        {t(isRunning ? "ai_providers:modal_login.cancel" : "ai_providers:modal_login.close")}
      </Button>
      {import.meta.env.DEV && (
        <Button
          variant="contained"
          startIcon={startLogin.isPending ? <CircularProgress size={16} color="inherit" /> : <OpenInNewOutlinedIcon />}
          onClick={handleStart}
          disabled={isActionBlocked || isRunning}
        >
          {t("ai_providers:modal_login.open_browser")}
        </Button>
      )}
    </Box>
  );

  return (
    <BaseModal
      open={open}
      onClose={isActionBlocked ? () => {} : handleClose}
      title={t("ai_providers:modal_login.title")}
      size="sm"
      actions={modalActions}
      showCloseButton={!isActionBlocked}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "primary.main",
              color: "primary.contrastText",
            }}
          >
            <DevicesOutlinedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {t("ai_providers:modal_login.service_name")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("ai_providers:modal_login.service_type")}
            </Typography>
          </Box>
        </Box>

        <Alert severity="info" sx={{ borderRadius: 1.5 }}>
          {t(import.meta.env.DEV
            ? "ai_providers:modal_login.local_description"
            : "ai_providers:modal_login.unavailable")}
        </Alert>

        <Typography variant="body2" color="text.secondary">
          {t(import.meta.env.DEV
            ? "ai_providers:modal_login.local_instruction"
            : "ai_providers:modal_login.operator_instruction")}
        </Typography>
        {isRunning && <Typography role="status">{t("ai_providers:modal_login.status_pending")}</Typography>}
        {loginStatus.data?.state === "failed" && (
          <Alert severity="error">{t("ai_providers:modal_login.error_desc")}</Alert>
        )}
        {loginStatus.isError && (
          <Alert severity="error">{t("core:server_error_toast")}</Alert>
        )}
      </Box>
    </BaseModal>
  );
};

export default RemoteLoginModal;
