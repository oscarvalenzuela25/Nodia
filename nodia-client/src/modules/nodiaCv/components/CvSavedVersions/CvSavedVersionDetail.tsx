import { useEffect, useState } from "react";
import { Alert, Box, Button, Stack } from "@mui/material";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Skeleton } from "boneyard-js/react";
import BaseModal from "../../../../components/BaseModal";
import { cvPdfErrorMessage, notifyCvPdfError } from "../../infrastructure/pdfFeedback";
import { fetchCvVersionPdf, readCvVersion, type CvVersionSummary } from "../../infrastructure/pdfVersions";
import { useProfileScope } from "../../infrastructure/profiles";
import { cvHttpStatus } from "../../infrastructure/useCvGenerationWorkflow";
import CvPdfReview from "../CvPdfReview";
import { cvVersionLabel } from "./versionPresentation";

type Props = {
  target: CvVersionSummary;
  onClose: () => void;
  onMissing: () => void;
  onDelete: () => void;
  onDenial: () => void;
};
const button = { minHeight: 44, width: { xs: "100%", sm: "auto" } };

export default function CvSavedVersionDetail({ target, onClose, onMissing, onDelete, onDenial }: Props) {
  const { t } = useTranslation("nodiaCv");
  const { scope, active } = useProfileScope();
  const [wantFile, setWantFile] = useState(false);
  const detail = useQuery({
    queryKey: [...scope, "version", target.id] as const,
    queryFn: ({ queryKey, signal }) => readCvVersion(queryKey[4], { version: queryKey[2], signal }),
    enabled: active,
    meta: { errorNotification: "handled-locally" },
    retry: false,
    gcTime: 0,
  });
  const data = detail.data;
  const file = useQuery({
    queryKey: [...scope, "version-pdf", target.id, data?.sha256] as const,
    queryFn: ({ queryKey, signal }) => {
      const id = queryKey[4];
      const sha256 = queryKey[5];
      if (!sha256) throw new Error("Missing Nodia CV version digest");
      return fetchCvVersionPdf({ id, sha256 }, { version: queryKey[2], signal });
    },
    enabled: active && wantFile && Boolean(data) && !detail.isError,
    meta: { errorNotification: "handled-locally" },
    retry: false,
    gcTime: 0,
  });
  const error = detail.error ?? file.error;
  const unavailable = [401, 403, 404, 410].includes(cvHttpStatus(error) ?? 0);
  useEffect(() => {
    if (!error) return;
    notifyCvPdfError(error, onDenial);
    if (cvHttpStatus(error) === 404) onMissing();
  }, [error, onDenial, onMissing]);

  return (
    <BaseModal open size="lg" title={cvVersionLabel(target, t)} onClose={onClose}
      subtitle={t("version_detail_subtitle", {
        profile: target.profile_name, template: t(`pdf_templates.${target.template}`),
        language: t(`document_language.${target.language}`),
      })}
      actions={<>
        <Button variant="outlined" onClick={onClose} sx={button}>{t("core:close")}</Button>
        <Button variant="outlined" color="error" startIcon={<DeleteOutlined />} disabled={unavailable || detail.isFetching} onClick={onDelete} sx={button}>
          {t("version_delete")}
        </Button>
      </>}>
      {detail.isLoading && <Skeleton loading name="nodia-cv-version-details"><Box sx={{ height: 144 }} /></Skeleton>}
      {error && (
        <Alert severity="error">
          <Stack spacing={1}>
            {cvPdfErrorMessage(error)}
            {!unavailable && (
              <Button variant="outlined" color="inherit" disabled={detail.isFetching || file.isFetching}
                sx={{ ...button, alignSelf: { sm: "flex-start" } }}
                onClick={() => { void (detail.isError ? detail.refetch() : file.refetch()); }}>
                {t("core:retry")}
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      {!unavailable && data && (
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          {!file.data && !file.isError && (
            <Button variant="outlined" startIcon={<PictureAsPdfOutlined />} loading={file.isFetching}
              disabled={detail.isFetching || detail.isError} sx={{ ...button, alignSelf: { sm: "flex-start" } }}
              onClick={() => setWantFile(true)}>
              {t("pdf_verify_file")}
            </Button>
          )}
          <CvPdfReview key={data.id + ":" + data.sha256} description={data} bytes={file.data ?? null}
            filename={`nodia-cv-${data.version_number}.pdf`} />
        </Stack>
      )}
    </BaseModal>
  );
}
