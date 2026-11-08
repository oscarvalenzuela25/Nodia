import { useId, useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import { geminiAgenticCodeSchema } from "../../../generalSettings/pages/AiProviders/infrastructure/agenticLogin";
import { useSecureInteraction } from "./hooks/useSecureInteraction";
import { Actions, Content, Form } from "./styles";

const formSchema = z.object({ value: z.string().max(8192) });
type Values = z.infer<typeof formSchema>;
type Props = { conversationId: string; executionId: string; disabled: boolean };

export default function SecureInteraction({ conversationId, executionId, disabled }: Props) {
  const { t } = useTranslation("nodiaAi");
  const [open, setOpen] = useState(false);
  const secure = useSecureInteraction(conversationId, executionId);
  const { control, handleSubmit, reset, setError } = useForm<Values>({ resolver: zodResolver(formSchema), defaultValues: { value: "" } });
  const formId = useId();
  const flow = secure.value?.flow;
  const interaction = secure.denied ? undefined : secure.value?.interaction;
  const busy = disabled || secure.busy;
  const terminal = !!flow && ["completed", "cancelled", "expired", "failed"].includes(flow.status);
  const blocked = busy || secure.denied;
  const keyFlow = flow?.kind === "api_key_create" || flow?.kind === "api_key_update";
  const updateKey = flow?.kind === "api_key_update";
  const codeFlow = interaction?.kind === "gemini_agentic" && interaction.data.state === "waiting_code";
  const close = () => { if (!busy) { reset(); secure.clear(); setOpen(false); } };
  const submit = handleSubmit(async ({ value }) => {
    if (blocked || secure.uncertain || terminal) return;
    if (!updateKey && !value.trim()) { setError("value", { message: t("secure.required") }); return; }
    if (codeFlow && !geminiAgenticCodeSchema.safeParse({ code: value }).success) {
      setError("value", { message: t("secure.invalid_code") }); return;
    }
    const result = await secure.act(keyFlow ? "key" : "code", keyFlow ? value.trim() ? { secret: value } : {} : { code: value });
    if (result) reset();
  });
  const showInput = !terminal && (keyFlow || codeFlow);
  return <>
    <Alert severity="info">{t("secure.paused")}</Alert>
    <Actions><Button variant="outlined" disabled={busy} onClick={() => { setOpen(true); void secure.load(); }}>{t("secure.open")}</Button></Actions>
    <BaseModal open={open} onClose={close} title={t("secure.title")} size="sm" showCloseButton={!busy}
      actions={<Actions>
        <Button variant="contained" disabled={busy} onClick={close}>{t("secure.close")}</Button>
        {flow && !terminal && <Button variant="contained" disabled={blocked} onClick={() => void secure.act("cancel")}>{t("secure.cancel")}</Button>}
        {showInput && <Button type="submit" form={formId} variant="contained" disabled={blocked || secure.uncertain}>{t(updateKey ? "secure.update_key" : keyFlow ? "secure.save_key" : codeFlow ? "secure.send_code" : "secure.send_text")}</Button>}
      </Actions>}>
      <Content>
        <Alert severity="info">{t("secure.private")}</Alert>
        {secure.failed && <Alert severity="error">{t("secure.error")}</Alert>}
        {secure.uncertain && <Alert severity="warning">{t("secure.uncertain")}</Alert>}
        {secure.denied && <Alert severity="warning">{t("secure.denied")}</Alert>}
        {!flow && <Typography role="status">{t("secure.unavailable")}</Typography>}
        {flow && <>
          <Typography>{t(`secure.kinds.${flow.kind}`)}</Typography>
          {flow.provider_id && <Typography>{t("secure.provider", { id: flow.provider_id })}</Typography>}
          {flow.key_id && <Typography>{t("secure.key", { id: flow.key_id })}</Typography>}
          <Typography role="status">{t(`secure.status.${flow.status}`)}</Typography>
          <Typography variant="caption"><time dateTime={flow.expires_at}>{t("secure.expires", { date: new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(flow.expires_at)) })}</time></Typography>
          {!terminal && !keyFlow && <Actions>
            {["nodia_logout", "codex_logout"].includes(flow.kind) ? <Button variant="contained" color="error" disabled={blocked || secure.uncertain} onClick={() => void secure.act("logout")}>{t(flow.kind === "nodia_logout" ? "secure.logout" : "secure.provider_logout")}</Button>
              : flow.kind === "api_key_delete" ? <Button variant="contained" color="error" disabled={blocked || secure.uncertain} onClick={() => void secure.act("delete")}>{t("secure.delete_key")}</Button>
              : flow.kind === "sync_models" ? <Button variant="contained" disabled={blocked || secure.uncertain} onClick={() => void secure.act("sync")}>{t("secure.sync")}</Button>
              : <Button variant="contained" disabled={blocked || secure.uncertain || flow.status !== "waiting" || !!interaction} onClick={() => void secure.act("start")}>{t("secure.start")}</Button>}
            {flow.kind === "connection_login" && <Button variant="contained" disabled={blocked} onClick={() => void secure.act("status")}>{t("secure.check")}</Button>}
          </Actions>}
          {terminal && flow.status === "completed" && <Alert severity="success">{t("secure.complete")}</Alert>}
          {flow.status === "failed" && <Alert severity="error">{t("secure.failed")}</Alert>}
          {!terminal && codeFlow && interaction?.kind === "gemini_agentic" && <Button variant="contained" component="a" href={interaction.data.authorization_url!} target="_blank" rel="noopener noreferrer" disabled={blocked}>{t("secure.authorize")}</Button>}
          {!terminal && interaction?.kind === "codex" && interaction.data.state === "waiting_authorization" && <>
            <Button variant="contained" component="a" href={interaction.data.verificationUrl!} target="_blank" rel="noopener noreferrer" disabled={blocked}>{t("secure.authorize")}</Button>
            <Typography component="p">{t("secure.device_code", { code: interaction.data.userCode })}</Typography>
          </>}
          {showInput && <Form id={formId} onSubmit={event => void submit(event)}>
            <Controller control={control} name="value" render={({ field, fieldState }) => <TextInput {...field} type="password" required={!updateKey}
              label={t(keyFlow ? "secure.secret" : codeFlow ? "secure.code" : "secure.text")} disabled={blocked || secure.uncertain}
              error={fieldState.invalid} helperText={fieldState.error?.message ?? (updateKey ? t("secure.keep_secret") : undefined)} />}/>
          </Form>}
        </>}
        <Box><Button variant="contained" disabled={busy} onClick={() => void secure.load()}>{t("secure.reload")}</Button></Box>
      </Content>
    </BaseModal>
  </>;
}
