import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import { notifyHttpError } from "../../../config/httpFeedback";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import i18n from "../../../translate";
import { useTeacherQuery } from "./useServices";
import type { FlashcardImportBatch } from "./flashcardImport";
import {
  flashcardDecksSchema, flashcardPageSchema,
  type Flashcard, type FlashcardDraft, type FlashcardPage, type FlashcardUpdate,
} from "./flashcards";
import {
  createFlashcard, createFlashcardDeck, deleteFlashcard, flashcardDecksPath, flashcardsPath, importFlashcards,
  readFlashcardImage, recordFlashcardReview, updateFlashcard,
} from "./flashcardServices";

const imageKey = "flashcards/image";

export const useFlashcardDecks = (enabled = true) =>
  useTeacherQuery(flashcardDecksPath, flashcardDecksSchema, undefined, enabled);

export const useFlashcards = (deckId: string, page: number, enabled = true) =>
  useTeacherQuery(flashcardsPath, flashcardPageSchema, { deck_id: deckId, page }, Boolean(deckId && enabled));

export function useFlashcardImage(card: Flashcard | undefined, enabled = true) {
  const user = useAuthStore(state => state.user?.id);
  const session = useAuthStore(state => state.sessionVersion);
  const active = useAuthStore(hasActiveSession);
  const id = card?.id;
  const query = useQuery({
    queryKey: ["teacher", user, session, imageKey, id, card?.revision],
    queryFn: ({ signal }) => {
      if (!id) throw new Error("flashcard_identity_missing");
      return readFlashcardImage(id, signal);
    },
    enabled: Boolean(user && active && id && card?.image && enabled),
    staleTime: 300_000,
    gcTime: 60_000,
    retry: false,
  });
  useEffect(() => { if (query.error) notifyHttpError(query.error); }, [query.error]);
  return { src: query.data ?? null, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}

type Intent =
  | { kind: "deck"; title: string; category?: string }
  | { kind: "import"; batch: FlashcardImportBatch; requestKey: string }
  | { kind: "create"; draft: FlashcardDraft; requestKey: string }
  | { kind: "update"; id: string; patch: FlashcardUpdate }
  | { kind: "delete"; id: string }
  | { kind: "review"; id: string; remembered: boolean; requestKey: string };

async function execute(intent: Intent) {
  switch (intent.kind) {
    case "deck": return { kind: intent.kind, data: await createFlashcardDeck(intent.title, intent.category) } as const;
    case "import": return { kind: intent.kind, data: await importFlashcards(intent.batch, intent.requestKey) } as const;
    case "create": return { kind: intent.kind, data: await createFlashcard(intent.draft, intent.requestKey) } as const;
    case "update": return { kind: intent.kind, data: await updateFlashcard(intent.id, intent.patch) } as const;
    case "delete":
      await deleteFlashcard(intent.id);
      return { kind: intent.kind } as const;
    case "review":
      await recordFlashcardReview(intent.id, intent.remembered, intent.requestKey);
      return { kind: intent.kind } as const;
  }
}

const successKey = {
  deck: "teacher:flashcards.deck_created",
  import: "teacher:flashcard_import.saved",
  create: "teacher:flashcards.saved",
  update: "teacher:flashcards.saved",
  delete: "teacher:flashcards.deleted",
  review: "teacher:flashcards.review_saved",
} as const;

export function useFlashcardWrites() {
  const client = useQueryClient();
  const user = useAuthStore(state => state.user?.id);
  const session = useAuthStore(state => state.sessionVersion);
  const active = useAuthStore(hasActiveSession);
  const { isPending, mutateAsync } = useMutation({ mutationFn: execute, retry: false });
  const inFlight = useRef(false);
  const ownerKey = ["teacher", user, session] as const;
  const cardsKey = [...ownerKey, flashcardsPath] as const;

  const currentOwner = () => {
    const state = useAuthStore.getState();
    return Boolean(user && state.user?.id === user && state.sessionVersion === session && hasActiveSession(state));
  };

  const write = async (intent: Intent) => {
    if (inFlight.current || !currentOwner()) return null;
    inFlight.current = true;
    try {
      const result = await mutateAsync(intent);
      if (!currentOwner()) return null;
      if (intent.kind === "delete") {
        const image = { queryKey: [...ownerKey, imageKey, intent.id] };
        await Promise.all([client.cancelQueries({ queryKey: cardsKey }), client.cancelQueries(image)]);
        if (!currentOwner()) return null;
        client.removeQueries(image);
        client.setQueriesData<FlashcardPage>({ queryKey: cardsKey }, page => {
          const current = flashcardPageSchema.safeParse(page);
          if (!current.success || !current.data.data.some(card => card.id === intent.id)) return page;
          return { ...current.data, data: current.data.data.filter(card => card.id !== intent.id) };
        });
      }
      if (intent.kind !== "review") {
        void client.invalidateQueries({ queryKey: [...ownerKey, flashcardDecksPath] });
        if (intent.kind !== "deck") void client.invalidateQueries({ queryKey: cardsKey });
      }
      sileo.success({ title: i18n.t(successKey[result.kind]) });
      return result;
    } catch (error) {
      if (!currentOwner()) return null;
      notifyHttpError(error);
      throw error;
    } finally {
      inFlight.current = false;
    }
  };

  return {
    busy: isPending || !active,
    createDeck: async (title: string, category?: string) => {
      const result = await write({ kind: "deck", title, category });
      return result?.kind === "deck" ? result.data : null;
    },
    importCards: async (batch: FlashcardImportBatch, requestKey: string) => {
      const result = await write({ kind: "import", batch, requestKey });
      return result?.kind === "import" ? result.data : null;
    },
    createCard: async (draft: FlashcardDraft, requestKey: string) => {
      const result = await write({ kind: "create", draft, requestKey });
      return result?.kind === "create" ? result.data : null;
    },
    updateCard: async (id: string, patch: FlashcardUpdate) => {
      const result = await write({ kind: "update", id, patch });
      return result?.kind === "update" ? result.data : null;
    },
    deleteCard: async (id: string) => Boolean(await write({ kind: "delete", id })),
    rateCard: async (id: string, remembered: boolean, requestKey: string) => Boolean(await write({ kind: "review", id, remembered, requestKey })),
  };
}
