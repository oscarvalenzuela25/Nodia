import { useRef, useState, type ReactNode } from "react";
import { isAxiosError } from "axios";
import type { Flashcard, FlashcardDeck, FlashcardDraft } from "../../infrastructure/flashcards";
import FlashcardEditor, { type FlashcardEditorProps } from "./FlashcardEditor";

type Props = {
  decks: readonly FlashcardDeck[];
  initialValues?: FlashcardDraft;
  mode?: "create" | "lesson";
  title?: string;
  busy?: boolean;
  status?: ReactNode;
  textRequest?: FlashcardEditorProps["textRequest"];
  libraryRequest?: FlashcardEditorProps["libraryRequest"];
  createCard: (draft: FlashcardDraft, requestKey: string) => Promise<Flashcard | null>;
  onCreated: (card: Flashcard) => void;
  onClose: () => void;
};

type CreateIntent = { draft: FlashcardDraft; key: string };

export default function FlashcardCreateDrawer({
  decks, initialValues, mode, title, busy, status, textRequest, libraryRequest, createCard, onCreated, onClose,
}: Props) {
  const intent = useRef<CreateIntent | null>(null);
  const sending = useRef(false);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);

  const submit = async (draft: FlashcardDraft) => {
    if (sending.current) return false;
    const request = intent.current ?? { draft, key: crypto.randomUUID() };
    intent.current = request;
    sending.current = true;
    setPending(true);
    try {
      const card = await createCard(request.draft, request.key);
      if (!card) {
        setUncertain(true);
        return false;
      }
      intent.current = null;
      setUncertain(false);
      onCreated(card);
      return true;
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const possiblySaved = status === undefined || status === 408 || status >= 500;
      if (!possiblySaved) intent.current = null;
      setUncertain(possiblySaved);
      return false;
    } finally {
      sending.current = false;
      setPending(false);
    }
  };

  return <FlashcardEditor decks={decks} initialValues={initialValues} mode={mode} title={title} busy={busy || pending}
    status={status} textRequest={textRequest} libraryRequest={libraryRequest}
    uncertain={uncertain} onRetry={() => { if (intent.current) void submit(intent.current.draft); }}
    onClose={onClose} onSave={submit} />;
}
