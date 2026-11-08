import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sileo } from "sileo";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../../hooks/useAuth";
import { notifyHttpError } from "../../../../../config/httpFeedback";
import { attachmentKind, validateAttachmentFiles, type NodiaAiAttachmentPart } from "../../../infrastructure/attachmentSchemas";
import { createAttachment, deleteAttachment, getAttachment, getAttachmentCapabilities, reviewAttachment, uploadAttachment } from "../../../infrastructure/attachmentServices";
import { attachmentDraftContinuity, emptyAttachmentEntries, type AttachmentAdmission, type AttachmentDraft } from "../../../infrastructure/attachmentDraftContinuity";
import type { NodiaAiAdmitInput, NodiaAiInvoiceOcrEligibility } from "../../../infrastructure/types";

export type { AttachmentDraft } from "../../../infrastructure/attachmentDraftContinuity";
export function useAttachmentCapabilities(chatId: string | null, revision?: number, enabled = true) {
  const { user, sessionVersion } = useAuth();
  return useQuery({ queryKey: ["nodia-ai", user?.id, sessionVersion, "attachment-capabilities", chatId, revision], queryFn: ({ signal }) => getAttachmentCapabilities(chatId!, signal), enabled: enabled && chatId !== null, retry: false, staleTime: 0, gcTime: 0 });
}
export function isInvoiceOcrReference(entry: AttachmentDraft, invoiceOcr?: NodiaAiInvoiceOcrEligibility | null): boolean {
  const attachment = entry.attachment;
  return !!invoiceOcr && attachment?.state === "ready" && !entry.textDirty && attachment.interpretation?.reviewed !== true &&
    (attachment.kind === "image" || attachment.kind === "pdf") &&
    attachment.byte_count !== null && attachment.byte_count > 0 && attachment.byte_count <= invoiceOcr.file_bytes &&
    entry.file.size > 0 && entry.file.size <= invoiceOcr.file_bytes && !!attachment.media_type &&
    (attachment.kind === "pdf" ? attachment.media_type === "application/pdf" : attachment.media_type.startsWith("image/")) &&
    invoiceOcr.media_types.some(mime => mime === attachment.media_type);
}
export function useAttachmentDrafts(chatId: string | null, revision?: number, invoiceOcr?: NodiaAiInvoiceOcrEligibility | null, { autoUpload = false }: { autoUpload?: boolean } = {}) {
  const { t } = useTranslation("nodiaAi");
  const { user, sessionVersion } = useAuth();
  const snapshot = useSyncExternalStore(attachmentDraftContinuity.subscribe, attachmentDraftContinuity.getSnapshot, attachmentDraftContinuity.getSnapshot);
  const [capabilityIntent, setCapabilityIntent] = useState<string | null>(null);
  const mounted = useRef(true);
  const scope = JSON.stringify([user?.id, sessionVersion]);
  const liveScope = useRef(scope);
  const liveChat = useRef(chatId);
  const policyEpoch = JSON.stringify([scope, chatId, revision ?? null]);
  const livePolicyEpoch = useRef(policyEpoch);
  const refreshingCapabilities = useRef(false);
  useEffect(() => { liveScope.current = scope; }, [scope]);
  useEffect(() => { liveChat.current = chatId; }, [chatId]);
  useLayoutEffect(() => { livePolicyEpoch.current = policyEpoch; }, [policyEpoch]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const update = (id: string, change: (entries: AttachmentDraft[]) => AttachmentDraft[]) => {
    attachmentDraftContinuity.update(scope, id, change);
  };
  const write = useMutation({ mutationFn: async (operation: () => Promise<void>) => operation(), retry: false });
  const entries = snapshot.owner === scope && chatId ? (snapshot.chats[chatId] ?? emptyAttachmentEntries) : emptyAttachmentEntries;
  const admission = snapshot.owner === scope && chatId ? snapshot.admissions[chatId] : undefined;
  const admissionInFlight = snapshot.owner === scope && Object.values(snapshot.admissions).some(entry => entry.status === "in_flight");
  const capabilities = useAttachmentCapabilities(chatId, revision, entries.length > 0 || capabilityIntent === chatId);
  const enableCapabilities = useCallback(() => { if (chatId) setCapabilityIntent(chatId); }, [chatId]);
  const busy = write.isPending || capabilities.isFetching || (snapshot.owner === scope && snapshot.upload !== null) || admissionInFlight || entries.some(entry => entry.busy);
  const refreshCapabilities = async () => {
    if (!chatId || !attachmentDraftContinuity.owns(scope) || busy || capabilities.isFetching || refreshingCapabilities.current) return;
    const id = chatId, expectedScope = scope, expectedPolicyEpoch = policyEpoch;
    refreshingCapabilities.current = true;
    try {
      const result = await capabilities.refetch({ cancelRefetch: false });
      if (!mounted.current || !attachmentDraftContinuity.owns(expectedScope) || liveScope.current !== expectedScope || liveChat.current !== id || livePolicyEpoch.current !== expectedPolicyEpoch) return;
      if (result.isError) notifyHttpError(result.error);
      else if (result.isSuccess && !result.isFetching) sileo.success({ title: t("attachments.capabilities_refreshed") });
    } finally { refreshingCapabilities.current = false; }
  };
  const add = (files: readonly File[]) => {
    if (!chatId || !attachmentDraftContinuity.owns(scope) || !files.length) return;
    const error = validateAttachmentFiles(files, (attachmentDraftContinuity.getSnapshot().chats[chatId] ?? []).map(entry => entry.file), capabilities.data?.limits);
    if (error) { sileo.error({ title: t(`attachments.${error}`) }); return; }
    update(chatId, previous => [...previous, ...files.map(file => ({ localId: crypto.randomUUID(), clientRequestId: crypto.randomUUID(), file, attachment: null, text: "", progress: null, busy: false, uncertain: false, error: null }))]);
    sileo.success({ title: t("attachments.selected") });
  };
  const run = async (localId: string, action: "upload" | "review" | "remove") => {
    // One reserved upload per owner: finish or reconcile this operation before another intent.
    if (!chatId || !attachmentDraftContinuity.owns(scope)) return;
    const id = chatId;
    const entry = attachmentDraftContinuity.getSnapshot().chats[id]?.find(item => item.localId === localId);
    if (!entry) return;
    if (action === "review" && (!entry.attachment || entry.attachment.state !== "ready" || !entry.text.trim())) return;
    const expectedScope = scope;
    const valid = () => attachmentDraftContinuity.owns(expectedScope);
    const patch = (values: Partial<AttachmentDraft>) => { if (valid()) update(id, previous => previous.map(item => item.localId === localId ? { ...item, ...values } : item)); };
    const release = attachmentDraftContinuity.acquireUpload(expectedScope);
    if (!release) return;
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
    } finally { release(); patch({ busy: false }); }
  };
  const policyReady = !!capabilities.data && !capabilities.isFetching && !capabilities.isError;
  const uploadNext = useEffectEvent(() => {
    // Only a never-attempted local file is eligible. Failed/uncertain writes
    // require explicit recovery with the original request identity.
    const next = entries.find(entry => !entry.attachment && !entry.busy && !entry.uncertain && entry.error === null);
    if (!next || !capabilities.data) return;
    const error = validateAttachmentFiles([next.file], entries.filter(entry => entry.localId !== next.localId).map(entry => entry.file), capabilities.data.limits);
    if (error) {
      if (chatId) update(chatId, previous => previous.map(entry => entry.localId === next.localId ? { ...entry, error } : entry));
      sileo.error({ title: t(`attachments.${error}`) });
      return;
    }
    void run(next.localId, "upload");
  });
  useEffect(() => {
    if (autoUpload && chatId && attachmentDraftContinuity.owns(scope) && policyReady && !busy) uploadNext();
  }, [autoUpload, busy, chatId, entries, policyReady, scope]);
  const invoiceOcrReference = policyReady ? invoiceOcr : null;
  const parts: NodiaAiAttachmentPart[] = entries.flatMap(entry => entry.attachment?.state === "ready" && !entry.textDirty && (entry.attachment.interpretation?.reviewed === true && entry.attachment.interpretation.text === entry.text || policyReady && !!entry.attachment.media_type && capabilities.data?.native_media_types?.some(mime => mime === entry.attachment!.media_type) || isInvoiceOcrReference(entry, invoiceOcrReference))
    ? [{ kind: entry.attachment.kind, attachment_id: entry.attachment.attachment_id }] : []);
  return {
    capabilities: { data: capabilities.data, isFetching: capabilities.isFetching, isError: capabilities.isError },
    ...(invoiceOcrReference ? { invoiceOcr: invoiceOcrReference } : {}),
    enableCapabilities, refreshCapabilities,
    entries, busy, parts, ready: entries.length === parts.length,
    admission, admissionInFlight,
    reserveAdmission: (input: NodiaAiAdmitInput, text: string) => chatId ? attachmentDraftContinuity.reserveAdmission(scope, chatId, input, text) : null,
    settleAdmission: (id: string, entry: AttachmentAdmission, outcome: "accepted" | "rejected" | "uncertain") => attachmentDraftContinuity.settleAdmission(scope, id, entry, outcome),
    dismissRejectedAdmission: () => { if (chatId) attachmentDraftContinuity.dismissRejectedAdmission(scope, chatId); },
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
