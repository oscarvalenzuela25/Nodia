import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import { notifyHttpError } from "../../../config/httpFeedback";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import i18n from "../../../translate";
import { useTeacherQuery } from "./useServices";
import type { FlashcardImportBatch } from "./flashcardImport";
import {
  flashcardDecksSchema, flashcardPageSchema, flashcardSetsSchema,
  type Flashcard, type FlashcardDeckFields, type FlashcardDraft, type FlashcardPage, type FlashcardUpdate,
} from "./flashcards";
import {
  createFlashcard, createFlashcardDeck, createFlashcardSet, deleteFlashcard, deleteFlashcardCollection, flashcardDecksPath, flashcardSetsPath,
  flashcardsPath, importFlashcards, readFlashcardImage, recordFlashcardReview, updateFlashcard, updateFlashcardDeck,
} from "./flashcardServices";

const imageKey = "flashcards/image";

export const useFlashcardDecks = (enabled = true) =>
  useTeacherQuery(flashcardDecksPath, flashcardDecksSchema, undefined, enabled);

export const useFlashcardSets = (enabled = true) =>
  useTeacherQuery(flashcardSetsPath, flashcardSetsSchema, undefined, enabled);

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
  | { kind: "deck"; fields: FlashcardDeckFields }
  | { kind: "edit-deck"; id: string; fields: FlashcardDeckFields }
  | { kind: "set"; title: string }
  | { kind: "delete-deck" | "delete-set"; id: string }
  | { kind: "import"; batch: FlashcardImportBatch; requestKey: string }
  | { kind: "create"; draft: FlashcardDraft; requestKey: string }
  | { kind: "update"; id: string; patch: FlashcardUpdate }
  | { kind: "delete"; id: string }
  | { kind: "review"; id: string; remembered: boolean; requestKey: string };

async function execute(intent: Intent) {
  switch (intent.kind) {
    case "deck": return { kind: intent.kind, data: await createFlashcardDeck(intent.fields) } as const;
    case "edit-deck": return { kind: intent.kind, data: await updateFlashcardDeck(intent.id, intent.fields) } as const;
    case "set": return { kind: intent.kind, data: await createFlashcardSet(intent.title) } as const;
    case "delete-deck":
    case "delete-set":
      await deleteFlashcardCollection(intent.kind === "delete-deck" ? "decks" : "sets", intent.id);
      return { kind: intent.kind, id: intent.id } as const;
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
  "edit-deck": "teacher:flashcard_sets.deck_saved",
  set: "teacher:flashcard_sets.set_created",
  "delete-deck": "teacher:flashcard_sets.deck_deleted",
  "delete-set": "teacher:flashcard_sets.set_deleted",
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
  const decksKey = [...ownerKey, flashcardDecksPath, undefined] as const;
  const setsKey = [...ownerKey, flashcardSetsPath, undefined] as const;

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
      if (result.kind === "deck" || result.kind === "edit-deck" || result.kind === "set" ||
        result.kind === "delete-deck" || result.kind === "delete-set") {
        await Promise.all([client.cancelQueries({ queryKey: decksKey }), client.cancelQueries({ queryKey: setsKey })]);
        if (!currentOwner()) return null;
        client.setQueryData(decksKey, (previous: unknown) => {
          const cached = flashcardDecksSchema.safeParse(previous);
          if (!cached.success) return previous;
          if (result.kind === "deck" || result.kind === "edit-deck") {
            return [...cached.data.filter(deck => deck.id !== result.data.id), result.data];
          }
          if (result.kind === "delete-deck") return cached.data.filter(deck => deck.id !== result.id);
          if (result.kind === "delete-set") return cached.data.map(deck => deck.set_id === result.id ? { ...deck, set_id: null } : deck);
          return previous;
        });
        client.setQueryData(setsKey, (previous: unknown) => {
          const cached = flashcardSetsSchema.safeParse(previous);
          if (!cached.success) return previous;
          if (result.kind === "set") return [...cached.data.filter(set => set.id !== result.data.id), result.data];
          if (result.kind === "delete-set") return cached.data.filter(set => set.id !== result.id);
          return previous;
        });
        if (result.kind === "delete-deck") {
          const queryKey = [...cardsKey, { deck_id: result.id }] as const;
          const matchingPages = client.getQueriesData({ queryKey });
          client.removeQueries({ queryKey });
          for (const [, value] of matchingPages) {
            const page = flashcardPageSchema.safeParse(value);
            if (!page.success) continue;
            for (const card of page.data.data) client.removeQueries({ queryKey: [...ownerKey, imageKey, card.id] });
          }
        }
        void client.invalidateQueries({ queryKey: setsKey });
      }
      if (result.kind !== "review" && result.kind !== "set") void client.invalidateQueries({ queryKey: decksKey });
      if (result.kind === "import" || result.kind === "create" || result.kind === "update" || result.kind === "delete") {
        void client.invalidateQueries({ queryKey: cardsKey });
        if (result.kind === "import") void client.invalidateQueries({ queryKey: setsKey });
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
    createDeck: async (fields: FlashcardDeckFields) => {
      const result = await write({ kind: "deck", fields });
      return result?.kind === "deck" ? result.data : null;
    },
    updateDeck: async (id: string, fields: FlashcardDeckFields) => {
      const result = await write({ kind: "edit-deck", id, fields });
      return result?.kind === "edit-deck" ? result.data : null;
    },
    createSet: async (title: string) => {
      const result = await write({ kind: "set", title });
      return result?.kind === "set" ? result.data : null;
    },
    deleteDeck: async (id: string) => Boolean(await write({ kind: "delete-deck", id })),
    deleteSet: async (id: string) => Boolean(await write({ kind: "delete-set", id })),
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
