import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import useAuthStore from "../../../store/authStore";
import { createConversationDrafts } from "./conversationDrafts";
import type { NodiaAiConversation } from "./types";
import { NODIA_AI_MESSAGE_TEXT_BYTES } from "./schemas";

const drafts = createConversationDrafts(() => typeof window === "undefined" ? null : window.sessionStorage, NODIA_AI_MESSAGE_TEXT_BYTES);
// Also runs while the page is unmounted: returning to a prior account cannot
// recover its former draft after logout/account change.
const unsubscribeAuth = useAuthStore.subscribe((next, previous) => {
  if (previous.user?.id && (next.user?.id !== previous.user.id || next.sessionStatus === "anonymous")) drafts.clear();
});
if (import.meta.hot) import.meta.hot.dispose(unsubscribeAuth);

export function useConversationDraft(conversation: NodiaAiConversation | undefined, rejectedId: string | null, authorized: boolean) {
  const actorId = useAuthStore(state => state.user?.id ?? null);
  const authenticated = useAuthStore(state => state.sessionStatus === "authenticated");
  const [submitting, setSubmitting] = useState<Record<string, { actorId: string; text: string }>>({});
  const submittingRef = useRef(submitting);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const writable = authenticated && authorized && conversation && !conversation.read_only ? conversation : undefined;
  const scope = actorId && writable ? { actorId, conversationId: writable.conversation_id } : null;
  const stored = useSyncExternalStore(drafts.subscribe, () => scope ? drafts.get(scope, writable?.expires_at) : "", () => "");
  const id = writable?.conversation_id;
  const expiresAt = writable?.expires_at;
  const validDeadline = useSyncExternalStore(drafts.subscribe, () => !!expiresAt && drafts.hasTimeRemaining(expiresAt), () => false);
  const text = !validDeadline ? "" : id && submitting[id]?.actorId === actorId ? submitting[id].text : stored;

  useEffect(() => {
    const deniedId = rejectedId ?? (conversation?.read_only ? conversation.conversation_id : null);
    if (actorId && deniedId) drafts.remove({ actorId, conversationId: deniedId });
  }, [actorId, conversation?.conversation_id, conversation?.read_only, rejectedId]);

  useEffect(() => {
    if (!actorId || !id || !expiresAt) return;
    const conversationId = id, expiry = Date.parse(expiresAt);
    if (!Number.isFinite(expiry)) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const remaining = expiry - Date.now();
      if (remaining <= 0) { drafts.remove({ actorId, conversationId }); drafts.prune(); }
      else timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [actorId, id, expiresAt]);

  useEffect(() => {
    drafts.prune();
    const resume = () => { if (document.visibilityState === "visible") drafts.prune(); };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  const updateSubmitting = (conversationId: string, value?: string) => {
    const next = { ...submittingRef.current };
    if (value === undefined || !actorId) delete next[conversationId]; else next[conversationId] = { actorId, text: value };
    submittingRef.current = next;
    setSubmitting(next);
  };
  return {
    text,
    setText(value: string) {
      if (scope && writable && useAuthStore.getState().user?.id === actorId) drafts.set(scope, value, writable.expires_at);
    },
    beginSubmission() {
      if (!scope || !id || useAuthStore.getState().user?.id !== actorId) return;
      updateSubmitting(id, text);
      // A restored draft must never replay an admitted/uncertain intention with
      // a new client_message_id after a page remount.
      drafts.remove(scope);
    },
    finishSubmission(conversationId: string, outcome: "accepted" | "rejected" | "uncertain", expiresAt: string) {
      if (!mounted.current || useAuthStore.getState().user?.id !== actorId || !actorId) return;
      if (outcome === "uncertain") return; // Current instance keeps the explicit recovery flow only.
      if (outcome === "rejected") drafts.set({ actorId, conversationId }, submittingRef.current[conversationId]?.text ?? "", expiresAt);
      updateSubmitting(conversationId);
    },
  };
}
