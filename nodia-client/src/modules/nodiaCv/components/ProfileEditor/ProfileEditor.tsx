import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Alert, Box, Button, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import ArrowUpwardOutlined from "@mui/icons-material/ArrowUpwardOutlined";
import ArrowDownwardOutlined from "@mui/icons-material/ArrowDownwardOutlined";
import HelpOutlineOutlined from "@mui/icons-material/HelpOutlineOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { useTranslation } from "react-i18next";
import { Controller, useFieldArray, useForm, type Control, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import { getServerErrorCode } from "../../../../config/axiosInstance";
import { getHttpErrorMessage } from "../../../../config/httpFeedback";
import { profileEditorSchema, profileEditorValues, profileRowLimit, type ProfileForm, type ProfileInput, type ProfileRecord } from "../../infrastructure/profileSchema";
import { profileWriteMayHaveCommitted } from "../../infrastructure/profiles";
import { collections, contactFields, personalFields, type ProfileCollection, type ProfileField } from "./profileFields";

type FormControl = Control<ProfileForm, unknown, ProfileInput>;
const fieldGrid = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 };
const target = { minHeight: 44, minWidth: 44 };

type ActiveProfileHelp = { id: string; activated: boolean };
type ProfileHelp = {
  active: ActiveProfileHelp | null;
  setActive: Dispatch<SetStateAction<ActiveProfileHelp | null>>;
};
type ProfileFieldGroup = "personal" | "contact" | ProfileCollection;

function ProfileInputField({ item, name, group, help, control, disabled, autoFocus }: {
  item: ProfileField; name: FieldPath<ProfileForm>; control: FormControl; disabled: boolean; autoFocus?: boolean;
  group: ProfileFieldGroup; help: ProfileHelp;
}) {
  const { t } = useTranslation("nodiaCv");
  const id = useId();
  const helpId = `${id}-help`;
  const label = t(`fields.${item.name}`);
  const helpOpen = !disabled && help.active?.id === helpId;
  const dismissHelp = (fromMouseLeave = false) => {
    help.setActive(current => current?.id === helpId && !(fromMouseLeave && current.activated) ? null : current);
  };
  const helpButton = (
    <IconButton
      id={helpId}
      type="button"
      size="small"
      aria-label={t("field_help_label", { field: label })}
      aria-expanded={helpOpen}
      disabled={disabled}
      onClick={() => help.setActive(current => current?.id === helpId && current.activated
        ? null
        : { id: helpId, activated: true })}
      onBlur={() => dismissHelp()}
      sx={{ width: { xs: 44, sm: 28 }, height: { xs: 44, sm: 28 }, flexShrink: 0, color: "text.secondary" }}
    >
      <HelpOutlineOutlined sx={{ fontSize: 18 }} />
    </IconButton>
  );
  const labelAdornment = disabled ? helpButton : (
    <Tooltip
      id={`${helpId}-description`}
      title={t(`field_help.${group}.${item.name}`)}
      open={helpOpen}
      onOpen={() => help.setActive({ id: helpId, activated: false })}
      // A tap also emits mouse events. Its help stays open until dismissed.
      onClose={event => dismissHelp(event.type === "mouseleave")}
      enterDelay={0}
      describeChild
      disableTouchListener
      arrow
    >
      {helpButton}
    </Tooltip>
  );
  const multiline = item.kind === "area" || item.kind === "lines";
  const hint = item.kind === "lines" ? t("one_per_line")
    : item.kind === "month" ? t("month_hint")
      : item.kind === "year" ? t("year_hint") : undefined;
  const type = item.kind === "email" || item.kind === "url" || item.kind === "tel" ? item.kind : "text";
  return (
    <Box sx={{ gridColumn: multiline ? "1 / -1" : undefined, minWidth: 0 }}>
      <Controller name={name} control={control} render={({ field, fieldState }) => {
        const value = Array.isArray(field.value) ? field.value.join("\n") : typeof field.value === "string" ? field.value : "";
        const helperText = fieldState.error?.message ? t(fieldState.error.message) : hint;
        return item.kind === "status" ? (
          <SelectSingleInput id={id} label={label} labelAdornment={labelAdornment} value={value || "unspecified"} disabled={disabled} clearable={false}
            onChange={next => field.onChange(next === "unspecified" ? "" : next)}
            error={Boolean(fieldState.error)} helperText={helperText}
            options={[{ value: "unspecified", label: t("status.unspecified") }, { value: "current", label: t("status.current") },
              { value: "finished", label: t("status.finished") }]} />
        ) : (
          <TextInput id={id} name={field.name} label={label} labelAdornment={labelAdornment} value={value} onChange={field.onChange} onBlur={field.onBlur} autoFocus={autoFocus}
            disabled={disabled} required={item.required} type={type} multiline={multiline} minRows={multiline ? 2 : undefined}
            maxRows={multiline ? 6 : undefined} placeholder={item.kind === "month" ? "YYYY-MM" : item.kind === "year" ? "YYYY" : undefined}
            inputMode={item.kind === "year" ? "numeric" : undefined} error={Boolean(fieldState.error)} helperText={helperText} />
        );
      }} />
    </Box>
  );
}

