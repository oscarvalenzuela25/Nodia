import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import BookmarkBorderOutlined from "@mui/icons-material/BookmarkBorderOutlined";
import BookmarkAddedOutlined from "@mui/icons-material/BookmarkAddedOutlined";
import ChatBubbleOutlineOutlined from "@mui/icons-material/ChatBubbleOutlineOutlined";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import BlockLearningTools from "../AdaptiveWorkspace/BlockLearningTools";
import LessonMarkdown from "../LessonMarkdown";
import { findStudyFragments, SpellingSequence, VowelComparison } from "../StudyFragmentPilot";
import type { AdaptivePanelProps } from "../AdaptiveWorkspace/types";
import type { LessonInteraction } from "../../infrastructure/learningSchemas";
import { parseStudyPractice } from "../../infrastructure/studyPractice";
import type { TopicClarificationProps } from "./TopicClarification";
import { readTopicSelection } from "./selection";
import { Topic, TopicActions, TopicColumns, TopicHeader, TopicText } from "./styles";

type TopicBlock = { id: string; title: string; kind?: string; body_markdown: string };
type Props = Omit<AdaptivePanelProps, "visible" | "onPractice"> & {
  blocks: TopicBlock[];
  contentVersionId: string;
  history?: LessonInteraction[];
  savedBlockId: string | null;
  onSaveReadingPoint: (blockId: string) => Promise<unknown>;
};
type OpenPanel = { scope: string; blockId: string; anchor: string | null; range?: Range };
type Selected = NonNullable<ReturnType<typeof readTopicSelection>> & { scope: string };

