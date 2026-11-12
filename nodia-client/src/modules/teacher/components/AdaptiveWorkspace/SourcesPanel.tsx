import EnrichmentPaging from "./EnrichmentPaging";
import { useRef, useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import { fileToBase64, sourceContentSchema } from "../../infrastructure/enrichmentSchemas";
import { useTeacherQuery } from "../../infrastructure/useServices";
import { useEnrichment } from "./useEnrichment";
import PanelState from "./PanelState";
import type { AdaptivePanelProps } from "./types";

export default function SourcesPanel(props: AdaptivePanelProps) {
  const { t } = useTranslation();
  const { query, disabled, readDisabled, execute, page, setPage } = useEnrichment(props);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const source = useTeacherQuery(`sessions/${props.session.id}/enrichment/sources/${selected}`, sourceContentSchema, undefined, props.visible && selected !== null);
  const save = async () => {
    if (disabled || preparing || !title.trim()) return;
    setError(false); setPreparing(true);
    try {
      if (file && (file.size > 98304 || file.type !== "application/pdf")) { setError(true); return; }
      const payload = file ? { title, media_type: "application/pdf", base64: fileToBase64(new Uint8Array(await file.arrayBuffer())) } : { title, media_type: "text/plain", text };
      if (await execute("source_create", payload)) { setTitle(""); setText(""); setFile(null); if (input.current) input.current.value = ""; }
    } catch { setError(true); }
    finally { setPreparing(false); }
  };
  return <PanelState loading={query.isLoading && !query.data} fetching={query.isFetching} error={query.isError} retry={query.refetch}>
    <Alert severity="info">{t("teacher:adaptive.sources_notice")}</Alert>
    {query.data && <Stack sx={{ gap: 2 }}>
      {!query.data.sources.length && <Typography color="text.secondary">{t("teacher:adaptive.empty")}</Typography>}
      {query.data.sources.map(item => <Button key={item.id} variant={selected === item.id ? "contained" : "outlined"} disabled={readDisabled || source.isFetching} onClick={() => setSelected(item.id)}>{item.title}</Button>)}
      {selected && <PanelState loading={source.isLoading && !source.data} fetching={source.isFetching} error={source.isError} retry={source.refetch}>{source.data && <Stack sx={{ gap: 2 }}>{source.data.notices.map(notice => <Typography key={notice}>{t(notice === "teacher:source_page_without_text" ? "teacher:source_page_without_text" : "teacher:adaptive.source_notice")}</Typography>)}{source.data.pages.map(page => <Stack key={page.page} sx={{ gap: 1 }}><Typography variant="subtitle1" component="h3">{t("teacher:adaptive.page", { number: page.page })}</Typography><Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{page.text}</Typography></Stack>)}</Stack>}</PanelState>}
      <Typography variant="h6" component="h3">{t("teacher:adaptive.add_source")}</Typography>
      <TextInput label={t("teacher:adaptive.source_title")} value={title} disabled={disabled || preparing} onChange={event => setTitle(event.target.value)} />
      <TextInput label={t("teacher:adaptive.source_text")} value={text} multiline minRows={4} disabled={disabled || preparing || file !== null} onChange={event => setText(event.target.value)} />
      <input ref={input} type="file" accept="application/pdf" aria-label={t("teacher:adaptive.choose_pdf")} disabled={disabled || preparing} onChange={event => { setError(false); setFile(event.target.files?.[0] ?? null); }} />
      {file && <Button variant="outlined" disabled={disabled || preparing} onClick={() => { setFile(null); if (input.current) input.current.value = ""; }}>{t("teacher:adaptive.remove_file")}</Button>}
      {error && <Alert severity="error">{t("teacher:adaptive.invalid_source")}</Alert>}
      <Button variant="contained" disabled={disabled || preparing || !title.trim() || title.length > 160 || (!file && (!text.trim() || text.length > 32000 || new TextEncoder().encode(text).length > 131072))} onClick={() => void save()}>{t("teacher:adaptive.save_source")}</Button>
    </Stack>}
    {query.data && <EnrichmentPaging page={page} hasMore={query.data.has_more} disabled={readDisabled} onPage={setPage} />}
  </PanelState>;
}