function ProfileCollectionEditor({ definition, help, control, disabled }: {
  definition: (typeof collections)[number]; help: ProfileHelp; control: FormControl; disabled: boolean;
}) {
  const { t } = useTranslation("nodiaCv");
  const id = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const rowsRoot = useRef<HTMLDivElement>(null);
  const { fields, append, remove, move } = useFieldArray({
    control, name: definition.name, keyName: "editorKey",
  });
  const focusRow = (index: number) => {
    requestAnimationFrame(() => {
      const field = rowsRoot.current?.querySelectorAll<HTMLElement>("[data-cv-editor-row]")[index]?.querySelector<HTMLElement>("input, textarea");
      (field ?? addButton.current)?.focus();
    });
  };
  return (
    <Stack component="section" aria-labelledby={id} spacing={1.5}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 1 }}>
        <Typography id={id} component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>{t(`sections.${definition.name}`)}</Typography>
        <Button ref={addButton} variant="outlined" startIcon={<AddOutlined />} sx={target}
          disabled={disabled || fields.length >= profileRowLimit}
          onClick={() => {
            append(definition.initial, { shouldFocus: false });
            focusRow(fields.length);
          }}>
          {t(`add.${definition.name}`)}
        </Button>
      </Stack>
      <Stack ref={rowsRoot} spacing={1.5}>
        {fields.map((row, index) => (
          <Paper key={row.editorKey} data-cv-editor-row variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
              <Typography component="h4" variant="subtitle2">{t(`items.${definition.name}`, { count: index + 1 })}</Typography>
              <Stack direction="row">
                <Tooltip title={t("move_up")}><span>
                  <IconButton type="button" size="small" sx={target} aria-label={t("move_up")} disabled={disabled || index === 0}
                    onClick={() => { move(index, index - 1); focusRow(index - 1); }}><ArrowUpwardOutlined fontSize="small" /></IconButton>
                </span></Tooltip>
                <Tooltip title={t("move_down")}><span>
                  <IconButton type="button" size="small" sx={target} aria-label={t("move_down")} disabled={disabled || index === fields.length - 1}
                    onClick={() => { move(index, index + 1); focusRow(index + 1); }}><ArrowDownwardOutlined fontSize="small" /></IconButton>
                </span></Tooltip>
                <Tooltip title={t("remove_row")}>
                  <IconButton type="button" size="small" color="error" sx={target} aria-label={t("remove_row")} disabled={disabled}
                    onClick={() => { remove(index); focusRow(Math.min(index, fields.length - 2)); }}><DeleteOutlined fontSize="small" /></IconButton>
                </Tooltip>
              </Stack>
            </Stack>
            <Box sx={fieldGrid}>
              {definition.fields.map(item => (
                <ProfileInputField key={item.name} item={item} name={`${definition.name}.${index}.${item.name}` as FieldPath<ProfileForm>}
                  group={definition.name} help={help} control={control} disabled={disabled} />
              ))}
            </Box>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}

type Props = {
  title: string;
  values: ProfileForm;
  editing?: Pick<ProfileRecord, "id" | "revision">;
  onClose: () => void;
  onSave: (values: ProfileInput, intent: { requestKey: string } | Pick<ProfileRecord, "id" | "revision">) => Promise<unknown>;
  onReload?: () => Promise<ProfileRecord>;
};

export default function ProfileEditor({ title, values, editing, onClose, onSave, onReload }: Props) {
  const { t } = useTranslation("nodiaCv");
  const id = useId();
  const editor = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const [discard, setDiscard] = useState(false);
  const [serverError, setServerError] = useState("");
  const [baseline, setBaseline] = useState(editing);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [uncertain, setUncertain] = useState<{ input: ProfileInput; key: string }>();
  const [activeHelp, setActiveHelp] = useState<ActiveProfileHelp | null>(null);
  const { handleSubmit, control, reset, setError, formState: { isDirty, isSubmitting, errors } } = useForm<ProfileForm, unknown, ProfileInput>({
    resolver: zodResolver(profileEditorSchema), defaultValues: values, mode: "onTouched",
  });
  const busy = isSubmitting || reloading;
  const disabled = busy || Boolean(uncertain);
  const help: ProfileHelp = { active: activeHelp, setActive: setActiveHelp };

  useEffect(() => {
    const ownerDocument = editor.current?.ownerDocument;
    if (!ownerDocument || !activeHelp || disabled) return;

    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setActiveHelp(null);
    };
    const dismissOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      const trigger = ownerDocument.getElementById(activeHelp.id);
      const tooltip = ownerDocument.getElementById(`${activeHelp.id}-description`);
      if (trigger?.contains(event.target) || tooltip?.contains(event.target)) return;
      setActiveHelp(null);
    };
    // Capture Escape before the surrounding modal interprets it as a close.
    ownerDocument.addEventListener("keydown", dismissOnEscape, true);
    ownerDocument.addEventListener("pointerdown", dismissOnOutsidePointer, true);
    return () => {
      ownerDocument.removeEventListener("keydown", dismissOnEscape, true);
      ownerDocument.removeEventListener("pointerdown", dismissOnOutsidePointer, true);
    };
  }, [activeHelp, disabled]);

  const close = () => {
    if (inFlight.current) return;
    if (isDirty || uncertain) {
      setDiscard(true);
      requestAnimationFrame(() => editor.current?.querySelector<HTMLElement>("[data-cv-keep]")?.focus());
    } else onClose();
  };

  const save = async (input: ProfileInput) => {
    if (inFlight.current || discard || conflict) return;
    const intent = baseline ?? { requestKey: uncertain?.key ?? crypto.randomUUID() };
    inFlight.current = true;
    setActiveHelp(null);
    setServerError("");
    try {
      await onSave(uncertain?.input ?? input, intent);
    } catch (error) {
      if ("requestKey" in intent && profileWriteMayHaveCommitted(error)) setUncertain({ input: uncertain?.input ?? input, key: intent.requestKey });
      else setUncertain(undefined);
      if (isAxiosError<{ message?: unknown; field?: unknown }>(error)) {
        if (baseline && error.response?.status === 409) setConflict(true);
        const result = error.response?.data;
        const field = result?.field;
        const code = getServerErrorCode(error) ?? result?.message;
        if (code === "nodiaCv:invalid_profile_dates" && typeof field === "string"
          && /^(?:(?:experiences|projects)\.(?:[0-9]|1[0-9]|2[0-4])\.end_month|education\.(?:[0-9]|1[0-9]|2[0-4])\.end_year)$/.test(field)) {
          setError(field as FieldPath<ProfileForm>, { type: "server", message: code });
        }
      }
      setServerError(getHttpErrorMessage(error));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      inFlight.current = false;
    }
  };

  const reload = async () => {
    if (!onReload || inFlight.current) return;
    inFlight.current = true;
    setReloading(true);
    try {
      const current = await onReload();
      reset(profileEditorValues(current));
      setBaseline({ id: current.id, revision: current.revision });
      setServerError("");
      setConflict(false);
      requestAnimationFrame(() => editor.current?.querySelector<HTMLElement>("input")?.focus());
    } catch (error) {
      setServerError(getHttpErrorMessage(error));
    } finally {
      inFlight.current = false;
      setReloading(false);
    }
  };

  return (
    <BaseModal open title={title} size="lg" onClose={close} disableEscapeKeyDown={busy} showCloseButton={!busy}
      actions={<>
        <Button type="button" variant="outlined" disabled={busy} onClick={close} sx={target}>{t("core:cancel")}</Button>
        <Button type="submit" form={id} variant="contained" startIcon={<SaveOutlined />} loading={isSubmitting}
          disabled={discard || conflict || reloading} sx={target}>{t(uncertain ? "retry_save" : "save_profile")}</Button>
      </>}>
      <Stack ref={editor} component="form" id={id} noValidate spacing={3}
        onSubmit={event => {
          void handleSubmit(save, () => requestAnimationFrame(() => {
            const firstInvalid = editor.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
            (firstInvalid ?? errorRef.current)?.focus();
          }))(event);
        }}>
        {discard && (
          <Alert severity="warning">
            <Stack spacing={1}>
              <Typography variant="body2">{t(uncertain ? "discard_uncertain" : "discard_confirm")}</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button type="button" data-cv-keep variant="outlined" color="inherit" sx={target}
                  onClick={() => {
                    setDiscard(false);
                    requestAnimationFrame(() => editor.current?.querySelector<HTMLElement>("input")?.focus());
                  }}>{t("keep_editing")}</Button>
                <Button type="button" variant="outlined" color="inherit" sx={target} onClick={onClose}>{t("discard")}</Button>
              </Stack>
            </Stack>
          </Alert>
        )}
        {(serverError || errors.root?.message) && (
          <Alert ref={errorRef} tabIndex={-1} severity="error">{serverError || t(errors.root?.message ?? "core:server_error_toast")}</Alert>
        )}
        {conflict && <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "stretch", sm: "center" }, gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{t("reload_profile_description")}</Typography>
          <Button type="button" variant="outlined" loading={reloading} sx={target} onClick={() => { void reload(); }}>
            {t("reload_profile")}
          </Button>
        </Stack>}
        {uncertain && <Alert severity="warning">{t("uncertain_create")}</Alert>}
        <Box sx={fieldGrid}>
          {personalFields.map(item => <ProfileInputField key={item.name} item={item} name={item.name as FieldPath<ProfileForm>}
            group="personal" help={help} control={control} disabled={disabled} autoFocus={!editing && item.name === "profile_name"} />)}
        </Box>
        <Stack component="section" spacing={1.5}>
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>{t("sections.contact")}</Typography>
          <Box sx={fieldGrid}>
            {contactFields.map(item => <ProfileInputField key={item.name} item={item} name={`contact.${item.name}` as FieldPath<ProfileForm>}
              group="contact" help={help} control={control} disabled={disabled} />)}
          </Box>
        </Stack>
        {collections.map(definition => <ProfileCollectionEditor key={definition.name} definition={definition}
          help={help} control={control} disabled={disabled} />)}
      </Stack>
    </BaseModal>
  );
}
