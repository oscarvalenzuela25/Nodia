import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert, Box, Button, LinearProgress, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import PersonOutline from "@mui/icons-material/PersonOutlineOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { Skeleton } from "boneyard-js/react";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import { getHttpErrorMessage } from "../../../../config/httpFeedback";
import { ProductHeading } from "../../../../theme/productBrand";
import ProfileEditor from "../../components/ProfileEditor/ProfileEditor";
import ProfilesList from "../../components/ProfilesList/ProfilesList";
import CvGeneration from "../../components/CvGeneration/CvGeneration";
import CvSavedVersions from "../../components/CvSavedVersions";
import { emptyProfile, profileEditorValues, profilesPageSize, type ProfileInput, type ProfileRecord, type ProfileSummary } from "../../infrastructure/profileSchema";
import { profileAccessDenied, useProfileDetail, useProfiles, useWriteProfile } from "../../infrastructure/profiles";

const tabs = [
  { value: "profiles", icon: PersonOutline },
  { value: "generate", icon: AutoAwesomeOutlined },
  { value: "saved", icon: ArticleOutlined },
] as const;
type Panel = (typeof tabs)[number]["value"];
type EditorTarget = { kind: "create" } | { kind: "edit" | "copy"; profile: ProfileSummary };

const emptyPanel = { p: { xs: 2, sm: 4 }, alignItems: { xs: "stretch", sm: "center" }, textAlign: { sm: "center" } };
const actionSx = { minHeight: 44, width: { xs: "100%", sm: "auto" }, flexShrink: 0 };

export default function NodiaCv() {
  const { t } = useTranslation("nodiaCv");
  const [denied, setDenied] = useState(false);
  const onDenial = useCallback(() => setDenied(true), []);
  return (
    <Stack
      component="section"
      aria-labelledby="nodia-cv-title"
      spacing={3}
      sx={{ minWidth: 0, width: "100%", maxWidth: "80rem", mx: "auto" }}
    >
      <Stack spacing={0.75}>
        <ProductHeading id="nodia-cv-title">{t("title")}</ProductHeading>
        <Typography color="text.secondary">{t("intro")}</Typography>
      </Stack>
      {denied ? <Alert severity="error">{t("access_lost")}</Alert> : <NodiaCvWorkspace onDenial={onDenial} />}
    </Stack>
  );
}

