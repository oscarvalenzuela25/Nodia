import { useEffect, useRef, useState } from "react";
import { Alert, Button, Tooltip, Typography } from "@mui/material";
import EditOutlined from "@mui/icons-material/EditOutlined";
import CheckRounded from "@mui/icons-material/CheckRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import { Editor, EditorRow, ErrorBlock, Heading, TitleAction, TitleLine } from "./styles";
import type { ConversationTitleProps, ConversationTitleSnapshot } from "./types";

const schema = z.object({
  title: z.string().refine(value => new TextEncoder().encode(value.trim()).length <= 256, "organization.title_limit"),
});

function EditableTitle({ conversation, disabled, busy, error, onSave, onRefresh }: ConversationTitleProps) {
  const { t } = useTranslation("nodiaAi");
  const [editing, setEditing] = useState(false);
  const [baseRevision, setBaseRevision] = useState(conversation.revision);
  const [reviewed, setReviewed] = useState<ConversationTitleSnapshot | null>(null);
  const [tried, setTried] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const pencil = useRef<HTMLButtonElement | null>(null);
  const editor = useRef<HTMLFormElement | null>(null);
  const focusTarget = useRef<"pencil" | "input" | null>(null);
  const inFlight = useRef(false);
  const composing = useRef(false);
  const imeSubmit = useRef(false);
  const alive = useRef(true);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { title: "" } });
  const blocked = disabled || busy || refreshing || saving || form.formState.isSubmitting;
  const changed = conversation.revision > baseRevision;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (focusTarget.current === "pencil" && !editing && !disabled && !busy && !saving) {
      pencil.current?.focus();
      focusTarget.current = null;
    } else if (focusTarget.current === "input" && editing && !refreshing && !disabled && !busy && !saving) {
      editor.current?.querySelector("input")?.focus();
      focusTarget.current = null;
    }
  }, [editing, refreshing, disabled, busy, saving]);
  const close = () => {
    if (inFlight.current || blocked) return;
    focusTarget.current = "pencil";
    setEditing(false);
  };
  const save = async ({ title }: { title: string }) => {
    if (!alive.current || inFlight.current || disabled || busy || refreshing || changed) return;
    inFlight.current = true;
    setSaving(true);
    setTried(true);
    try {
      await onSave(title.trim() || null, baseRevision);
      if (alive.current) {
        focusTarget.current = "pencil";
        setEditing(false);
      }
    } catch {
      // The parent owns HTTP feedback; a rejected save preserves this exact draft and revision.
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const refresh = async () => {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    setRefreshing(true);
    setTried(true);
    try {
      const latest = await onRefresh();
      if (alive.current && latest?.conversation_id === conversation.conversation_id && latest.revision >= baseRevision) {
        if (latest.revision !== baseRevision) setReviewed(latest);
        setBaseRevision(latest.revision);
      }
    } catch {
      // Explicit recovery keeps the entered title; the parent owns the read error feedback.
    } finally {
      inFlight.current = false;
      if (alive.current) {
        focusTarget.current = "input";
        setRefreshing(false);
      }
    }
  };
  if (!editing) return <TitleLine>
    <Heading title={conversation.title ?? undefined}>{conversation.title ?? t("untitled")}</Heading>
    <Tooltip title={t("organization.rename")}><span><TitleAction ref={pencil} aria-label={t("organization.rename")} disabled={disabled || busy}
      onClick={() => {
        form.reset({ title: conversation.title ?? "" });
        setBaseRevision(conversation.revision);
        setReviewed(null);
        setTried(false);
        setEditing(true);
      }}><EditOutlined fontSize="small" /></TitleAction></span></Tooltip>
  </TitleLine>;
  const visibleError = tried ? error : null;
  return <Editor ref={editor} aria-label={t("organization.rename")}
    onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
    onSubmit={event => {
      if (composing.current || imeSubmit.current) { event.preventDefault(); return; }
      void form.handleSubmit(save)(event);
    }}>
    <EditorRow>
      <Controller name="title" control={form.control} render={({ field, fieldState }) => <TextInput label={t("organization.title")} value={field.value}
        onChange={field.onChange} onBlur={field.onBlur} autoFocus disabled={blocked} error={!!fieldState.error}
        helperText={fieldState.error ? t("organization.title_limit") : undefined}
        onKeyDown={event => {
          imeSubmit.current = event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
          if (composing.current || imeSubmit.current) return;
          if (event.key === "Escape") {
            event.preventDefault();
            if (!event.repeat) close();
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (!event.repeat && !blocked && !changed) event.currentTarget.form?.requestSubmit();
          }
        }} />} />
      <Tooltip title={t("organization.save")}><span><TitleAction type="submit" color="primary" aria-label={t("organization.save")} disabled={blocked || changed}
        onClick={() => { imeSubmit.current = false; }}>
        <CheckRounded /></TitleAction></span></Tooltip>
      <Tooltip title={t("core:cancel")}><span><TitleAction aria-label={t("core:cancel")} disabled={blocked} onClick={close}><CloseRounded /></TitleAction></span></Tooltip>
    </EditorRow>
    {reviewed && <Typography variant="caption" color="text.secondary">{t("organization.current_title", { title: reviewed.title ?? t("untitled") })}</Typography>}
    {(changed || visibleError) && <ErrorBlock>
      <Alert severity="error">{visibleError || t("organization.title_changed")}</Alert>
      <Button type="button" disabled={blocked} onClick={() => void refresh()}>{t("organization.review_latest")}</Button>
    </ErrorBlock>}
  </Editor>;
}

export default function ConversationTitle(props: ConversationTitleProps) {
  const { t } = useTranslation("nodiaAi");
  if (props.readOnly) return <TitleLine><Heading title={props.conversation.title ?? undefined}>{props.conversation.title ?? t("untitled")}</Heading></TitleLine>;
  return <EditableTitle {...props} />;
}
