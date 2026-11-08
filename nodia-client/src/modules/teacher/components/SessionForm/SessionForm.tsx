import { useForm } from "react-hook-form";
import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import { createSessionSchema, type CreateSession, type Session } from "../../infrastructure/schemas";
import { Fields } from "./styles";
import SessionFields from "./SessionFields";
import { sessionFormDefaults } from "./formValues";

type Props = { open: boolean; busy: boolean; initial?: Session; recovery?: ReactNode; onClose: () => void; onSave: (value: CreateSession) => Promise<void> };
export default function SessionForm({ open, busy, initial, recovery, onClose, onSave }: Props) {
  const { t, i18n } = useTranslation();
  const { control, handleSubmit, formState: { errors } } = useForm<CreateSession>({ resolver: zodResolver(createSessionSchema), defaultValues: sessionFormDefaults(i18n.resolvedLanguage ?? "es", initial) });
  return <BaseModal open={open} onClose={() => { if (!busy) onClose(); }} title={t(initial ? "teacher:edit_session" : "teacher:new_session")} subtitle={t("teacher:create_description")} actions={<Button type="submit" form="teacher-create" variant="contained" disabled={busy} sx={{ minHeight: 44 }}>{t("teacher:save_draft")}</Button>}>
    <Fields id="teacher-create" onSubmit={handleSubmit(onSave)}>
      {recovery}
      <SessionFields control={control} errors={errors} busy={busy} />
    </Fields>
  </BaseModal>;
}
