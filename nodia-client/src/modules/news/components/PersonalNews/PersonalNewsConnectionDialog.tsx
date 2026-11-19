import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, IconButton, InputAdornment, Link, Stack } from "@mui/material";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import { CredentialHelp } from "./styles";
import type { PersonalProvider } from "./types";

const credentialForm = z.object({
  key: z.string()
    .min(1, "news:personal_key_required")
    .max(512, "news:personal_key_format")
    .regex(/^[\x21-\x7e]*$/u, "news:personal_key_format"),
});
const dailyCredentialForm = z.object({
  key: z.string()
    .min(1, "news:personal_daily_key_required")
    .regex(/^(?=.{5,512}$)dda_[a-zA-Z0-9._~+/-]+=*$/u, "news:personal_daily_key_format"),
});
type CredentialForm = z.infer<typeof credentialForm>;
type ConnectResult = { ok: true } | { ok: false; fieldError?: string; message?: string };

export default function PersonalNewsConnectionDialog({
  provider, reconnect, busy, active, onClose, onConnect,
}: {
  provider: PersonalProvider;
  reconnect: boolean;
  busy: boolean;
  active: boolean;
  onClose: () => void;
  onConnect: (key: string) => Promise<ConnectResult>;
}) {
  const { t } = useTranslation(["news", "core"]);
  const daily = provider === "daily-dev";
  const providerName = daily ? "daily" : "dev";
  const formId = useId();
  const inputId = useId();
  const focusField = useRef(false);
  const edited = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const { control, handleSubmit, setError, clearErrors, reset, formState } = useForm<CredentialForm>({
    resolver: zodResolver(daily ? dailyCredentialForm : credentialForm),
    mode: "onTouched",
    defaultValues: { key: "" },
  });
  const blocked = busy || formState.isSubmitting;

  useEffect(() => {
    // The shared Dialog first establishes its focus trap. Move into the field after that.
    const frame = requestAnimationFrame(() => document.getElementById(inputId)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [inputId]);

  useLayoutEffect(() => {
    if (blocked || !focusField.current || !formState.errors.key) return;
    focusField.current = false;
    document.getElementById(inputId)?.focus();
  }, [blocked, formState.errors.key, inputId]);

  function close() {
    if (blocked) return;
    reset();
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(async ({ key }) => {
      if (!active || busy) return;
      setFailure(null);
      setRevealed(false);
      const result = await onConnect(key);
      if (result.ok) {
        reset();
        onClose();
      } else if (result.fieldError) {
        focusField.current = true;
        setError("key", { type: "provider", message: result.fieldError });
      } else if (result.message) {
        setFailure(result.message);
      }
    }, () => {
      focusField.current = true;
    })(event);
  }

  return (
    <BaseModal
      open
      onClose={close}
      title={t(`news:personal_${reconnect ? "reconnect" : "connect"}_${providerName}`)}
      subtitle={t(reconnect ? "news:personal_reconnect_description"
        : daily ? "news:personal_connect_daily_description" : "news:personal_connect_description")}
      size="sm"
      showCloseButton={!blocked}
      disableEscapeKeyDown={blocked}
      actions={<>
        <Button variant="outlined" disabled={blocked} onClick={close}>{t("core:cancel")}</Button>
        <Button type="submit" variant="contained" form={formId} loading={blocked} disabled={!active || blocked}>
          {t(reconnect ? "news:personal_test_and_replace" : "news:personal_test_and_connect")}
        </Button>
      </>}
    >
      <Stack
        component="form" id={formId} noValidate autoComplete="off" sx={{ gap: 2 }} onSubmit={submit}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setRevealed(false);
        }}
      >
        {failure && <Alert severity="error">{failure}</Alert>}
        <CredentialHelp>
          <Link href={daily ? "https://daily.dev/settings/api" : "https://dev.to/settings/extensions"}
            target="_blank" rel="noopener noreferrer">
            {t(`news:personal_find_${providerName}_key`)}
            <OpenInNewOutlinedIcon aria-hidden="true" fontSize="inherit" />
          </Link>
        </CredentialHelp>
        <Controller
          name="key"
          control={control}
          render={({ field, fieldState }) => (
            <TextInput
              id={inputId}
              label={t(daily ? "news:personal_daily_pat" : "news:personal_api_key")}
              type={revealed ? "text" : "password"}
              value={field.value}
              onBlur={() => { if (edited.current) field.onBlur(); }}
              onChange={(event) => {
                edited.current = true;
                if (fieldState.error?.type === "provider") clearErrors("key");
                field.onChange(event);
              }}
              required
              disabled={blocked || !active}
              error={fieldState.invalid}
              helperText={fieldState.error?.type === "provider"
                ? fieldState.error.message
                : t(fieldState.error?.message ?? (daily ? "news:personal_daily_key_hint" : "news:personal_key_hint"))}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label={t(revealed ? "news:personal_hide_key" : "news:personal_show_key")}
                    aria-pressed={revealed}
                    disabled={blocked || !active}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setRevealed((previous) => !previous)}
                    edge="end"
                  >
                    {revealed ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                  </IconButton>
                </InputAdornment>
              }
            />
          )}
        />
      </Stack>
    </BaseModal>
  );
}
