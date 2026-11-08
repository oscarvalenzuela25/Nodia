import { Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { useTeacherCommand } from "../../infrastructure/useServices";
import type { CommandResult } from "../../infrastructure/schemas";
import { RecoveryAlert } from "./styles";

type Props = { command: ReturnType<typeof useTeacherCommand>; onRecovered: (result: CommandResult) => void };
export default function RequestRecovery({ command, onRecovered }: Props) {
  const { t } = useTranslation();
  if (!command.uncertain) return null;
  return <RecoveryAlert severity="warning" action={<Button variant="outlined" type="button" color="inherit" disabled={command.isPending} onClick={() => { void command.reconcile().then(result => { if (result) onRecovered(result); }); }}>{t("teacher:recover_request")}</Button>}>{t("teacher:uncertain_request")}</RecoveryAlert>;
}
