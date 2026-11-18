import { Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { useTeacherCommand } from "../../infrastructure/useServices";
import type { CommandResult } from "../../infrastructure/schemas";
import { RecoveryAlert } from "./styles";

type Props = { command: ReturnType<typeof useTeacherCommand>; onRecovered: (result: CommandResult) => void };
export default function RequestRecovery({ command, onRecovered }: Props) {
  const { t } = useTranslation();
  if (!command.uncertain) return null;
  const recover = async (closeMissing: boolean) => {
    const result = await (closeMissing ? command.reconcile(true) : command.reconcile());
    if (result) onRecovered(result);
  };
  return <RecoveryAlert severity="warning" action={<>
    <Button variant="outlined" type="button" color="inherit" disabled={command.isPending} onClick={() => void recover(false)}>{t("teacher:recover_request")}</Button>
    {command.receiptMissing && <Button variant="outlined" type="button" color="inherit" disabled={command.isPending} onClick={() => void recover(true)}>{t("teacher:close_missing_request")}</Button>}
  </>}>{t(command.receiptMissing ? "teacher:receipt_missing_notice" : "teacher:uncertain_request")}</RecoveryAlert>;
}
