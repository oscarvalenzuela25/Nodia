import { useId, useRef, useState, type FormEvent } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import { fileToBase64, sourceContentSchema } from "../../infrastructure/enrichmentSchemas";
import { useTeacherQuery } from "../../infrastructure/useServices";
import EnrichmentPaging from "./EnrichmentPaging";
import PanelState from "./PanelState";
import { PdfPicker, SourceActions, SourceFormats, SourceForm, SourceListButton, SourcePreview } from "./sourceStyles";
import type { AdaptivePanelProps } from "./types";
import { useEnrichment } from "./useEnrichment";

type SourceFormat = "text" | "pdf";
type PdfError = "source_invalid_format" | "source_invalid_size" | "invalid_source";

const pdfMediaType = "application/pdf";
const pdfByteLimit = 96 * 1024;
const textByteLimit = 128 * 1024;

function pdfError(file: File): PdfError | null {
  if (file.type !== pdfMediaType && !(file.type === "" && /\.pdf$/i.test(file.name))) return "source_invalid_format";
  if (file.size === 0 || file.size > pdfByteLimit) return "source_invalid_size";
  return null;
}

export default function SourcesPanel(props: AdaptivePanelProps) {
  const { t, i18n } = useTranslation();
  const { query, disabled, readDisabled, execute, page, setPage } = useEnrichment(props);
  const formTitleId = useId();
  const previewId = useId();
  const pdfHelpId = useId();
  const pdfErrorId = useId();
  const [format, setFormat] = useState<SourceFormat>("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [fileError, setFileError] = useState<PdfError | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const source = useTeacherQuery(`sessions/${props.session.id}/enrichment/sources/${selected}`, sourceContentSchema, undefined, props.visible && selected !== null);
  const activeSource = source.data?.id === selected ? source.data : undefined;
  const formDisabled = disabled || preparing;
  const titleTooLong = title.trim().length > 160;
  const textTooLong = text.length > 32000 || new TextEncoder().encode(text).length > textByteLimit;
  const valid = Boolean(title.trim()) && !titleTooLong &&
    (format === "pdf" ? file !== null : Boolean(text.trim()) && !textTooLong);

  const clearFile = () => {
    setFile(null);
    setFileError(null);
    if (input.current) input.current.value = "";
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formDisabled || !valid || inFlight.current) return;
    inFlight.current = true;
    setPreparing(true);
    setFileError(null);
    try {
      const payload = format === "pdf" && file
        ? { title, media_type: pdfMediaType, base64: fileToBase64(new Uint8Array(await file.arrayBuffer())) }
        : { title, media_type: "text/plain", text };
      const result = await execute("source_create", payload);
      if (result) {
        setTitle("");
        if (format === "pdf") clearFile();
        else setText("");
        if (result.kind === "learning_source" && result.resource_id) setSelected(result.resource_id);
      }
    } catch {
      setFileError("invalid_source");
    } finally {
      inFlight.current = false;
      setPreparing(false);
    }
  };

  const preview = selected && <SourcePreview id={previewId}>
    <PanelState loading={source.isLoading && !activeSource} fetching={source.isFetching} error={source.isError || Boolean(source.data && !activeSource)} retry={source.refetch}>
      {activeSource && <>
        <Typography variant="subtitle1" component="h4" sx={{ fontWeight: 700 }}>{activeSource.title}</Typography>
        {[...new Set(activeSource.notices)].map(notice => <Alert key={notice} severity="warning">
          {t(notice === "teacher:source_page_without_text" ? notice : "teacher:adaptive.source_notice")}
        </Alert>)}
        {activeSource.pages.map(page => <Stack key={page.page} sx={{ gap: 0.5 }}>
          <Typography variant="subtitle2" component="h5">{t("teacher:adaptive.page", { number: page.page })}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: page.text ? "text.primary" : "text.secondary" }}>
            {page.text || t("teacher:adaptive.source_page_empty")}
          </Typography>
        </Stack>)}
      </>}
    </PanelState>
  </SourcePreview>;

  const fileSize = file && (file.size >= 1024
    ? `${(file.size / 1024).toLocaleString(i18n.language, { maximumFractionDigits: 1 })} KiB`
    : `${file.size.toLocaleString(i18n.language)} B`);

  return <PanelState loading={query.isLoading && !query.data} fetching={query.isFetching} error={query.isError} retry={query.refetch}>
    {query.data && <Stack sx={{ gap: 3, minWidth: 0 }}>
      <SourceForm aria-labelledby={formTitleId} onSubmit={event => void save(event)}>
        <Stack sx={{ gap: 0.5 }}>
          <Typography id={formTitleId} variant="h6" component="h3" sx={{ fontWeight: 700 }}>{t("teacher:adaptive.add_source")}</Typography>
          <Typography variant="body2" color="text.secondary">{t("teacher:adaptive.source_privacy")}</Typography>
        </Stack>
        <SourceFormats role="group" aria-label={t("teacher:adaptive.source_format")}>
          <Button type="button" variant={format === "text" ? "contained" : "outlined"} aria-pressed={format === "text"}
            startIcon={<ArticleOutlined />} disabled={formDisabled} onClick={() => setFormat("text")}>
            {t("teacher:adaptive.source_paste")}
          </Button>
          <Button type="button" variant={format === "pdf" ? "contained" : "outlined"} aria-pressed={format === "pdf"}
            startIcon={<PictureAsPdfOutlined />} disabled={formDisabled} onClick={() => setFormat("pdf")}>
            {t("teacher:adaptive.source_pdf")}
          </Button>
        </SourceFormats>
        <TextInput label={t("teacher:adaptive.source_title")} required value={title} disabled={formDisabled} error={titleTooLong}
          helperText={titleTooLong ? t("teacher:adaptive.source_title_limit") : undefined} onChange={event => setTitle(event.target.value)} />
        <Box hidden={format !== "text"}>
          <TextInput label={t("teacher:adaptive.source_text")} required={format === "text"} value={text} multiline minRows={4} maxRows={8}
            disabled={formDisabled || format !== "text"} error={textTooLong}
            helperText={t(textTooLong ? "teacher:adaptive.source_text_limit" : "teacher:adaptive.source_text_help")} onChange={event => setText(event.target.value)} />
        </Box>
        <Box hidden={format !== "pdf"}>
          <PdfPicker>
            <Stack direction="row" sx={{ gap: 1.5, alignItems: "flex-start" }}>
              <PictureAsPdfOutlined color="primary" />
              <Stack sx={{ gap: 0.25, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ overflowWrap: "anywhere" }}>{file?.name ?? t("teacher:adaptive.source_upload_empty")}</Typography>
                {fileSize && <Typography variant="caption" color="text.secondary">{fileSize}</Typography>}
              </Stack>
            </Stack>
            <Stack id={pdfHelpId} sx={{ gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary">{t("teacher:adaptive.source_pdf_help")}</Typography>
              <Typography variant="body2" color="text.secondary">{t("teacher:adaptive.source_image_help")}</Typography>
            </Stack>
            <input ref={input} type="file" accept=".pdf,application/pdf" hidden aria-label={t("teacher:adaptive.choose_pdf")}
              disabled={formDisabled || format !== "pdf"} onChange={event => {
                const next = event.target.files?.[0];
                if (!next) return;
                const error = pdfError(next);
                setFile(error ? null : next);
                setFileError(error);
                if (error) event.target.value = "";
              }} />
            {fileError && <Alert id={pdfErrorId} severity="error">{t("teacher:adaptive." + fileError)}</Alert>}
            <SourceActions>
              <Button type="button" variant="outlined" startIcon={<UploadFileOutlined />} disabled={formDisabled}
                aria-describedby={fileError ? `${pdfHelpId} ${pdfErrorId}` : pdfHelpId} onClick={() => input.current?.click()}>
                {t("teacher:adaptive.choose_pdf")}
              </Button>
              {file && <Button type="button" variant="outlined" disabled={formDisabled} onClick={clearFile}>{t("teacher:adaptive.remove_file")}</Button>}
            </SourceActions>
          </PdfPicker>
        </Box>
        <SourceActions>
          <Button type="submit" variant="contained" disabled={formDisabled || !valid} loading={preparing}>{t("teacher:adaptive.save_source")}</Button>
        </SourceActions>
      </SourceForm>
      <Stack sx={{ gap: 1.5, minWidth: 0 }}>
        <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>{t("teacher:adaptive.saved_sources")}</Typography>
        {selected && !query.data.sources.some(item => item.id === selected) && preview}
        {!query.data.sources.length && !selected && <Typography variant="body2" color="text.secondary">{t(page === 1 ? "teacher:adaptive.sources_empty" : "teacher:adaptive.empty")}</Typography>}
        {query.data.sources.map(item => {
          const active = selected === item.id;
          const pdf = item.media_type === pdfMediaType;
          return <Stack key={item.id} sx={{ gap: 1, minWidth: 0 }}>
            <SourceListButton type="button" variant="outlined" disabled={readDisabled || source.isFetching}
              aria-expanded={active} aria-controls={active ? previewId : undefined} onClick={() => setSelected(active ? null : item.id)}>
              <Stack direction="row" sx={{ gap: 1.5, alignItems: "center", minWidth: 0 }}>
                {pdf ? <PictureAsPdfOutlined /> : <ArticleOutlined />}
                <Stack sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <Typography variant="subtitle2" component="span">{item.title}</Typography>
                  <Typography variant="caption" component="span" color="text.secondary">
                    {pdf ? "PDF" : t("teacher:adaptive.source_plain")} · {t("teacher:adaptive.source_page_count", { count: item.page_count })}
                  </Typography>
                </Stack>
              </Stack>
              <ExpandMoreOutlined aria-hidden sx={{ transform: active ? "rotate(180deg)" : undefined }} />
            </SourceListButton>
            {active && preview}
          </Stack>;
        })}
        <EnrichmentPaging page={page} hasMore={query.data.has_more} disabled={readDisabled} onPage={setPage} />
      </Stack>
    </Stack>}
  </PanelState>;
}
