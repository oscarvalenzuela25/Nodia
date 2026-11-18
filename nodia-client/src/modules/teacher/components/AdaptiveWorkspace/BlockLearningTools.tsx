import type { LessonInteraction } from "../../infrastructure/learningSchemas";
import LessonMarkdown from "../LessonMarkdown";
import { useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import type { AdaptivePanelProps } from "./types";

export default function BlockLearningTools(props: Omit<AdaptivePanelProps, "visible" | "onPractice"> & { contentVersionId: string; history?: LessonInteraction[]; block: { id: string; kind?: string; body_markdown: string } }) {
  const { t } = useTranslation();
  const contextKey = `${props.session.id}:${props.contentVersionId}:${props.block.id}`;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const text = drafts[contextKey] ?? "";
  const setText = (value: string) => setDrafts(current => ({ ...current, [contextKey]: value }));
  const disabled = props.busy || ["paused", "archived"].includes(props.session.state);
  const interactionKind = props.block.kind === "prediction" || props.block.kind === "check" ? props.block.kind : null;
  if (!interactionKind) return null;
  const prior = props.history?.filter(item => item.content_version_id === props.contentVersionId && item.block_id === props.block.id) ?? [];
  return <Stack sx={{ gap: 1 }}>
    {props.history === undefined && <Alert severity="info">{t("teacher:adaptive.block_history_unavailable")}</Alert>}
    {prior.map(item => <Stack key={item.id}><Typography variant="caption">{t("teacher:adaptive.saved_block_response")}</Typography><LessonMarkdown text={item.text} /></Stack>)}
    <TextInput label={t(interactionKind === "prediction" ? "teacher:adaptive.prediction" : "teacher:adaptive.check")} value={text} disabled={disabled} multiline onChange={event => setText(event.target.value)} />
    <Button variant="outlined" disabled={disabled || !text.trim() || text.length > 2000} onClick={async () => {
      const result = await props.command.execute(`sessions/${props.session.id}/learning/interactions`, { expected_session_revision: props.session.revision, content_version_id: props.contentVersionId, block_id: props.block.id, kind: interactionKind, text });
      if (result) { setText(""); props.onResult(result); }
    }}>{t("teacher:adaptive.save_interaction")}</Button>
  </Stack>;
}
