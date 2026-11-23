import { useState, type ComponentProps } from "react";
import { LinearProgress } from "@mui/material";
import { useTranslation } from "react-i18next";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import { useFlashcardDecks, useFlashcardWrites } from "../../infrastructure/useFlashcards";
import { flashcardSourceLabelLimit, type FlashcardSource } from "../../infrastructure/flashcards";
import type { Selection } from "../../infrastructure/schemas";
import FlashcardCreateDrawer from "../Flashcards/FlashcardCreateDrawer";
import LessonTopics, { type LessonFlashcardSelection } from "./LessonTopics";

type Props = Omit<ComponentProps<typeof LessonTopics>, "onCreateFlashcard" | "flashcardEditorOpen"> & { sourceLabel: string };

export default function LessonTopicsWithFlashcards({ sourceLabel, ...props }: Props) {
  const [selection, setSelection] = useState<LessonFlashcardSelection | null>(null);
  return <>
    <LessonTopics {...props} onCreateFlashcard={setSelection} flashcardEditorOpen={Boolean(selection)} />
    {selection && <LessonFlashcardDrawer selection={selection} sourceLabel={sourceLabel}
      aiSelection={props.session.selection} onClose={() => setSelection(null)} />}
  </>;
}

function LessonFlashcardDrawer({ selection, sourceLabel, aiSelection, onClose }: {
  selection: LessonFlashcardSelection; sourceLabel: string; aiSelection: Selection | null; onClose: () => void;
}) {
  const { t } = useTranslation();
  const decks = useFlashcardDecks();
  const writes = useFlashcardWrites();
  const anchor: NonNullable<FlashcardSource["anchor"]> = {
    session_id: selection.sessionId,
    content_version_id: selection.contentVersionId,
    block_id: selection.blockId,
    selection: selection.quote,
  };

  return <FlashcardCreateDrawer mode="lesson" decks={decks.data ?? []}
    textRequest={{ target: { source: anchor }, selection: aiSelection }}
    initialValues={{
      question: "",
      answer: selection.quote,
      source: {
        label: sourceLabel.trim().slice(0, flashcardSourceLabelLimit).replace(/[\uD800-\uDBFF]$/u, ""),
        anchor,
      },
    }}
    busy={writes.busy || decks.isFetching} createCard={writes.createCard} onCreated={onClose} onClose={onClose}
    status={<>
      {decks.isFetching && <LinearProgress aria-label={t("core:loading_route")} />}
      <QueryErrorAlert retryVariant="outlined" isError={decks.isError} isFetching={decks.isFetching} onRetry={decks.refetch} />
    </>} />;
}
