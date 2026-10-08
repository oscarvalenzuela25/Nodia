import { useEffect, useId, useRef, useState } from "react";
import { Alert, Button, LinearProgress, Typography } from "@mui/material";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sileo } from "sileo";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import { notifyHttpError } from "../../../../../../config/httpFeedback";
import {
  useCancelGeminiAgenticLogin, useCurrentGeminiAgenticLogin, useGeminiAgenticLoginStatus,
  useStartGeminiAgenticLogin, useSubmitGeminiAgenticCode,
} from "../../infrastructure/useServices";
import { agenticLoginIsActive, geminiAgenticCodeSchema, type GeminiAgenticCode } from "../../infrastructure/agenticLogin";
import { LoginActions, LoginContent } from "./styles";

type Props = { onClose: () => void };

const AgenticLoginModal = ({ onClose }: Props) => {
  const { t } = useTranslation(["ai_providers", "core"]);
  const queryClient = useQueryClient();
  const formId = useId();
  const [jobId, setJobId] = useState<string | null>(null);
  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<GeminiAgenticCode>({
    resolver: zodResolver(geminiAgenticCodeSchema), defaultValues: { code: "" }, mode: "onChange",
  });
  const code = useWatch({ control, name: "code" });
  const start = useStartGeminiAgenticLogin();
  const submit = useSubmitGeminiAgenticCode();
  const cancel = useCancelGeminiAgenticLogin();
  const current = useCurrentGeminiAgenticLogin(jobId === null);
  const effectiveJobId = jobId ?? current.data?.id ?? null;
  const status = useGeminiAgenticLoginStatus(effectiveJobId);
  const job = status.data ?? (effectiveJobId === start.data?.id ? start.data : current.data);
  const isActive = Boolean(effectiveJobId && (!job || agenticLoginIsActive(job)));
  const isBusy = isSubmitting || start.isPending || submit.isPending || cancel.isPending || status.isFetching || current.isFetching;
  const canSubmit = job?.state === "waiting_code" && geminiAgenticCodeSchema.safeParse({ code }).success;
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (!job || agenticLoginIsActive(job) || notified.current === `${job.id}:${job.state}`) return;
    notified.current = `${job.id}:${job.state}`;
    if (job.state === "succeeded") {
      sileo.success({ title: t("ai_providers:agentic_login.success") });
      void Promise.all(["ai-providers-health", "ai-selectable-models"].map(
        (key) => queryClient.invalidateQueries({ queryKey: [key] }),
      ));
      onClose();
    } else if (job.state === "failed") {
      sileo.error({ title: t("ai_providers:agentic_login.failed"), description: t(
        job.reason === "agentic_login_timeout" ? "ai_providers:agentic_login.timeout" : "ai_providers:agentic_login.failed_description",
      ) });
    }
  }, [job, onClose, queryClient, t]);

  useEffect(() => {
    if (current.isError) notifyHttpError(current.error);
    if (status.isError) notifyHttpError(status.error);
  }, [current.isError, current.error, status.isError, status.error]);

  const handleStart = async () => {
    if (isBusy || isActive) return;
    try {
      const result = await start.mutateAsync();
      // Clear only after the new attempt was accepted.
      reset();
      queryClient.setQueryData(["gemini-agentic-login", result.id], result);
      setJobId(result.id);
      sileo.success({ title: t("ai_providers:agentic_login.started") });
    } catch (error) { notifyHttpError(error); }
  };
  const handleSubmitCode = handleSubmit(async ({ code: authorizationCode }) => {
    if (!effectiveJobId || !canSubmit || isBusy) return;
    try {
      const result = await submit.mutateAsync({ id: effectiveJobId, code: authorizationCode });
      queryClient.setQueryData(["gemini-agentic-login", effectiveJobId], result);
      reset();
      sileo.success({ title: t("ai_providers:agentic_login.code_submitted") });
    } catch (error) { notifyHttpError(error); }
    finally { submit.reset(); }
  });
  const handleClose = async () => {
    if (isBusy) return;
    if (effectiveJobId && isActive) {
      try {
        const result = await cancel.mutateAsync(effectiveJobId);
        queryClient.setQueryData(["gemini-agentic-login", effectiveJobId], result);
        sileo.success({ title: t("ai_providers:agentic_login.cancelled") });
      } catch (error) { notifyHttpError(error); return; }
    }
    onClose();
  };

  return <BaseModal open onClose={handleClose} showCloseButton={!isBusy} size="sm"
    title={t("ai_providers:agentic_login.title")}
    actions={<LoginActions>
      <Button variant="outlined" disabled={isBusy} onClick={handleClose}>
        {t(isActive ? "ai_providers:agentic_login.cancel" : "ai_providers:agentic_login.close")}
      </Button>
      {job?.state === "waiting_code"
        ? <Button type="submit" form={formId} variant="contained" disabled={isBusy || !canSubmit}>{t("ai_providers:agentic_login.submit_code")}</Button>
        : <Button variant="contained" disabled={isBusy || isActive || current.isError || status.isError} onClick={handleStart}>{t("ai_providers:agentic_login.connect")}</Button>}
    </LoginActions>}>
    <LoginContent id={formId} onSubmit={handleSubmitCode}>
      <Alert severity="info">{t("ai_providers:agentic_login.shared_session")}</Alert>
      <Typography variant="body2">{t("ai_providers:agentic_login.instructions")}</Typography>
      {isBusy && <LinearProgress />}
      {job && <Typography role="status">{t(`ai_providers:agentic_login.states.${job.state}`)}</Typography>}
      {job?.state === "waiting_code" && job.authorization_url && <>
        <Button component="a" href={job.authorization_url} target="_blank" rel="noopener noreferrer"
          variant="outlined" startIcon={<OpenInNewOutlinedIcon />} disabled={isBusy}>
          {t("ai_providers:agentic_login.open_google")}
        </Button>
        <Controller name="code" control={control} render={({ field, fieldState }) => <TextInput
          label={t("ai_providers:agentic_login.code_label")} value={field.value} name={field.name}
          type="password" onChange={field.onChange} onBlur={field.onBlur} disabled={isBusy} required
          error={fieldState.invalid} helperText={fieldState.error?.message ? t(fieldState.error.message) : undefined} />} />
      </>}
      {job?.state === "failed" && <Alert severity="error">{t(job.reason === "agentic_login_timeout"
        ? "ai_providers:agentic_login.timeout" : "ai_providers:agentic_login.failed_description")}</Alert>}
      {(current.isError || status.isError) && <Alert severity="error" action={<Button disabled={isBusy}
        onClick={() => effectiveJobId ? status.refetch() : current.refetch()}>{t("core:retry")}</Button>}>
        {t("core:server_error_toast")}
      </Alert>}
    </LoginContent>
  </BaseModal>;
};

export default AgenticLoginModal;
