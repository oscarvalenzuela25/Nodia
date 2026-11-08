import { Alert, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { Reinforcement } from "../../infrastructure/schemas";
import { Content, UnitButton } from "./styles";

type Props = { projection: Reinforcement | null | undefined; currentPlanId: string | null; busy: boolean; failed: boolean;
  onOpen: (unitId: string) => void; onChooseUnit: () => void };

export default function ReinforcementPanel({ projection, currentPlanId, busy, failed, onOpen, onChooseUnit }: Props) {
  const { t } = useTranslation();
  const historical = Boolean(projection && (projection.navigation === "history_only" || projection.plan_revision_id !== currentPlanId));
  const targets = projection?.objectives.some(objective => objective.units.length > 0) === true;
  return <Content aria-label={t("teacher:reinforcement_title")}>
    <Typography variant="h6">{t("teacher:reinforcement_title")}</Typography>
    <Typography>{t("teacher:reinforcement_notice")}</Typography>
    {historical && <Alert severity="info">{t("teacher:reinforcement_history")}</Alert>}
    {failed && <Alert severity="error">{t("teacher:reinforcement_open_failed")}</Alert>}
    {projection?.objectives.map(objective => <Stack key={objective.objective_id} sx={{ gap: 1 }}>
      <Typography sx={{ fontWeight: 600 }}>{objective.description}</Typography>
      <Typography>{t("teacher:reinforcement_points", { earned: objective.earned_points, possible: objective.possible_points, missing: objective.possible_points - objective.earned_points })}</Typography>
      {objective.units.map(unit => historical ? <Typography key={unit.unit_id} color="text.secondary">{unit.title}</Typography> :
        <UnitButton key={unit.unit_id} variant="outlined" disabled={busy} onClick={() => onOpen(unit.unit_id)}>{t("teacher:reinforcement_study_unit", { title: unit.title })}</UnitButton>)}
    </Stack>)}
    {(!targets || historical) && <>
      {!historical && <Typography color="text.secondary">{t("teacher:reinforcement_unavailable")}</Typography>}
      <UnitButton disabled={busy} onClick={onChooseUnit}>{t("teacher:reinforcement_choose_unit")}</UnitButton>
    </>}
  </Content>;
}