export default function LessonTopics({ blocks, ...props }: Props) {
  const { t } = useTranslation();
  const { search } = useLocation();
  const lesson = useRef<HTMLDivElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const pressedSelection = useRef<Selected | null>(null);
  const intent = useRef(0);
  const [selection, setSelection] = useState<Selected | null>(null);
  const [panels, setPanels] = useState<Record<string, OpenPanel>>({});
  const [activePanel, setActivePanel] = useState<OpenPanel | null>(null);
  const [Loaded, setLoaded] = useState<ComponentType<TopicClarificationProps> | null>(null);
  const [loading, setLoading] = useState<OpenPanel | null>(null);
  const [failed, setFailed] = useState<OpenPanel | null>(null);
  const topics = useMemo(() => blocks.map(block => ({ block, practice: parseStudyPractice(block.body_markdown, block.kind) })), [blocks]);
  const studyFragments = useMemo(() => import.meta.env.DEV && new URLSearchParams(search).get("studyFragments") === "1"
    ? findStudyFragments(blocks) : null, [blocks, search]);
  const scope = JSON.stringify([props.session.id, props.contentVersionId]);
  const open = activePanel?.scope === scope ? activePanel : null;
  const finalActive = props.session.active_attempts.some(attempt => attempt.scope === "section_final" && attempt.state === "in_progress");

  useEffect(() => {
    const updateSelection = () => {
      const current = readTopicSelection(window.getSelection(), lesson.current);
      setSelection(current && { ...current, scope });
    };
    document.addEventListener("selectionchange", updateSelection);
    return () => document.removeEventListener("selectionchange", updateSelection);
  }, [scope]);
  useEffect(() => () => { ++intent.current; }, [scope]);
  useEffect(() => {
    if (!open?.range || !open.range.startContainer.isConnected || typeof Highlight === "undefined" || !CSS.highlights) return;
    CSS.highlights.set("teacher-topic-fragment", new Highlight(open.range));
    return () => { CSS.highlights.delete("teacher-topic-fragment"); };
  }, [open]);

  const openPanel = async (panel: OpenPanel) => {
    const turn = ++intent.current;
    setFailed(null);
    setActivePanel(panel);
    const key = JSON.stringify([panel.scope, panel.blockId]);
    if (!Loaded) {
      setLoading(panel);
      try {
        const module = await import("./TopicClarification");
        if (turn !== intent.current) return;
        setLoaded(() => module.default);
      } catch {
        if (turn === intent.current) setFailed(panel);
        return;
      } finally {
        if (turn === intent.current) setLoading(null);
      }
    }
    setPanels(current => ({
      ...Object.fromEntries(Object.entries(current).filter(([, value]) => value.scope === panel.scope)),
      [key]: panel,
    }));
  };
  const closePanel = (blockId: string) => {
    ++intent.current;
    setActivePanel(null);
    setLoading(null);
    setFailed(null);
    requestAnimationFrame(() => triggers.current.get(blockId)?.focus({ preventScroll: true }));
  };

  return <Stack ref={lesson} sx={{ gap: 3, minWidth: 0 }}>
    {topics.map(({ block, practice }) => {
      const key = JSON.stringify([scope, block.id]);
      const retained = panels[key];
      const current = open?.blockId === block.id;
      const candidate = selection?.scope === scope && selection.blockId === block.id && selection.range.startContainer.isConnected
        && block.body_markdown.includes(selection.text) ? selection : null;
      const loadingThisTopic = loading?.scope === scope && loading.blockId === block.id;
      const failure = failed?.scope === scope && failed.blockId === block.id ? failed : null;
      const triggerHidden = current && retained && (!candidate || candidate.text === retained.anchor);
      return <TopicBlockView key={block.id} block={block}
        saved={props.savedBlockId === block.id}
        busy={props.busy}
        onSave={() => props.onSaveReadingPoint(block.id)}>
        <TopicColumns data-clarification-open={current && Loaded && retained ? true : undefined}>
          <Stack sx={{ gap: 1.5, minWidth: 0 }}>
            {import.meta.env.DEV && studyFragments?.vowels === block.id && <VowelComparison key={scope} />}
            {import.meta.env.DEV && studyFragments?.spelling === block.id && <SpellingSequence key={scope} />}
            {practice.mainMarkdown && <TopicText data-lesson-topic-text={block.id}><LessonMarkdown text={practice.mainMarkdown} /></TopicText>}
            <BlockLearningTools session={props.session} busy={props.busy} command={props.command} onResult={props.onResult}
              history={props.history} contentVersionId={props.contentVersionId} block={block} practice={practice} />
            <TopicActions sx={{ display: triggerHidden ? "none" : undefined }}>
              <Button ref={node => { if (node) triggers.current.set(block.id, node); else triggers.current.delete(block.id); }}
                variant={candidate && !current ? "contained" : "outlined"} startIcon={<ChatBubbleOutlineOutlined />}
                aria-expanded={Boolean(current && retained)} loading={loadingThisTopic} disabled={props.busy}
                onPointerDown={event => {
                  pressedSelection.current = candidate;
                  if (candidate && event.pointerType === "mouse") event.preventDefault();
                }}
                onClick={event => {
                  const captured = pressedSelection.current;
                  const selected = event.detail && captured?.scope === scope && captured.blockId === block.id ? captured : candidate;
                  pressedSelection.current = null;
                  if (current && retained && (!selected || selected.text === retained.anchor)) { closePanel(block.id); return; }
                  event.currentTarget.focus({ preventScroll: true });
                  const panel = selected && !finalActive
                    ? { scope, blockId: block.id, anchor: selected.text, range: selected.range }
                    : failure ?? retained ?? { scope, blockId: block.id, anchor: null };
                  void openPanel(panel);
                }}>
                {t(failure ? "teacher:adaptive.retry_clarification" : "teacher:topic.clarify")}
              </Button>
            </TopicActions>
            {failure && <Alert severity="error">{t("teacher:adaptive.load_failed")}</Alert>}
          </Stack>
          {Loaded && retained && <Loaded key={scope} open={current} onClose={() => closePanel(block.id)} anchor={retained.anchor}
            session={props.session} busy={props.busy} command={props.command}
            contentVersionId={props.contentVersionId} blockId={block.id} />}
        </TopicColumns>
      </TopicBlockView>;
    })}
  </Stack>;
}

function TopicBlockView({ block, saved, busy, onSave, children }: {
  block: TopicBlock; saved: boolean; busy: boolean; onSave: () => Promise<unknown>; children: ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (busy || saving || saved) return;
    setSaving(true);
    try { await onSave(); } finally { setSaving(false); }
  };
  return <Topic id={`teacher-block-${block.id}`} aria-labelledby={titleId} tabIndex={-1}>
    <Stack sx={{ gap: 2, minWidth: 0 }}>
      <TopicHeader>
        <Typography id={titleId} variant="h6" component="h3">{block.title}</Typography>
        <Button variant="outlined" color={saved ? "success" : "primary"} aria-disabled={saved || undefined}
          startIcon={saved ? <BookmarkAddedOutlined /> : <BookmarkBorderOutlined />}
          disabled={busy && !saved} loading={saving} onClick={() => void save()}>
          {t(saved ? "teacher:topic.reading_point_saved" : "teacher:save_reading_point")}
        </Button>
      </TopicHeader>
      {children}
    </Stack>
  </Topic>;
}
