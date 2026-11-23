import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import { notifyHttpError } from "../../../config/httpFeedback";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import i18n from "../../../translate";
import {
  findFlashcardGeneration, flashcardGenerationPending, readFlashcardGeneration,
  startFlashcardGeneration, type FlashcardGenerationStatus, type FlashcardGenerationTarget,
} from "./flashcardGeneration";
import type { Selection } from "./schemas";

type Generation = {
  actor: string;
  admission: FlashcardGenerationStatus | null;
  uncertainKey: string | null;
};

function actorScope(state: ReturnType<typeof useAuthStore.getState>) {
  return hasActiveSession(state) ? JSON.stringify([state.user?.id, state.sessionVersion]) : "";
}

export function useFlashcardGeneration() {
  const actor = useAuthStore(actorScope);
  const [generation, setGeneration] = useState<Generation>();
  const inFlight = useRef(false);
  const scoped = generation?.actor === actor ? generation : undefined;
  const id = scoped?.admission?.id;
  const read = useQuery({
    queryKey: ["teacher", actor, "flashcard-generation", id],
    queryFn: ({ signal }) => {
      if (!id) throw new Error("flashcard_generation_identity_missing");
      return readFlashcardGeneration(id, signal);
    },
    enabled: Boolean(actor && id),
    retry: false,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    refetchInterval: query => {
      const current = query.state.data;
      return current && !query.state.error && flashcardGenerationPending(current) ? 1500 : false;
    },
  });
  useEffect(() => { if (read.error) notifyHttpError(read.error); }, [read.error]);

  const admission = useMutation({
    mutationFn: ({ target, selection, key }: { target: FlashcardGenerationTarget; selection: Selection; key: string }) =>
      startFlashcardGeneration(target, selection, key),
    retry: false,
  });
  const recovery = useMutation({ mutationFn: findFlashcardGeneration, retry: false });

  const start = async (target: FlashcardGenerationTarget, selection: Selection) => {
    if (!actor || inFlight.current || scoped?.uncertainKey || scoped?.admission) return;
    const key = crypto.randomUUID();
    inFlight.current = true;
    try {
      const result = await admission.mutateAsync({ target, selection, key });
      if (actorScope(useAuthStore.getState()) !== actor) return;
      setGeneration({ actor, admission: result, uncertainKey: null });
      sileo.success({ title: i18n.t("teacher:flashcard_generation.requested") });
    } catch (error) {
      if (actorScope(useAuthStore.getState()) !== actor) return;
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (status === undefined || status === 408 || status >= 500) {
        setGeneration({ actor, admission: null, uncertainKey: key });
      }
      notifyHttpError(error);
    } finally {
      inFlight.current = false;
    }
  };

  const reconcile = async () => {
    if (!actor || !scoped?.uncertainKey || inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await recovery.mutateAsync(scoped.uncertainKey);
      if (actorScope(useAuthStore.getState()) !== actor) return;
      setGeneration({ actor, admission: result, uncertainKey: null });
      sileo.success({ title: i18n.t("teacher:flashcard_generation.recovered") });
    } catch (error) {
      if (actorScope(useAuthStore.getState()) === actor) notifyHttpError(error);
    } finally {
      inFlight.current = false;
    }
  };

  const current = read.data ?? scoped?.admission ?? null;
  return {
    current,
    disabled: !actor || admission.isPending || recovery.isPending,
    uncertain: Boolean(scoped?.uncertainKey),
    readFailed: read.isError,
    checking: read.isFetching,
    start,
    reconcile,
    refresh: read.refetch,
  };
}
