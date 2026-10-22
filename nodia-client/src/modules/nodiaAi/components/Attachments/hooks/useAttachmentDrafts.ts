import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sileo } from "sileo";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../../hooks/useAuth";
import { notifyHttpError } from "../../../../../config/httpFeedback";
import { attachmentKind, validateAttachmentFiles, type NodiaAiAttachment, type NodiaAiAttachmentPart } from "../../../infrastructure/attachmentSchemas";
import { createAttachment, deleteAttachment, getAttachment, getAttachmentCapabilities, reviewAttachment, uploadAttachment } from "../../../infrastructure/attachmentServices";

export interface AttachmentDraft {
  localId: string; clientRequestId: string; file: File; attachment: NodiaAiAttachment | null;
  text: string; textDirty?: boolean; progress: number | null; busy: boolean; uncertain: boolean; error: string | null;
}
export function useAttachmentCapabilities(chatId: string | null, revision?: number, enabled = true) {
  const { user, sessionVersion } = useAuth();
  return useQuery({ queryKey: ["nodia-ai", user?.id, sessionVersion, "attachment-capabilities", chatId, revision], queryFn: ({ signal }) => getAttachmentCapabilities(chatId!, signal), enabled: enabled && chatId !== null, retry: false, staleTime: 0, gcTime: 0 });
}
export function useAttachmentDrafts(chatId: string | null, revision?: number) {
  const { t } = useTranslation("nodiaAi");
  const { user, sessionVersion } = useAuth();
  const [all, setAll] = useState<Record<string, AttachmentDraft[]>>({});
  const current = useRef(all);
  const mounted = useRef(true);
  const locks = useRef(new Set<string>());
  const scope = `${user?.id}:${sessionVersion}`;
  const liveScope = useRef(scope);
  useEffect(() => { liveScope.current = scope; }, [scope]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const update = (id: string, change: (entries: AttachmentDraft[]) => AttachmentDraft[]) => {
    if (!mounted.current) return;
    const next = { ...current.current, [id]: change(current.current[id] ?? []) };
    current.current = next;
    setAll(next);
  };
  const write = useMutation({ mutationFn: async (operation: () => Promise<void>) => operation(), retry: false });
  const entries = chatId ? (all[chatId] ?? []) : [];
  const capabilities = useAttachmentCapabilities(chatId, revision, entries.length > 0);
  const busy = write.isPending || entries.some(entry => entry.busy);
  const add = (files: readonly File[]) => {
    if (!chatId || !files.length) return;
    const error = validateAttachmentFiles(files, (current.current[chatId] ?? []).map(entry => entry.file), capabilities.data?.limits);
    if (error) { sileo.error({ title: t(`attachments.${error}`) }); return; }
    update(chatId, previous => [...previous, ...files.map(file => ({ localId: crypto.randomUUID(), clientRequestId: crypto.randomUUID(), file, attachment: null, text: "", progress: null, busy: false, uncertain: false, error: null }))]);
    sileo.success({ title: t("attachments.selected") });
  };
  const run = async (localId: string, action: "upload" | "review" | "remove") => {
    // One reserved upload per owner: finish or reconcile this operation before another intent.
    if (!chatId || locks.current.size > 0) return;
    const id = chatId;
    const entry = current.current[id]?.find(item => item.localId === localId);
    if (!entry) return;
    if (action === "review" && (!entry.attachment || entry.attachment.state !== "ready" || !entry.text.trim())) return;
    const expectedScope = scope;
    const valid = () => mounted.current && liveScope.current === expectedScope;
    const patch = (values: Partial<AttachmentDraft>) => { if (valid()) update(id, previous => previous.map(item => item.localId === localId ? { ...item, ...values } : item)); };
    locks.current.add(localId);
    patch({ busy: true, error: null });
    try {
      await write.mutateAsync(async () => {
        if (action === "remove") {
          if (entry.attachment) await deleteAttachment(entry.attachment.attachment_id);
          if (valid()) update(id, previous => previous.filter(item => item.localId !== localId));
          return;
        }
        let attachment = entry.attachment;
        if (action === "review") {
          if (!attachment || attachment.state !== "ready" || !entry.text.trim()) return;
          attachment = await reviewAttachment(attachment.attachment_id, id, entry.text, attachment.interpretation?.revision ?? 0);
          patch({ attachment, textDirty: false, ...(entry.text === "" && attachment.interpretation ? { text: attachment.interpretation.text } : {}) });
          return;
        }
        if (attachment) {
          attachment = await getAttachment(attachment.attachment_id, id);
          patch({ attachment, ...(entry.text === "" && attachment.interpretation ? { text: attachment.interpretation.text } : {}) });
          if (attachment.state === "ready") { patch({ uncertain: false, progress: 100 }); return; }
          if (entry.uncertain) { patch({ error: "upload_uncertain" }); return; }
        } else {
          const kind = attachmentKind(entry.file);
          if (!kind) throw new Error("nodia_ai:invalid_input");
          const intent = await createAttachment({ conversation_id: id, client_request_id: entry.clientRequestId, kind, byte_count: entry.file.size, file_name: entry.file.name });
          attachment = intent.attachment;
          patch({ attachment, ...(entry.text === "" && attachment.interpretation ? { text: attachment.interpretation.text } : {}) });
          if (attachment.state === "ready") { patch({ uncertain: false, progress: 100 }); return; }
        }
        if (!valid()) return;
        patch({ uncertain: true });
        attachment = await uploadAttachment(attachment.attachment_id, id, entry.file, progress => patch({ progress }));
        patch({ attachment, uncertain: false, progress: 100, ...(entry.text === "" && attachment.interpretation ? { text: attachment.interpretation.text } : {}) });
      });
      if (valid()) sileo.success({ title: t(`attachments.${action === "remove" ? "removed" : action === "review" ? "review_saved" : "status_checked"}`) });
    } catch (error) {
      if (valid()) { patch({ error: action === "upload" ? "upload_error" : "action_error" }); notifyHttpError(error); }
    } finally { locks.current.delete(localId); patch({ busy: false }); }
  };
  const parts: NodiaAiAttachmentPart[] = entries.flatMap(entry => entry.attachment?.state === "ready" && !entry.textDirty && (entry.attachment.interpretation?.reviewed === true && entry.attachment.interpretation.text === entry.text || !capabilities.isFetching && !capabilities.isError && !!entry.attachment.media_type && capabilities.data?.native_media_types?.some(mime => mime === entry.attachment!.media_type))
    ? [{ kind: entry.attachment.kind, attachment_id: entry.attachment.attachment_id }] : []);
  return {
    entries, busy, parts, ready: entries.length === parts.length,
    reviewedTextBytes: entries.reduce((total, entry) => total + (entry.attachment?.interpretation?.reviewed ? new TextEncoder().encode(entry.attachment.interpretation.text).length : 0), 0),
    add, upload: (id: string) => run(id, "upload"), review: (id: string) => run(id, "review"), remove: (id: string) => run(id, "remove"),
    edit: (localId: string, text: string) => { if (chatId) update(chatId, previous => previous.map(item => item.localId === localId ? { ...item, text, textDirty: text !== (item.attachment?.interpretation?.text ?? "") } : item)); },
    resetReview: (localId: string) => {
      if (!chatId) return;
      update(chatId, previous => previous.map(item => item.localId === localId ? { ...item, text: item.attachment?.interpretation?.text ?? "", textDirty: false } : item));
      sileo.success({ title: t("attachments.edit_discarded") });
    },
    clear: (id: string) => update(id, () => []),
  };
}
