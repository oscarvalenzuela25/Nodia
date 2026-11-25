import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export type CvPdfViewerProps = { buffer: ArrayBuffer; pageCount: number; onRetry: () => void };

export default function PdfCanvasViewer({ buffer, pageCount, onRetry }: CvPdfViewerProps) {
  const { t } = useTranslation("nodiaCv");
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(1);
  const [painted, setPainted] = useState("");
  const [failed, setFailed] = useState(false);
  const frame = `${page}:${width}`;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // The worker takes ownership of its typed array. Keep the verified original for downloads.
    const loading = getDocument({
      data: new Uint8Array(buffer.slice(0)), stopAtErrors: true, useWorkerFetch: false, useWasm: false,
    });
    let current = true;
    void loading.promise.then((value) => {
      if (!current) return;
      if (value.numPages !== pageCount) setFailed(true);
      else setDocument(value);
    }).catch(() => { if (current) setFailed(true); });
    return () => {
      current = false;
      void loading.destroy().catch(() => undefined);
    };
  }, [buffer, pageCount]);

  useEffect(() => {
    const element = canvas.current;
    if (!document || !element || !width) return;
    let current = true;
    let painting: RenderTask | undefined;
    void document.getPage(page).then(async (value) => {
      if (!current) return;
      const original = value.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = value.getViewport({ scale: width * ratio / original.width });
      element.width = Math.ceil(viewport.width);
      element.height = Math.ceil(viewport.height);
      painting = value.render({ canvas: element, viewport });
      await painting.promise;
      if (current) setPainted(frame);
    }).catch(() => { if (current) setFailed(true); });
    return () => {
      current = false;
      painting?.cancel();
    };
  }, [document, frame, page, width]);

  if (failed) return (
    <Alert severity="error">
      <Stack spacing={1}>
        <Typography variant="body2">{t("pdf_view_failed")}</Typography>
        <Button variant="outlined" color="inherit" onClick={onRetry} sx={{ minHeight: 44, alignSelf: { sm: "flex-start" } }}>
          {t("core:retry")}
        </Button>
      </Stack>
    </Alert>
  );
  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 0.75, flexWrap: "wrap" }}>
        <Typography role="status" variant="body2">{t("pdf_page_number", { page, total: pageCount })}</Typography>
        {pageCount > 1 && (
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: "wrap" }}>
            <Button variant="outlined" disabled={page === 1} onClick={() => setPage(page - 1)} sx={{ minHeight: 44 }}>
              {t("previous_page")}
            </Button>
            <Button variant="outlined" disabled={page === pageCount} onClick={() => setPage(page + 1)} sx={{ minHeight: 44 }}>
              {t("next_page")}
            </Button>
          </Stack>
        )}
      </Stack>
      <Box ref={host} aria-busy={painted !== frame} sx={{
        width: "100%", maxWidth: 650, mx: "auto", overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1,
        bgcolor: "#fff", aspectRatio: "210 / 297", position: "relative",
      }}>
        {painted !== frame && <LinearProgress aria-label={t("pdf_view_loading")} sx={{ position: "absolute", inset: "0 0 auto" }} />}
        <Box component="canvas" key={frame} ref={canvas} role="img" aria-label={t("pdf_page_image", { page })}
          sx={{ display: "block", width: "100%", height: "auto", visibility: painted === frame ? "visible" : "hidden" }} />
      </Box>
    </Stack>
  );
}
