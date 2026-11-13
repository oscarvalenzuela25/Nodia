import type { LessonInteraction } from "../../infrastructure/learningSchemas";
import LessonMarkdown from "../LessonMarkdown";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import type { AdaptivePanelProps } from "./types";
import type { ClarificationAnchor } from "./ClarificationPanel";

export default function BlockLearningTools(props: Omit<AdaptivePanelProps, "visible" | "onPractice"> & { contentVersionId: string; history?: LessonInteraction[]; block: { id: string; kind?: string; body_markdown: string } }) {
  const { t } = useTranslation();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const contextKey = `${props.session.id}:${props.contentVersionId}:${props.block.id}`;
  const context = useRef(contextKey);
  useLayoutEffect(() => { context.current = contextKey; }, [contextKey]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const text = drafts[contextKey] ?? "";
  const setText = (value: string) => setDrafts(current => ({ ...current, [contextKey]: value }));
  const [anchors, setAnchors] = useState<Record<string, ClarificationAnchor>>({});
  const anchor = anchors[contextKey] ?? null;
  const [Component, setComponent] = useState<ComponentType<AdaptivePanelProps & { anchor?: ClarificationAnchor }> | null>(null);
  const [loadingContext, setLoadingContext] = useState<string | null>(null);
  const loading = loadingContext === contextKey;
  const [failed, setFailed] = useState(false);
  const [invalidSelection, setInvalidSelection] = useState(false);
  const finalActive = props.session.active_attempts.some(attempt => attempt.scope === "section_final" && attempt.state === "in_progress");
  const disabled = props.busy || ["paused", "archived"].includes(props.session.state);
  const clarify = async () => {
    const selection = window.getSelection()?.toString() ?? "";
    if (!selection || !props.block.body_markdown.includes(selection)) { setInvalidSelection(true); return; }
    setInvalidSelection(false); setLoadingContext(contextKey); setFailed(false);
    try { const module = await import("./ClarificationPanel"); if (!mounted.current || context.current !== contextKey) return; setComponent(() => module.default); setAnchors(current => ({ ...current, [contextKey]: { content_version_id: props.contentVersionId, block_id: props.block.id, selection } })); }
    catch { if (mounted.current && context.current === contextKey) setFailed(true); }
    finally { if (mounted.current) setLoadingContext(current => current === contextKey ? null : current); }
  };
  const interactionKind = props.block.kind === "prediction" || props.block.kind === "check" ? props.block.kind : null;
  const prior = props.history?.filter(item => item.content_version_id === props.contentVersionId && item.block_id === props.block.id) ?? [];
  return <Stack sx={{ gap: 1 }}>
    {interactionKind && props.history === undefined && <Alert severity="info">{t("teacher:adaptive.block_history_unavailable")}</Alert>}
    {interactionKind && prior.map(item => <Stack key={item.id}><Typography variant="caption">{t("teacher:adaptive.saved_block_response")}</Typography><LessonMarkdown text={item.text} /></Stack>)}
    {interactionKind && <><TextInput label={t(interactionKind === "prediction" ? "teacher:adaptive.prediction" : "teacher:adaptive.check")} value={text} disabled={disabled} multiline onChange={event => setText(event.target.value)} /><Button variant="outlined" disabled={disabled || !text.trim() || text.length > 2000} onClick={async () => { const result = await props.command.execute(`sessions/${props.session.id}/learning/interactions`, { expected_session_revision: props.session.revision, content_version_id: props.contentVersionId, block_id: props.block.id, kind: interactionKind, text }); if (result) { setText(""); props.onResult(result); } }}>{t("teacher:adaptive.save_interaction")}</Button></>}
    <Button variant="outlined" disabled={disabled || loading || finalActive} onClick={() => void clarify()}>{t(failed ? "teacher:adaptive.retry_clarification" : "teacher:adaptive.clarify_selection")}</Button>
    {invalidSelection && <Alert severity="info">{t("teacher:adaptive.select_exact_fragment")}</Alert>}
    {failed && <Alert severity="error">{t("teacher:adaptive.load_failed")}</Alert>}
    {Component && anchor && <Component session={props.session} busy={props.busy} command={props.command} onResult={props.onResult} onPractice={() => undefined} visible anchor={anchor} />}
  </Stack>;
}
