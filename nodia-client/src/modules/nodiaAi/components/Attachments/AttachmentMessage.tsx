import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, LinearProgress, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../hooks/useAuth";
import { notifyHttpError } from "../../../../config/httpFeedback";
import { downloadAttachment, getAttachment } from "../../infrastructure/attachmentServices";
import { AttachmentCard } from "./styles";
import AudioPreview from "../AudioPreview";

function AttachmentPreview({ blob, name }: { blob: Blob; name: string }) {
  const image = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const element = image.current;
    const url = URL.createObjectURL(blob);
    if (element) element.src = url;
    return () => { URL.revokeObjectURL(url); element?.removeAttribute("src"); };
  }, [blob]);
  return <Box component="img" ref={image} alt={name}
    sx={{ display: "block", maxWidth: "100%", width: "auto", height: "auto", maxHeight: 360, mt: 1, borderRadius: 1, objectFit: "contain" }} />;
}

/** Fetch private metadata and bytes only after explicit intent, with current server authorization. */
export default function AttachmentMessage({ id, conversationId, kind }: { id: string; conversationId: string; kind: "image" | "pdf" | "audio" }) {
  const { t } = useTranslation("nodiaAi");
  const { user, sessionVersion } = useAuth();
  const scope = JSON.stringify([user?.id, sessionVersion, conversationId, id, kind]);
  const [openedScope, setOpenedScope] = useState<string | null>(null);
  const [downloadScope, setDownloadScope] = useState<string | null>(null);
  const currentScope = useRef<string | null>(scope);
  const downloads = useRef(new Map<string, AbortController>());
  const downloadUrls = useRef(new Map<string, Set<string>>());
  const open = openedScope === scope;
  const downloading = downloadScope === scope;
  useLayoutEffect(() => {
    currentScope.current = scope;
    return () => { currentScope.current = null; };
  }, [scope]);
  useEffect(() => {
    const controllers = downloads.current;
    const urls = downloadUrls.current;
    return () => {
      controllers.get(scope)?.abort();
      controllers.delete(scope);
      urls.get(scope)?.forEach(url => URL.revokeObjectURL(url));
      urls.get(scope)?.clear();
      urls.delete(scope);
    };
  }, [scope]);
  const metadata = useQuery({
    queryKey: ["nodia-ai", user?.id, sessionVersion, "attachment", conversationId, id, kind],
    queryFn: async ({ signal }) => {
      try {
        const attachment = await getAttachment(id, conversationId, signal);
        if (attachment.kind !== kind) throw new Error("nodia_ai:invalid_response");
        let preview: Blob | null = null;
        const previewable = kind === "image"
          ? ["image/png", "image/jpeg", "image/webp"].includes(attachment.media_type ?? "")
          : kind === "audio" && /^audio\/(webm|ogg|mpeg|mp4|wav)$/.test(attachment.media_type ?? "");
        if (attachment.state === "ready" && previewable) {
          const blob = await downloadAttachment(id, signal);
          const mime = blob.type.split(";", 1)[0].trim().toLowerCase();
          if (mime !== attachment.media_type || blob.size === 0 || blob.size > 20 * 1024 * 1024 ||
            (attachment.byte_count !== null && blob.size !== attachment.byte_count))
            throw new Error("nodia_ai:invalid_response");
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          preview = blob;
        }
        return { attachment, preview };
      } catch (error) {
        if (!signal.aborted) notifyHttpError(error);
        throw error;
      }
    }, enabled: open, retry: false, staleTime: 0, gcTime: 0,
  });
  useEffect(() => {
    if (metadata.isError) {
      downloads.current.get(scope)?.abort();
      downloadUrls.current.get(scope)?.forEach(url => URL.revokeObjectURL(url));
      downloadUrls.current.get(scope)?.clear();
      downloadUrls.current.delete(scope);
    }
  }, [metadata.isError, scope]);
  const download = async () => {
    if (!metadata.data || metadata.isFetching || metadata.isError || downloading || downloads.current.has(scope)) return;
    setDownloadScope(scope);
    const controller = new AbortController();
    downloads.current.set(scope, controller);
    try {
      const blob = await downloadAttachment(id, controller.signal);
      if (currentScope.current !== scope || controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const urls = downloadUrls.current.get(scope) ?? new Set<string>();
      urls.add(url);
      downloadUrls.current.set(scope, urls);
      const link = document.createElement("a");
      link.href = url;
      link.download = metadata.data.attachment.file_name;
      link.rel = "noopener";
      link.click();
      setTimeout(() => { if (urls.delete(url)) URL.revokeObjectURL(url); }, 1000);
    } catch (error) { if (currentScope.current === scope && !controller.signal.aborted) notifyHttpError(error); }
    finally {
      if (downloads.current.get(scope) === controller) downloads.current.delete(scope);
      if (currentScope.current === scope) setDownloadScope(null);
    }
  };
  if (!open) return <Button variant="contained" onClick={() => setOpenedScope(scope)}>{t(`attachments.kinds.${kind}`)} · {t("attachments.view")}</Button>;
  return <AttachmentCard>
    {metadata.isFetching && !metadata.isLoading && <LinearProgress aria-label={t("refreshing")} />}
    {metadata.isError && <Alert severity="error" action={<Button variant="contained" disabled={metadata.isFetching} onClick={() => void metadata.refetch()}>{t("retry")}</Button>}>{t("attachments.unavailable")}</Alert>}
    <Skeleton loading={metadata.isLoading}>
      {!metadata.isError && metadata.data && <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{metadata.data.attachment.file_name}</Typography>
        <Typography variant="caption" color="text.secondary">{metadata.data.attachment.byte_count === null ? t("attachments.size_unknown") : t("attachments.bytes", { count: metadata.data.attachment.byte_count })}</Typography>
        {metadata.data.attachment.page_count !== null && <Typography variant="caption" component="p">{t("attachments.pages", { count: metadata.data.attachment.page_count })}</Typography>}
        {metadata.data.attachment.duration_seconds !== null && <Typography variant="caption" component="p">{t("attachments.seconds", { count: metadata.data.attachment.duration_seconds })}</Typography>}
        {metadata.data.preview && (kind === "audio"
          ? <AudioPreview key={scope} blob={metadata.data.preview} name={metadata.data.attachment.file_name} />
          : <AttachmentPreview blob={metadata.data.preview}
            name={t("attachments.image_preview", { name: metadata.data.attachment.file_name })} />)}
        {kind === "audio" && !metadata.data.preview && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t("attachments.audio_preview_unavailable")}</Typography>}
      </Box>}
    </Skeleton>
    <Button variant="contained" disabled={!metadata.data || metadata.isFetching || metadata.isError || downloading} onClick={() => void download()}>{t("attachments.download")}</Button>
  </AttachmentCard>;
}
