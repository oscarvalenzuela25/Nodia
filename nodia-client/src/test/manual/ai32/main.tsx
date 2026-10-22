// Synthetic browser harness. No production route imports this module.
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Alert, Box, Button, Typography } from "@mui/material";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import Attachments from "../../../modules/nodiaAi/components/Attachments/Attachments";
import AttachmentMessage from "../../../modules/nodiaAi/components/Attachments/AttachmentMessage";
import { useAttachmentDrafts } from "../../../modules/nodiaAi/components/Attachments/hooks/useAttachmentDrafts";
import { mainInstance } from "../../../config/api";
import useAuthStore from "../../../store/authStore";
import useThemeStore from "../../../store/configStore";
import i18n from "../../../translate";
import type { NodiaAiAttachment } from "../../../modules/nodiaAi/infrastructure/attachmentSchemas";

if (location.origin !== "http://127.0.0.1:5196") throw new Error("AI-32 synthetic QA requires isolated http://127.0.0.1:5196");
const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
document.documentElement.lang = i18n.language;
useThemeStore.setState({ themeType: params.get("theme") === "dark" ? "dark" : "light" });
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const chatId = "11111111-1111-4111-8111-111111111111";
const records = new Map<string, NodiaAiAttachment>();
let failReview = false;
mainInstance.defaults.adapter = async config => {
  const url = config.url ?? "";
  const body = typeof config.data === "string" ? JSON.parse(config.data) as Record<string, unknown> : {};
  const response = (data: unknown) => ({ config, data, status: 200, statusText: "OK", headers: {} });
  if (config.method === "get" && url === "/nodia-ai/attachments/capabilities") return response({ limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 50, image_pixels: 40000000 }, reviewed_text: true, native_modalities: { image: null, pdf: null, audio: null } });
  if (config.method === "post" && url === "/nodia-ai/attachments") {
    const id = crypto.randomUUID();
    const attachment: NodiaAiAttachment = { attachment_id: id, conversation_id: chatId, kind: body.kind as NodiaAiAttachment["kind"], state: "uploading", byte_count: null, file_name: String(body.file_name), media_type: null, page_count: null, duration_seconds: null, interpretation: null };
    records.set(id, attachment);
    return response({ attachment, upload: { method: "PUT", path: `/nodia-ai/attachments/${id}/content`, expires_at: "2027-01-01T00:00:00Z" } });
  }
  const matched = /^\/nodia-ai\/attachments\/([a-f0-9-]+)(\/content|\/interpretation)?$/.exec(url);
  if (matched && records.has(matched[1]!)) {
    const item = records.get(matched[1]!)!;
    if (config.method === "put" && matched[2] === "/content") {
      const next = { ...item, state: "ready" as const, byte_count: 127, media_type: "application/pdf", page_count: 1, interpretation: { text: "Synthetic extracted receipt\nProvider: Example only\nTotal: 0 CLP\n" + "Texto largo revisable / long reviewable text. ".repeat(10), origin: "extracted" as const, reviewed: false, revision: 1 } };
      records.set(item.attachment_id, next); return response(next);
    }
    if (config.method === "patch" && matched[2] === "/interpretation") {
      if (failReview) throw new AxiosError("Synthetic review failure", "ERR_BAD_RESPONSE", config, undefined, { config, data: { message: "Synthetic review failure; draft preserved" }, headers: {}, status: 503, statusText: "Unavailable" });
      const next = { ...item, interpretation: { text: String(body.text), origin: "user_reviewed" as const, reviewed: true, revision: (item.interpretation?.revision ?? 0) + 1 } };
      records.set(item.attachment_id, next); return response(next);
    }
    if (config.method === "get" && !matched[2]) return response(item);
    if (config.method === "delete") { records.delete(item.attachment_id); return response({ deleted: true }); }
    if (config.method === "get" && matched[2] === "/content") return response(new Blob(["Synthetic QA file only"]));
  }
  throw new Error(`AI-32 QA blocks every other request: ${config.method} ${url}`);
};
useAuthStore.getState().login({ token: "synthetic-qa-only", user: { id: "9", name: "Synthetic QA" }, expiresAt: Date.now() + 3600000 });
export function Harness() {
  const draft = useAttachmentDrafts(chatId);
  const [recording, setRecording] = useState(false);
  const [metrics, setMetrics] = useState("");
  useEffect(() => {
    const measure = () => {
      const next = JSON.stringify({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth });
      setMetrics(previous => previous === next ? previous : next);
      window.parent.postMessage({ kind: "ai32-layout", metrics: next }, location.origin);
    };
    const observer = new ResizeObserver(measure); observer.observe(document.documentElement); observer.observe(document.body);
    const mutation = new MutationObserver(measure); mutation.observe(document.body, { childList: true, subtree: true });
    measure(); return () => { observer.disconnect(); mutation.disconnect(); };
  }, []);
  return <MUIProvider><Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1000, minWidth: 0, mx: "auto" }}>
    <Typography component="h1" variant="h5">AI-32 · Synthetic QA only</Typography>
    <Alert severity="info" sx={{ my: 2 }}>Synthetic files and metadata. No API, database, provider or microphone call until explicit recording intent.</Alert>
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
      <Button onClick={() => draft.add([new File(["Synthetic QA PDF"], "Synthetic receipt with a very long filename for checking wrapping and mobile overflow.pdf", { type: "application/pdf" })])}>Add synthetic PDF</Button>
      <Button onClick={() => { failReview = !failReview; }}>Toggle review failure</Button>
      <Button onClick={() => useThemeStore.getState().handleToggleThemeType()}>Toggle theme</Button>
    </Box>
    <Attachments conversationId={chatId} draft={draft} disabled={false} onRecordingChange={setRecording} />
    <Typography sx={{ my: 2 }}>Ready: {String(draft.ready)} · Recording: {String(recording)} · IDs only: {JSON.stringify(draft.parts)}</Typography>
    {draft.parts.map(part => <AttachmentMessage key={part.attachment_id} id={part.attachment_id} conversationId={chatId} kind={part.kind} />)}
    <Typography component="output" sx={{ fontSize: 12, overflowWrap: "anywhere" }}>QA layout: {metrics}</Typography>
  </Box></MUIProvider>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
