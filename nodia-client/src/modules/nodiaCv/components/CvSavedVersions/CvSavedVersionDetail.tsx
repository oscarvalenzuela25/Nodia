import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Stack } from "@mui/material";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";
import BaseModal from "../../../../components/BaseModal";
import useAuthStore, { hasActiveSession } from "../../../../store/authStore";
import { copySavedCvDraft } from "../../infrastructure/generations";
import { cvPdfErrorMessage, notifyCvPdfError } from "../../infrastructure/pdfFeedback";
import { fetchCvVersionPdf, readCvVersion, type CvVersionSummary } from "../../infrastructure/pdfVersions";
import { useProfileScope } from "../../infrastructure/profiles";
import { cvHttpStatus, type CvGenerationView } from "../../infrastructure/useCvGenerationWorkflow";
import CvPdfReview from "../CvPdfReview";
import CvRequirements from "../CvRequirements/CvRequirements";
import { cvVersionLabel } from "./versionPresentation";

type Props = {
  target: CvVersionSummary;
  onClose: () => void;
  onMissing: () => void;
  onDelete: () => void;
  onDenial: () => void;
  onEditCopy: (copy: CvGenerationView) => void;
};
const button = { minHeight: 44, width: { xs: "100%", sm: "auto" } };

export default function CvSavedVersionDetail({ target, onClose, onMissing, onDelete, onDenial, onEditCopy }: Props) {
  const { t } = useTranslation("nodiaCv");
  const { scope, active } = useProfileScope();
  const [wantFile, setWantFile] = useState(false);
  const copyKey = useRef<string | null>(null);
  const copying = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const detail = useQuery({
    queryKey: [...scope, "version", target.id] as const,
    queryFn: ({ queryKey, signal }) => readCvVersion(queryKey[4], { version: queryKey[2], signal }),
    enabled: active,
    meta: { errorNotification: "handled-locally" },
    retry: false,
    gcTime: 0,
  });
  const data = detail.data;
  const copy = useMutation({
    mutationFn: ({ saved, key }: { saved: CvVersionSummary; key: string }) => copySavedCvDraft(saved, key, scope[2]),
    retry: false,
    gcTime: 0,
  });
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
  const canCopy = active && data && !unavailable && !detail.isError && !detail.isFetching && !file.isFetching;
  const requestCopy = async () => {
    if (!canCopy || copying.current) return;
    copying.current = true;
    copyKey.current ??= crypto.randomUUID();
    const authorized = () => {
      const auth = useAuthStore.getState();
      return mounted.current && auth.user?.id === scope[1] && auth.sessionVersion === scope[2] && hasActiveSession(auth);
    };
    try {
      const draft = await copy.mutateAsync({ saved: data, key: copyKey.current });
      if (!authorized()) return;
      sileo.success({ title: t("version_copy_opened") });
      onEditCopy(draft);
    } catch (error) {
      if (authorized()) {
        if (cvHttpStatus(error) === 410) copyKey.current = null;
        notifyCvPdfError(error, onDenial);
      }
    } finally {
      copying.current = false;
    }
  };

  return (
    <BaseModal open size="lg" title={cvVersionLabel(target, t)} onClose={onClose}
      showCloseButton={!copy.isPending} disableEscapeKeyDown={copy.isPending}
      subtitle={t("version_detail_subtitle", {
        profile: target.profile_name, template: t(`pdf_templates.${target.template}`),
        language: t(`document_language.${target.language}`),
      })}
      actions={<>
        <Button variant="contained" startIcon={<EditOutlined />} loading={copy.isPending}
          disabled={!canCopy} onClick={() => void requestCopy()} sx={button}>{t("version_edit_copy")}</Button>
        <Button variant="outlined" disabled={copy.isPending} onClick={onClose} sx={button}>{t("core:close")}</Button>
        <Button variant="outlined" color="error" startIcon={<DeleteOutlined />}
          disabled={unavailable || detail.isFetching || copy.isPending} onClick={onDelete} sx={button}>
          {t("version_delete")}
        </Button>
      </>}>
      {detail.isLoading && <Skeleton loading name="nodia-cv-version-details"><Box sx={{ height: 144 }} /></Skeleton>}
      {copy.isError && <Alert severity="error" sx={{ mb: 2 }}>{cvPdfErrorMessage(copy.error)}</Alert>}
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
              disabled={detail.isFetching || detail.isError || copy.isPending} sx={{ ...button, alignSelf: { sm: "flex-start" } }}
              onClick={() => setWantFile(true)}>
              {t("pdf_verify_file")}
            </Button>
          )}
          <CvPdfReview key={data.id + ":" + data.sha256} description={data} bytes={file.data ?? null}
            filename={`nodia-cv-${data.version_number}.pdf`} showTextOnOpen />
          <CvRequirements analysis={data.analysis} />
        </Stack>
      )}
    </BaseModal>
  );
}
