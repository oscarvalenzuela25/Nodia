import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import { useTranslation } from "react-i18next";
import type { CvPdfDescription, CvVerifiedBytes } from "../../infrastructure/pdfVersions";
import type { CvPdfViewerProps } from "./PdfCanvasViewer";
import { cvPrimaryHover } from "../CvGeneration/styles";

let viewerModule: Promise<typeof import("./PdfCanvasViewer")> | undefined;
const loadViewer = () => {
  viewerModule ??= import("./PdfCanvasViewer").catch((error: unknown) => {
    viewerModule = undefined;
    throw error;
  });
  return viewerModule;
};
const control = { minHeight: 44, width: { xs: "100%", sm: "auto" } };
type Props = {
  description: CvPdfDescription;
  bytes: CvVerifiedBytes | null;
  filename: string;
  showTextOnOpen?: boolean;
};

export default function CvPdfReview({ description, bytes, filename, showTextOnOpen = false }: Props) {
  const { t } = useTranslation("nodiaCv");
  const bodyId = useId();
  const [mode, setMode] = useState<"text" | "pdf" | null>(showTextOnOpen ? "text" : null);
  const [viewer, setViewer] = useState<{ Component: ComponentType<CvPdfViewerProps> }>();
  const [generation, setGeneration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [moduleError, setModuleError] = useState(false);
  const request = useRef(0);
  const downloads = useRef(new Map<string, number>());
  const verified = bytes?.sha256 === description.sha256 ? bytes : null;

  useEffect(() => {
    const activeDownloads = downloads.current;
    return () => {
      request.current += 1;
      for (const [url, timeout] of activeDownloads) {
        window.clearTimeout(timeout);
        URL.revokeObjectURL(url);
      }
      activeDownloads.clear();
    };
  }, []);

  const showPdf = async () => {
    if (!verified || loading) return;
    setMode("pdf");
    if (viewer) return;
    const attempt = ++request.current;
    setLoading(true);
    setModuleError(false);
    try {
      const module = await loadViewer();
      if (attempt === request.current) setViewer({ Component: module.default });
    } catch {
      if (attempt === request.current) setModuleError(true);
    } finally {
      if (attempt === request.current) setLoading(false);
    }
  };
  const showText = () => {
    request.current += 1;
    setLoading(false);
    setMode(mode === "text" ? null : "text");
  };
  const download = () => {
    if (!verified) return;
    const url = URL.createObjectURL(new Blob([verified.buffer], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    const timeout = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      downloads.current.delete(url);
    }, 30_000);
    downloads.current.set(url, timeout);
  };
  const Viewer = viewer?.Component;

  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <Alert severity={verified ? "success" : "info"}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {t(verified ? "pdf_read_verified" : "pdf_read_server")}
        </Typography>
        <Typography variant="body2">{t("pdf_read_summary", { count: description.page_count })}</Typography>
      </Alert>
      {description.missing_contact && <Alert severity="warning">{t("pdf_missing_contact")}</Alert>}
      <Typography variant="caption" color="text.secondary">{t("pdf_external_import_pending")}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, flexWrap: "wrap" }}>
        <Button variant={mode === "pdf" ? "contained" : "outlined"} startIcon={<PictureAsPdfOutlined />}
          aria-expanded={mode === "pdf"} aria-controls={bodyId} loading={loading} disabled={!verified}
          sx={[control, mode === "pdf" && cvPrimaryHover]} onClick={() => { if (mode === "pdf" && !moduleError) setMode(null); else void showPdf(); }}>
          {t("pdf_open")}
        </Button>
        <Button variant={mode === "text" ? "contained" : "outlined"} startIcon={<DescriptionOutlined />}
          aria-expanded={mode === "text"} aria-controls={bodyId} sx={[control, mode === "text" && cvPrimaryHover]} onClick={showText}>
          {t("pdf_extracted_text")}
        </Button>
        <Button variant="outlined" startIcon={<DownloadOutlined />} disabled={!verified} sx={control} onClick={download}>
          {t("pdf_download")}
        </Button>
      </Stack>
      <Box id={bodyId} hidden={mode === null} sx={{ minWidth: 0 }}>
        {mode === "text" && (
          <Box component="pre" tabIndex={0} aria-label={t("pdf_extracted_text")} sx={{
            m: 0, p: 1.5, maxHeight: "min(55dvh, 28rem)", overflow: "auto", overflowWrap: "anywhere",
            whiteSpace: "pre-wrap", border: 1, borderColor: "divider", borderRadius: 1, fontSize: "0.875rem", lineHeight: 1.45,
          }}>
            {description.extracted_text}
          </Box>
        )}
        {mode === "pdf" && moduleError && (
          <Alert severity="error" action={
            <Button variant="outlined" color="inherit" disabled={loading} sx={{ minHeight: 44 }} onClick={() => void showPdf()}>
              {t("core:retry")}
            </Button>
          }>{t("pdf_view_failed")}</Alert>
        )}
        {mode === "pdf" && Viewer && verified && (
          <Viewer key={generation} buffer={verified.buffer} pageCount={description.page_count}
            onRetry={() => setGeneration(generation + 1)} />
        )}
      </Box>
    </Stack>
  );
}
