import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, IconButton, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import NavigateBeforeOutlined from "@mui/icons-material/NavigateBeforeOutlined";
import NavigateNextOutlined from "@mui/icons-material/NavigateNextOutlined";
import { Skeleton } from "boneyard-js/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import MobileRecordCard from "../../../../components/MobileRecordCard";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import useAuthStore from "../../../../store/authStore";
import { useCvHttpNotice } from "../../infrastructure/generations";
import { cvPdfErrorMessage, notifyCvPdfError } from "../../infrastructure/pdfFeedback";
import { cvVersionsPageSize, deleteCvVersion, listCvVersions, readCvVersion, type CvVersionSummary } from "../../infrastructure/pdfVersions";
import { profileAccessDenied, useProfileScope } from "../../infrastructure/profiles";
import { cvHttpStatus } from "../../infrastructure/useCvGenerationWorkflow";
import { cvPrimaryHover } from "../CvGeneration/styles";
import CvSavedVersionDetail from "./CvSavedVersionDetail";
import { cvVersionLabel } from "./versionPresentation";

const touch = { minWidth: 44, minHeight: 44 };
const wrap = { overflowWrap: "anywhere" };
type Props = { onDenial: () => void; onGoToGeneration: () => void };

export default function CvSavedVersions({ onDenial, onGoToGeneration }: Props) {
  const { t, i18n } = useTranslation("nodiaCv");
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { scope, active } = useProfileScope();
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<CvVersionSummary | null>(null);
  const [target, setTarget] = useState<CvVersionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const lock = useRef(false);
  const section = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const emptyAction = useRef<HTMLButtonElement>(null);
  const focusPending = useRef<string | null | undefined>(undefined);
  const versions = useQuery({
    queryKey: [...scope, "versions", page] as const,
    queryFn: ({ queryKey, signal }) => listCvVersions(queryKey[4], { version: queryKey[2], signal }),
    enabled: active,
    retry: false,
    gcTime: 0,
  });
  useCvHttpNotice(versions.error, onDenial);
  const denied = profileAccessDenied(versions.error);
  const data = denied ? undefined : versions.data;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / cvVersionsPageSize));
  if (data && page > pages) setPage(pages);
  const busy = versions.isFetching || deleting;

  useEffect(() => {
    if (busy || focusPending.current === undefined) return;
    const id = focusPending.current;
    const row = id ? section.current?.querySelector(`[data-cv-version='${id}']`) : null;
    const candidate = row?.querySelector<HTMLElement>("[data-cv-open]")
      ?? row?.querySelector<HTMLElement>("button:not([disabled])");
    (candidate ?? emptyAction.current ?? heading.current)?.focus();
    focusPending.current = undefined;
  }, [busy, data]);

  const onDetailMissing = useCallback(() => {
    setOpened(null);
    focusPending.current = null;
    void cache.invalidateQueries({ queryKey: scope.concat("versions") });
  }, [cache, scope]);
  const requestRemoval = (version: CvVersionSummary) => {
    setDeleteError(null);
    setTarget(version);
  };
  const remove = async () => {
    if (lock.current || !target) return;
    lock.current = true;
    setDeleting(true);
    setDeleteError(null);
    const valid = () => {
      const state = useAuthStore.getState();
      return state.user?.id === scope[1] && state.sessionVersion === scope[2];
    };
    const context = { version: scope[2] };
    let wasDeleted = true;
    try {
      try {
        await deleteCvVersion(target.id, context);
      } catch (error) {
        if (cvHttpStatus(error) !== 404) throw error;
        // Only an authorized GET can reconcile a missing result from an earlier deletion.
        try {
          await readCvVersion(target.id, context);
          throw error;
        } catch (lookup) {
          if (lookup === error || cvHttpStatus(lookup) !== 404) throw lookup;
          wasDeleted = false;
        }
      }
      if (!valid()) return;
      const index = data?.items.findIndex(({ id }) => id === target.id) ?? -1;
      const neighbor = index >= 0 ? data?.items[index + 1] ?? data?.items[index - 1] : undefined;
      focusPending.current = neighbor?.id ?? null;
      setOpened((current) => current?.id === target.id ? null : current);
      setTarget(null);
      if (page > 1 && data?.items.length === 1) setPage(page - 1);
      void cache.removeQueries({ queryKey: [...scope, "version", target.id], type: "inactive" });
      void cache.removeQueries({ queryKey: [...scope, "version-pdf", target.id], type: "inactive" });
      await cache.invalidateQueries({ queryKey: [...scope, "versions"] });
      if (valid()) sileo.success({ title: t(wasDeleted ? "version_deleted" : "version_absent") });
    } catch (error) {
      if (!valid()) return;
      setDeleteError(error);
      notifyCvPdfError(error, onDenial);
    } finally {
      lock.current = false;
      if (valid()) setDeleting(false);
    }
  };

  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: "medium" });
  const rows = data?.items ?? [];
  if (denied) return null;
  return (
    <Stack ref={section} spacing={2} sx={{ minWidth: 0 }}>
      <Stack spacing={0.5}>
        <Typography ref={heading} tabIndex={-1} component="h2" variant="h6" sx={{ fontWeight: 750 }}>{t("versions_title")}</Typography>
        <Typography color="text.secondary" variant="body2">{t("versions_subtitle")}</Typography>
      </Stack>
      <QueryErrorAlert isError={versions.isError} isFetching={versions.isFetching} onRetry={versions.refetch} retryVariant="outlined" />
      {versions.isLoading && !data && <Skeleton loading name="nodia-cv-versions"><Paper variant="outlined" sx={{ height: 168 }} /></Skeleton>}
      {data && versions.isFetching && <LinearProgress aria-label={t("versions_refreshing")} />}
      {data && !data.total && (
        <Stack component={Paper} variant="outlined" spacing={1} sx={{ p: { xs: 2, sm: 4 }, alignItems: { xs: "stretch", sm: "center" }, textAlign: "center" }}>
          <DescriptionOutlined color="primary" sx={{ alignSelf: "center" }} />
          <Typography component="h3" variant="h6">{t("versions_empty")}</Typography>
          <Typography color="text.secondary">{t("versions_empty_description")}</Typography>
          <Button ref={emptyAction} variant="contained" disabled={busy} sx={[touch, cvPrimaryHover]} onClick={onGoToGeneration}>{t("versions_go_generate")}</Button>
        </Stack>
      )}
      {rows.length > 0 && (mobile ? (
        <Stack component="ul" spacing={1.5} sx={{ m: 0, p: 0, listStyle: "none" }}>
          {rows.map((version) => (
            <Box component="li" key={version.id} data-cv-version={version.id}>
              <MobileRecordCard title={cvVersionLabel(version, t)} disabled={busy}
                fields={[
                  { key: "profile", label: t("fields.profile_name"), value: version.profile_name, fullWidth: true },
                  ...(version.vacancy_company ? [{ key: "company", label: t("fields.company"), value: version.vacancy_company, fullWidth: true }] : []),
                  { key: "template", label: t("pdf_template"), value: t(`pdf_templates.${version.template}`) },
                  { key: "language", label: t("generation_language"), value: t(`document_language.${version.language}`) },
                  { key: "created", label: t("version_created"), value: date.format(new Date(version.created_at)), fullWidth: true },
                ]}
                primaryAction={{ key: "open", label: t("version_open"), icon: <VisibilityOutlined />, onClick: () => setOpened(version) }}
                actions={[{ key: "delete", label: t("version_delete"), color: "error", icon: <DeleteOutlined />, onClick: () => requestRemoval(version) }]} />
            </Box>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label={t("versions_title")}>
            <TableHead><TableRow>
              <TableCell>{t("version_column")}</TableCell>
              <TableCell>{t("fields.profile_name")}</TableCell>
              <TableCell>{t("pdf_template")}</TableCell>
              <TableCell>{t("version_created")}</TableCell>
              <TableCell align="right">{t("actions")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {rows.map((version) => (
                <TableRow hover key={version.id} data-cv-version={version.id}>
                  <TableCell component="th" scope="row" sx={wrap}>
                    <Typography variant="body2" sx={{ fontWeight: 750 }}>{cvVersionLabel(version, t)}</Typography>
                    {version.vacancy_company && <Typography variant="caption" color="text.secondary">{version.vacancy_company}</Typography>}
                  </TableCell>
                  <TableCell sx={wrap}>{version.profile_name}</TableCell>
                  <TableCell sx={wrap}>
                    <Typography variant="body2">{t(`pdf_templates.${version.template}`)}</Typography>
                    <Typography variant="caption" color="text.secondary">{t(`document_language.${version.language}`)}</Typography>
                  </TableCell>
                  <TableCell>{date.format(new Date(version.created_at))}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                      <Tooltip title={t("version_open")}><span>
                        <IconButton data-cv-open sx={touch} disabled={busy} onClick={() => setOpened(version)}
                          aria-label={t("version_open_named", { version: cvVersionLabel(version, t) })}>
                          <VisibilityOutlined fontSize="small" />
                        </IconButton>
                      </span></Tooltip>
                      <Tooltip title={t("version_delete")}><span>
                        <IconButton color="error" sx={touch} disabled={busy} onClick={() => requestRemoval(version)}
                          aria-label={t("version_delete_named", { version: cvVersionLabel(version, t) })}>
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </span></Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ))}
      {pages > 1 && (
        <Stack component="nav" aria-label={t("versions_pagination")} direction="row" sx={{ alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
          <Typography variant="body2" aria-live="polite">{t("page_count", { page, pages })}</Typography>
          <IconButton sx={touch} aria-label={t("previous_page")} disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>
            <NavigateBeforeOutlined />
          </IconButton>
          <IconButton sx={touch} aria-label={t("next_page")} disabled={busy || page >= pages} onClick={() => setPage(page + 1)}>
            <NavigateNextOutlined />
          </IconButton>
        </Stack>
      )}
      {opened && <CvSavedVersionDetail key={opened.id} target={opened} onClose={() => setOpened(null)}
        onMissing={onDetailMissing} onDelete={() => requestRemoval(opened)} onDenial={onDenial} />}
      {target && (
        <ConfirmDialog open title={t("version_delete")} confirmText={t("version_delete")}
          message={t("version_delete_message", { version: cvVersionLabel(target, t), profile: target.profile_name })}
          onClose={() => { setTarget(null); setDeleteError(null); }} onConfirm={remove} isLoading={deleting}>
          {deleteError !== null && <Alert severity="error" sx={{ mt: 1 }}>{cvPdfErrorMessage(deleteError)}</Alert>}
        </ConfirmDialog>
      )}
    </Stack>
  );
}
