import { Alert, Button, Typography } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import TextInput from "../../../../components/inputs/TextInput";
import type { NodiaAiConversation, NodiaAiConversationUpdateInput } from "../../infrastructure/types";
import type { ConversationAction } from "../ConversationHistory/types";
import { Actions, Form } from "./styles";

const schema = z.object({ title: z.string().refine(value => new TextEncoder().encode(value.trim()).length <= 256, "organization.title_limit") });
export interface ConversationOperation { chat: NodiaAiConversation; action: ConversationAction }
interface Props {
  operation: ConversationOperation;
  busy: boolean;
  error: string | null;
  onApply: (input: NodiaAiConversationUpdateInput) => Promise<void>;
  onClose: () => void;
  onRefresh: () => void;
}
export default function ConversationManagement({ operation, busy, error, onApply, onClose, onRefresh }: Props) {
  const { t } = useTranslation("nodiaAi");
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { title: operation.chat.title ?? "" } });
  const blocked = busy || form.formState.isSubmitting;
  const apply = async (input: NodiaAiConversationUpdateInput) => { try { await onApply(input); } catch { /* Parent retains operation/draft and hook owns mutation feedback. */ } };
  const errorBlock = error && <Alert severity="error" action={<Button disabled={blocked} onClick={onRefresh}>{t("organization.review_latest")}</Button>}>{error}</Alert>;
  if (operation.action !== "rename") {
    const action = operation.action === "pin" ? operation.chat.is_pinned ? "unpin" : "pin" : operation.chat.is_archived ? "unarchive" : "archive";
    return <ConfirmDialog open onClose={onClose} title={t(`organization.${action}`)} isLoading={blocked}
      message={t(`organization.${action}_confirm`, { title: operation.chat.title ?? t("untitled") })} confirmText={t(`organization.${action}`)}
      onConfirm={() => apply({ expected_conversation_revision: operation.chat.revision,
        ...(operation.action === "pin" ? { is_pinned: !operation.chat.is_pinned } : { is_archived: !operation.chat.is_archived }) })}>{errorBlock}</ConfirmDialog>;
  }
  return <BaseModal open title={t("organization.rename")} onClose={() => { if (!blocked) onClose(); }} disableEscapeKeyDown={blocked} showCloseButton={!blocked}>
    <Form onSubmit={form.handleSubmit(({ title }) => apply({ expected_conversation_revision: operation.chat.revision, title: title.trim() || null }))}>
      {errorBlock}
      <Controller name="title" control={form.control} render={({ field, fieldState }) => <TextInput {...field} label={t("organization.title")} disabled={blocked}
        error={!!fieldState.error} helperText={fieldState.error ? t("organization.title_limit") : t("organization.title_help")} />} />
      <Typography variant="caption" color="text.secondary">{t("organization.retention_unchanged")}</Typography>
      <Actions><Button onClick={onClose} disabled={blocked}>{t("close")}</Button><Button variant="contained" type="submit" disabled={blocked}>{t("organization.save")}</Button></Actions>
    </Form>
  </BaseModal>;
}
