import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import ImageNotSupportedOutlined from "@mui/icons-material/ImageNotSupportedOutlined";
import { useTranslation } from "react-i18next";
import { PreviewFrame } from "./styles";

/** Preview only the local File; this never downloads or sends attachment bytes. */
export default function AttachmentDraftPreview({ file }: { file: File }) {
  const { t } = useTranslation("nodiaAi");
  const image = useRef<HTMLImageElement>(null);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const failed = failedFile === file;
  useEffect(() => {
    if (failed) return;
    const element = image.current;
    const url = URL.createObjectURL(file);
    if (element) element.src = url;
    return () => { element?.removeAttribute("src"); URL.revokeObjectURL(url); };
  }, [file, failed]);
  return <PreviewFrame>
    {failed
      ? <ImageNotSupportedOutlined titleAccess={t("attachments.preview_unavailable")} color="disabled" />
      : <Box component="img" ref={image} alt={t("attachments.image_preview", { name: file.name })}
        onError={() => setFailedFile(file)} sx={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }} />}
  </PreviewFrame>;
}
