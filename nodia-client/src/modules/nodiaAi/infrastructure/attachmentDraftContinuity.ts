import useAuthStore from "../../../store/authStore";
import type { NodiaAiAttachment } from "./attachmentSchemas";
import type { NodiaAiAdmitInput } from "./types";

export interface AttachmentDraft {
  localId: string; clientRequestId: string; file: File; attachment: NodiaAiAttachment | null;
  text: string; textDirty?: boolean; progress: number | null; busy: boolean; uncertain: boolean; error: string | null;
}
export interface AttachmentAdmission {
  readonly input: NodiaAiAdmitInput;
  readonly text: string;
  readonly status: "in_flight" | "uncertain" | "rejected";
  readonly token: symbol;
}
interface Snapshot {
  readonly owner: string | null;
  readonly chats: Readonly<Record<string, AttachmentDraft[]>>;
  readonly admissions: Readonly<Record<string, AttachmentAdmission>>;
  readonly upload: symbol | null;
}
const empty: Snapshot = { owner: null, chats: {}, admissions: {}, upload: null };
export const emptyAttachmentEntries: AttachmentDraft[] = [];

/** Tab-local references only: no File reconstruction, browser storage, or automatic requests. */
export function createAttachmentDraftContinuity() {
  let snapshot = empty;
  const listeners = new Set<() => void>();
  const publish = (next: Snapshot) => { snapshot = next; listeners.forEach(listener => listener()); };
  const owns = (owner: string) => snapshot.owner === owner;
  const update = (owner: string, chatId: string, change: (entries: AttachmentDraft[]) => AttachmentDraft[]) => {
    if (owns(owner)) publish({ ...snapshot, chats: { ...snapshot.chats, [chatId]: change(snapshot.chats[chatId] ?? emptyAttachmentEntries) } });
  };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    owns,
    setOwner(owner: string | null) {
      if (owner !== snapshot.owner) publish({ ...empty, owner });
    },
    update,
    acquireUpload(owner: string) {
      if (!owns(owner) || snapshot.upload || Object.values(snapshot.admissions).some(entry => entry.status === "in_flight")) return null;
      const token = Symbol("attachment-operation");
      publish({ ...snapshot, upload: token });
      return () => { if (owns(owner) && snapshot.upload === token) publish({ ...snapshot, upload: null }); };
    },
    reserveAdmission(owner: string, chatId: string, input: NodiaAiAdmitInput, text: string) {
      if (!owns(owner) || snapshot.upload || Object.values(snapshot.admissions).some(entry => entry.status === "in_flight")) return null;
      const previous = snapshot.admissions[chatId];
      const entry: AttachmentAdmission = {
        input: previous?.status === "uncertain" ? previous.input : input,
        text: previous?.status === "uncertain" ? previous.text : text,
        status: "in_flight", token: Symbol("message-admission"),
      };
      publish({ ...snapshot, admissions: { ...snapshot.admissions, [chatId]: entry } });
      return entry;
    },
    settleAdmission(owner: string, chatId: string, entry: AttachmentAdmission, outcome: "accepted" | "rejected" | "uncertain") {
      if (!owns(owner) || snapshot.admissions[chatId]?.token !== entry.token) return;
      const admissions = { ...snapshot.admissions };
      const chats = { ...snapshot.chats };
      if (outcome === "accepted") { delete admissions[chatId]; delete chats[chatId]; }
      else admissions[chatId] = { ...entry, status: outcome };
      publish({ ...snapshot, chats, admissions });
    },
    dismissRejectedAdmission(owner: string, chatId: string) {
      if (!owns(owner) || snapshot.admissions[chatId]?.status !== "rejected") return;
      const admissions = { ...snapshot.admissions }; delete admissions[chatId];
      publish({ ...snapshot, admissions });
    },
  };
}

export const attachmentDraftContinuity = createAttachmentDraftContinuity();
export const attachmentDraftOwner = (state: Pick<ReturnType<typeof useAuthStore.getState>, "user" | "token" | "sessionVersion" | "sessionStatus">) =>
  state.user?.id && state.token && state.sessionStatus !== "anonymous" ? JSON.stringify([state.user.id, state.sessionVersion]) : null;
attachmentDraftContinuity.setOwner(attachmentDraftOwner(useAuthStore.getState()));
// Like text drafts, invalidation also runs while the lazy route is unmounted.
const unsubscribeAuth = useAuthStore.subscribe(next => attachmentDraftContinuity.setOwner(attachmentDraftOwner(next)));
if (import.meta.hot) import.meta.hot.dispose(unsubscribeAuth);
