import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import { notifyHttpError } from "../../../config/httpFeedback";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import i18n from "../../../translate";
import {
  findFlashcardProposal, flashcardProposalPending, readFlashcardProposal, readFlashcardProposalImage,
  startFlashcardProposal, type FlashcardProposalIntent,
} from "./flashcardLibraryProposal";

type Admission = { actor: string } & ({ id: string; uncertainKey?: never } | { id?: never; uncertainKey: string });
const proposalKey = (actor: string, id?: string) => ["teacher", actor, "flashcard-library-proposal", id];
const actorScope = (state: ReturnType<typeof useAuthStore.getState>) =>
  hasActiveSession(state) ? JSON.stringify([state.user?.id, state.sessionVersion]) : "";

export function useFlashcardLibraryProposal() {
  const actor = useAuthStore(actorScope);
  const client = useQueryClient();
  const [admission, setAdmission] = useState<Admission>();
  const [expiredId, setExpiredId] = useState<string>();
  const inFlight = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const scoped = admission?.actor === actor ? admission : undefined;
  const id = scoped?.id;
  const expired = Boolean(id && id === expiredId);
  const currentActor = () => mounted.current && actorScope(useAuthStore.getState()) === actor;

  const status = useQuery({
    queryKey: proposalKey(actor, id),
    queryFn: ({ signal }) => {
      if (!id) throw new Error("flashcard_proposal_identity_missing");
      return readFlashcardProposal(id, signal);
    },
    enabled: Boolean(actor && id && !expired),
    retry: false,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    gcTime: 0,
    refetchInterval: query => {
      const current = query.state.data;
      return current && !query.state.error && flashcardProposalPending(current) ? 1500 : false;
    },
  });
  const image = useQuery({
    queryKey: [...proposalKey(actor, id), "image"],
    queryFn: ({ signal }) => {
      if (!id) throw new Error("flashcard_proposal_identity_missing");
      return readFlashcardProposalImage(id, signal);
    },
    enabled: Boolean(actor && id && !expired && !status.isError && status.data?.image.state === "ready"),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!id || !status.data?.expires_at) return;
    const timer = window.setTimeout(() => setExpiredId(id), Math.max(0, Date.parse(status.data.expires_at) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [id, status.data?.expires_at]);
  useEffect(() => { if (status.error) notifyHttpError(status.error); }, [status.error]);
  useEffect(() => { if (image.error) notifyHttpError(image.error); }, [image.error]);

  const submit = useMutation({
    mutationFn: ({ intent, key }: { intent: FlashcardProposalIntent; key: string }) => startFlashcardProposal(intent, key),
    retry: false, networkMode: "always", gcTime: 0,
  });
  const recovery = useMutation({ mutationFn: findFlashcardProposal, retry: false, networkMode: "always", gcTime: 0 });

  const start = async (intent: FlashcardProposalIntent) => {
    if (!actor || inFlight.current || scoped) return;
    const key = crypto.randomUUID();
    inFlight.current = true;
    try {
      const result = await submit.mutateAsync({ intent, key });
      if (!currentActor()) return;
      setAdmission({ actor, id: result.id });
      sileo.success({ title: i18n.t("teacher:flashcard_generation.requested") });
    } catch (error) {
      if (!currentActor()) return;
      const code = isAxiosError(error) ? error.response?.status : undefined;
      if (code === undefined || code === 408 || code >= 500) setAdmission({ actor, uncertainKey: key });
      notifyHttpError(error);
    } finally {
      inFlight.current = false;
      submit.reset();
    }
  };

  const reconcile = async () => {
    if (!actor || !scoped?.uncertainKey || inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await recovery.mutateAsync(scoped.uncertainKey);
      if (!currentActor()) return;
      client.setQueryData(proposalKey(actor, result.id), result);
      setAdmission({ actor, id: result.id });
      sileo.success({ title: i18n.t("teacher:flashcard_generation.recovered") });
    } catch (error) {
      if (currentActor()) notifyHttpError(error);
    } finally {
      inFlight.current = false;
      recovery.reset();
    }
  };

  return { status, image, started: Boolean(id), expired, uncertain: Boolean(scoped?.uncertainKey),
    submitting: submit.isPending || recovery.isPending, authenticated: Boolean(actor), start, reconcile,
    reset: () => { if (!inFlight.current && !scoped?.uncertainKey) setAdmission(undefined); },
  };
}