function NodiaCvWorkspace({ onDenial }: { onDenial: () => void }) {
  const { t } = useTranslation("nodiaCv");
  const terminalId = useId();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down("sm"));
  const [tab, setTab] = useState<Panel>("profiles");
  const [generationOpened, setGenerationOpened] = useState(false);
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<EditorTarget>();
  const [removing, setRemoving] = useState<ProfileSummary>();
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const deleting = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const profiles = useProfiles(page, tab === "profiles");
  const detail = useProfileDetail(editor && editor.kind !== "create" ? editor.profile.id : null);
  const write = useWriteProfile();
  const denial = profileAccessDenied(profiles.error) || profileAccessDenied(detail.error);
  const profileData = denial ? undefined : profiles.data;
  const pageCount = Math.max(1, Math.ceil((profileData?.total ?? 0) / profilesPageSize));

  if (profileData && page > pageCount) setPage(pageCount);

  useEffect(() => {
    if (denial) onDenial();
  }, [denial, onDenial]);

  const create = () => setEditor({ kind: "create" });
  const startProfile = () => {
    setTab("profiles");
    create();
  };
  const save = async (input: ProfileInput, intent: { requestKey: string } | Pick<ProfileRecord, "id" | "revision">) => {
    try {
      if ("requestKey" in intent) {
        await write.mutateAsync({ kind: "create", requestKey: intent.requestKey, input });
        setPage(1);
      } else {
        await write.mutateAsync({ kind: "update", ...intent, input });
      }
      setEditor(undefined);
      write.reset();
    } catch (error) {
      if (profileAccessDenied(error)) onDenial();
      throw error;
    }
  };
  const reload = async () => {
    const result = await detail.refetch({ throwOnError: true });
    if (!result.data) throw new Error("The profile detail is unavailable");
    return result.data;
  };
  const closeEditor = () => {
    setEditor(undefined);
    write.reset();
  };

  const remove = async () => {
    if (!removing || deleting.current) return;
    deleting.current = true;
    setDeleteError(null);
    try {
      await write.mutateAsync({ kind: "delete", id: removing.id, revision: removing.revision });
      setRemoving(undefined);
      write.reset();
      if (profileData?.items.length === 1 && page > 1) setPage(page - 1);
      requestAnimationFrame(() => titleRef.current?.focus());
    } catch (error) {
      if (profileAccessDenied(error)) onDenial();
      else setDeleteError(error);
    } finally {
      deleting.current = false;
    }
  };

  const loading = profiles.isLoading && !profileData;
  const busy = profiles.isLoading || profiles.isFetching || write.isPending;
  const nameForCopy = detail.data
    ? t("copy_name", { name: Array.from(detail.data.profile_name).slice(0, 95).join("") })
    : "";
  const editorTitle = editor?.kind === "edit" ? t("edit_profile") : editor?.kind === "copy" ? t("duplicate_profile") : t("new_profile");
  const deleteConflict = isAxiosError(deleteError) && [404, 409].includes(deleteError.response?.status ?? 0);
  const switchTab = (next: string | null) => {
    if (next !== "profiles" && next !== "generate" && next !== "saved") return;
    if (next === "generate") setGenerationOpened(true);
    setTab(next);
  };

  if (denial) return <Alert severity="error">{t("access_lost")}</Alert>;
  return (
    <>
        {narrow ? (
          <SelectSingleInput label={t("navigation")} value={tab} onChange={switchTab} clearable={false}
            options={tabs.map(option => ({ value: option.value, label: t(`tabs.${option.value}`) }))} />
        ) : (
          <Tabs value={tab} onChange={(_event, value: string) => switchTab(value)} aria-label={t("navigation")}
            sx={{ borderBottom: 1, borderColor: "divider", "& .MuiTab-root": { minHeight: 48, textTransform: "none", fontWeight: 650 } }}>
            {tabs.map(({ value, icon: Icon }) => (
              <Tab key={value} value={value} label={t(`tabs.${value}`)} icon={<Icon fontSize="small" />}
                iconPosition="start" id={`${terminalId}-${value}`} aria-controls={`${terminalId}-panel-${value}`} />
            ))}
          </Tabs>
        )}
        {!narrow && tabs.filter(option => option.value !== tab && (option.value !== "generate" || !generationOpened)).map(option => (
          <div key={option.value} hidden role="tabpanel" id={`${terminalId}-panel-${option.value}`}
            aria-labelledby={`${terminalId}-${option.value}`} />
        ))}
        {tab !== "generate" && <Stack id={`${terminalId}-panel-${tab}`} spacing={2.5} role={narrow ? "region" : "tabpanel"}
          aria-label={narrow ? t(`tabs.${tab}`) : undefined}
          aria-labelledby={!narrow ? `${terminalId}-${tab}` : undefined} tabIndex={0}>
          {tab === "profiles" && <>
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1.5, alignItems: { xs: "stretch", sm: "center" } }}>
              <Box>
                <Typography ref={titleRef} tabIndex={-1} component="h2" variant="h6" sx={{ fontWeight: 700 }}>{t("profiles_title")}</Typography>
                <Typography variant="body2" color="text.secondary">{t("profiles_subtitle")}</Typography>
              </Box>
              <Button ref={createButton} variant="contained" startIcon={<AddOutlined />} onClick={create}
                disabled={busy} sx={actionSx}>{t("new_profile")}</Button>
            </Stack>
            <QueryErrorAlert isError={profiles.isError} isFetching={profiles.isFetching} onRetry={profiles.refetch} retryVariant="outlined" />
            {loading && <Skeleton loading name="nodia-cv-profiles"><Paper variant="outlined" sx={{ height: 168 }} /></Skeleton>}
            {profileData && profiles.isFetching && <LinearProgress aria-label={t("updating_profiles")} />}
            {profileData && !profileData.total && !profiles.isError && (
              <Stack component={Paper} variant="outlined" spacing={1} sx={emptyPanel}>
                <PersonOutline color="primary" sx={{ alignSelf: "center" }} />
                <Typography component="h3" variant="h6">{t("empty_profiles")}</Typography>
                <Typography color="text.secondary">{t("empty_profiles_description")}</Typography>
              </Stack>
            )}
            {profileData && profileData.total > 0 && (
              <ProfilesList data={profileData.items} page={page} pages={pageCount} disabled={busy}
                onChangePage={setPage} onEdit={profile => setEditor({ kind: "edit", profile })}
                onCopy={profile => setEditor({ kind: "copy", profile })} onDelete={profile => {
                  setDeleteError(null);
                  setRemoving(profile);
                }} />
            )}
          </>}
          {tab === "saved" && (
            <CvSavedVersions onDenial={onDenial} onGoToGeneration={() => {
              switchTab("generate");
              requestAnimationFrame(() => document.getElementById(`${terminalId}-panel-generate`)?.focus());
            }} />
          )}
        </Stack>}
        {generationOpened && (
          <Box id={`${terminalId}-panel-generate`} hidden={tab !== "generate"} role={narrow ? "region" : "tabpanel"}
            aria-label={narrow ? t("tabs.generate") : undefined}
            aria-labelledby={!narrow ? `${terminalId}-generate` : undefined} tabIndex={0}>
            <CvGeneration active={tab === "generate"} onCreateProfile={startProfile} onDenial={onDenial}
              onOpenVersions={() => {
                switchTab("saved");
                requestAnimationFrame(() => document.getElementById(`${terminalId}-panel-saved`)?.focus());
              }} />
          </Box>
        )}
        {editor && editor.kind !== "create" && !detail.data && (
          <BaseModal open size="sm" title={editorTitle} onClose={closeEditor}>
            <QueryErrorAlert isError={detail.isError} isFetching={detail.isFetching} onRetry={detail.refetch} retryVariant="outlined" />
            {detail.isFetching && <LinearProgress aria-label={t("loading_profile")} />}
          </BaseModal>
        )}
        {editor && (editor.kind === "create" || detail.data) && (
          <ProfileEditor title={editorTitle} values={editor.kind !== "create" && detail.data
            ? profileEditorValues(detail.data, editor.kind === "copy" ? nameForCopy : undefined) : emptyProfile}
            editing={editor.kind === "edit" && detail.data ? { id: detail.data.id, revision: detail.data.revision } : undefined}
            onClose={closeEditor} onSave={save} onReload={editor.kind === "edit" ? reload : undefined} />
        )}
        {removing && (
          <ConfirmDialog open title={t("delete_profile")} message={t("delete_profile_message", { name: removing.profile_name, interpolation: { escapeValue: false } })}
            confirmText={t("delete_profile")} onClose={() => { setRemoving(undefined); write.reset(); }} onConfirm={remove}
            isLoading={write.isPending} confirmDisabled={deleteConflict}>
            {deleteError !== null && <Alert severity="error" sx={{ mt: 1.5 }}>
              {getHttpErrorMessage(deleteError)}
              {deleteConflict && <Typography variant="body2">{t("review_delete_again")}</Typography>}
            </Alert>}
          </ConfirmDialog>
        )}
    </>
  );
}
