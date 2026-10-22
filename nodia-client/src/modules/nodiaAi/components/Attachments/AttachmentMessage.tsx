import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, LinearProgress, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../hooks/useAuth";
import { notifyHttpError } from "../../../../config/httpFeedback";
import { downloadAttachment, getAttachment } from "../../infrastructure/attachmentServices";
import { AttachmentCard } from "./styles";

/** Fetch private metadata and bytes only after explicit intent, with current server authorization. */
export default function AttachmentMessage({ id, conversationId, kind }: { id: string; conversationId: string; kind: "image" | "pdf" | "audio" }) {
  const { t } = useTranslation("nodiaAi");
  const { user, sessionVersion } = useAuth();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const current = useRef(true);
  const urls = useRef(new Set<string>());
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    current.current = true;
    const localUrls = urls.current;
    return () => { current.current = false; abort.current?.abort(); localUrls.forEach(url => URL.revokeObjectURL(url)); localUrls.clear(); };
  }, []);
  const metadata = useQuery({
    queryKey: ["nodia-ai", user?.id, sessionVersion, "attachment", conversationId, id],
    queryFn: ({ signal }) => getAttachment(id, conversationId, signal), enabled: open, retry: false, staleTime: 0, gcTime: 0,
  });
  const download = async () => {
    if (!metadata.data || downloading) return;
    setDownloading(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const blob = await downloadAttachment(id, controller.signal);
      if (!current.current) return;
      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      const link = document.createElement("a");
      link.href = url;
      link.download = metadata.data.file_name;
      link.rel = "noopener";
      link.click();
      setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 1000);
    } catch (error) { if (current.current && !controller.signal.aborted) notifyHttpError(error); }
    finally { if (current.current) setDownloading(false); }
  };
  if (!open) return <Button onClick={() => setOpen(true)}>{t(`attachments.kinds.${kind}`)} · {t("attachments.view")}</Button>;
  return <AttachmentCard>
    {metadata.isFetching && !metadata.isLoading && <LinearProgress aria-label={t("refreshing")} />}
    {metadata.isError && <Alert severity="error" action={<Button disabled={metadata.isFetching} onClick={() => void metadata.refetch()}>{t("retry")}</Button>}>{t("attachments.unavailable")}</Alert>}
    <Skeleton loading={metadata.isLoading}>
      {!metadata.isError && metadata.data && <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{metadata.data.file_name}</Typography>
        <Typography variant="caption" color="text.secondary">{metadata.data.byte_count === null ? t("attachments.size_unknown") : t("attachments.bytes", { count: metadata.data.byte_count })}</Typography>
        {metadata.data.page_count !== null && <Typography variant="caption" component="p">{t("attachments.pages", { count: metadata.data.page_count })}</Typography>}
        {metadata.data.duration_seconds !== null && <Typography variant="caption" component="p">{t("attachments.seconds", { count: metadata.data.duration_seconds })}</Typography>}
      </Box>}
    </Skeleton>
    <Button disabled={!metadata.data || metadata.isFetching || metadata.isError || downloading} onClick={() => void download()}>{t("attachments.download")}</Button>
  </AttachmentCard>;
}
