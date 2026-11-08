import { useId, useState } from "react";
import { Alert, Box, Button, IconButton, LinearProgress, Typography } from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { useIsFetching } from "@tanstack/react-query";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../hooks/useAuth";
import { getHttpErrorMessage } from "../../../../config/httpFeedback";
import { preferenceKeys, usePreferenceCatalog, usePreferences, usePreparePreference } from "../../infrastructure/usePreferences";
import type { NodiaAiPreference, NodiaAiPreferencePrepare } from "../../infrastructure/preferenceSchemas";
import type { NodiaAiProposalRef } from "../../infrastructure/types";
import ProposalPreview from "../ProposalPreview";
import PreferenceEditor from "./PreferenceEditor";
import { Actions, Card, Content, Header, PreferencesDrawer } from "./styles";
import type { PreferencesProps } from "./types";

export default function Preferences({ open, onClose, conversationId, disabled }: PreferencesProps) {
  const { t } = useTranslation("nodiaAi");
  const titleId = useId();
  const { user, sessionVersion } = useAuth();
  const list = usePreferences(open);
  const catalog = usePreferenceCatalog(open);
  const preparing = usePreparePreference();
  const fetching = useIsFetching({ queryKey: preferenceKeys([user?.id ?? null, sessionVersion]) }) > 0;
  const [editor, setEditor] = useState<{ preference?: NodiaAiPreference } | null>(null);
  const [proposal, setProposal] = useState<NodiaAiProposalRef | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = list.isError ? [] : list.data?.pages.flatMap(page => page.items) ?? [];
  const definitions = catalog.isError ? [] : catalog.data?.items ?? [];
  const busy = fetching || preparing.isPending || proposalBusy;
  const prepare = async (input: NodiaAiPreferencePrepare) => {
    if (disabled || busy || !conversationId || input.conversation_id !== conversationId) return;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError(null);
    try {
      const result = await preparing.mutateAsync(input);
      if (result.status !== "ready" || !result.proposal) { setError(t("preferences.not_ready")); return; }
      setProposal({ proposal_id: result.proposal.proposal_id, revision: result.proposal.revision, hash: result.proposal.hash });
      setEditor(null);
    } catch (cause) { setError(getHttpErrorMessage(cause)); }
    finally { if (focused) requestAnimationFrame(() => { if (focused.isConnected) focused.focus(); }); }
  };
  return <PreferencesDrawer anchor="right" open={open} onClose={() => { if (!busy) onClose(); }}
    slotProps={{ root: { keepMounted: true }, paper: { role: "dialog", "aria-modal": true, "aria-labelledby": titleId } }}>
    <Header><Typography id={titleId} component="h2" variant="h6">{t("preferences.title")}</Typography><IconButton aria-label={t("close")} title={t("close")} disabled={busy} onClick={onClose} sx={{ width: 44, height: 44 }}><CloseRounded /></IconButton></Header>
    <Content>
      <Typography variant="body2">{t("preferences.description")}</Typography>
      {(fetching || preparing.isPending) && <LinearProgress aria-label={t("refreshing")} />}
      {disabled && <Alert severity="info">{t("preferences.chat_required")}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {proposal && conversationId ? <>
        <ProposalPreview conversationId={conversationId} proposalRef={proposal} visible={open} onBusyChange={setProposalBusy} />
        <Actions><Button variant="contained" disabled={busy} onClick={() => { setProposal(null); setError(null); }}>{t("preferences.back")}</Button></Actions>
      </> : <>
        {(list.isError || catalog.isError) && <Alert severity="error" action={<Button variant="contained" disabled={busy} onClick={() => { if (list.isError) void list.refetch(); if (catalog.isError) void catalog.refetch(); }}>{t("retry")}</Button>}>{t("preferences.load_error")}</Alert>}
        <Skeleton loading={list.isLoading || catalog.isLoading}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            {!rows.length && !list.isError && <Typography>{t("preferences.empty")}</Typography>}
            {rows.map(item => <Card key={item.preference_id}>
              <Typography component="h3" variant="subtitle2">{t(`preferences.keys.${item.key}`)}</Typography>
              <Typography>{item.available && item.value_label ? item.value_label : t("preferences.unavailable_value")}</Typography>
              {item.scope_label && <Typography variant="caption">{t("preferences.scope", { value: item.scope_label })}</Typography>}
              {!item.available && <Alert severity="info">{t("preferences.unavailable")}</Alert>}
              <Actions>
                <Button variant="contained" disabled={disabled || busy || !item.available || !definitions.some(definition => definition.scope_key === item.scope_key && definition.key === item.key)} onClick={() => { setError(null); setEditor({ preference: item }); }}>{t("preferences.edit")}</Button>
                <Button variant="contained" color="error" disabled={disabled || busy || !conversationId} onClick={() => { if (conversationId) void prepare({ conversation_id: conversationId, operation: "delete", preference_id: item.preference_id, expected_revision: item.revision }); }}>{t("preferences.delete")}</Button>
              </Actions>
            </Card>)}
            {list.hasNextPage && <Button variant="contained" disabled={busy} onClick={() => void list.fetchNextPage()}>{t("preferences.more")}</Button>}
          </Box>
        </Skeleton>
        {editor && conversationId ? <Card>
          <Typography component="h3" variant="subtitle2">{t(editor.preference ? "preferences.edit" : "preferences.new")}</Typography>
          <PreferenceEditor key={editor.preference ? `${editor.preference.preference_id}:${editor.preference.revision}` : "new"} definitions={definitions} preference={editor.preference} conversationId={conversationId} disabled={disabled || busy} active={open} onPrepare={prepare} onCancel={() => setEditor(null)} />
        </Card> : <Actions><Button variant="contained" disabled={disabled || busy || !definitions.length || list.isError || catalog.isError} onClick={() => { setError(null); setEditor({}); }}>{t("preferences.new")}</Button></Actions>}
      </>}
    </Content>
  </PreferencesDrawer>;
}
