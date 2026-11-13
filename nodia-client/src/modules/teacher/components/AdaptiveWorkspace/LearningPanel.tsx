import { useState } from "react";
import { Alert, Button, Chip, Divider, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import { learningSchema } from "../../infrastructure/learningSchemas";
import { useTeacherQuery } from "../../infrastructure/useServices";
import LessonMarkdown from "../LessonMarkdown";
import DiagnosticBankForm from "./DiagnosticBankForm";
import PanelState from "./PanelState";
import type { AdaptivePanelProps } from "./types";

export default function LearningPanel(props: AdaptivePanelProps) {
  const { t } = useTranslation();
  const query = useTeacherQuery(`sessions/${props.session.id}/learning`, learningSchema, undefined, props.visible);
  const [authoring, setAuthoring] = useState(false);
  const [dimension, setDimension] = useState<string | null>(null);
  const [objective, setObjective] = useState<string | null>(null);
  const disabled = props.busy || query.isFetching || ["paused", "archived"].includes(props.session.state);
  const data = query.data;
  return <PanelState loading={query.isLoading && !data} fetching={query.isFetching} error={query.isError} retry={query.refetch}>
    <Alert severity="info">{t("teacher:adaptive.evidence_notice")}</Alert>
    {data && <Stack sx={{ gap: 2 }}>
      <Typography variant="h6" component="h3">{t("teacher:adaptive.next_activity")}</Typography>
      {!data.recommendations.length && <Typography color="text.secondary">{t("teacher:adaptive.empty")}</Typography>}
      {data.recommendations.map(item => <Stack key={item.objective_id} sx={{ gap: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>{data.objectives.find(value => value.objective_id === item.objective_id)?.description}</Typography>
        <Typography>{t(`teacher:adaptive.reasons.${item.reason}`)}</Typography>
        <Typography variant="body2" color="text.secondary">{t(`teacher:adaptive.modes.${item.activity_mode}`)}</Typography>
        {item.unit_id && <Button variant="outlined" disabled={disabled} onClick={() => { if (item.unit_id) props.onPractice(item.unit_id); }}>{t("teacher:adaptive.practice_objective")}</Button>}
      </Stack>)}
      <Divider />
      <Typography variant="h6" component="h3">{t("teacher:adaptive.observations")}</Typography>
      {!data.observations.length && <Typography color="text.secondary">{t("teacher:adaptive.no_observations")}</Typography>}
      {data.observations.map(item => <Stack key={item.id} sx={{ gap: .5 }}>
        <Typography sx={{ fontWeight: 600 }}>{item.description}</Typography>
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}><Chip size="small" label={t(`teacher:adaptive.grade.${item.answer_state}`)} /><Chip size="small" label={t(item.independent ? "teacher:adaptive.independent" : item.assisted ? "teacher:adaptive.assisted" : "teacher:adaptive.unknown")} /></Stack>
        {item.earned_points !== null && <Typography variant="body2">{t("teacher:points", { earned: item.earned_points, possible: item.max_points })}</Typography>}
        {item.self_explanation && <LessonMarkdown text={item.self_explanation} />}
        {item.confidence !== null && <Typography variant="body2">{t("teacher:adaptive.declared_confidence", { value: item.confidence })}</Typography>}
        <Typography component="time" dateTime={item.observed_at} variant="caption" color="text.secondary">{new Date(item.observed_at).toLocaleString()}</Typography>
      </Stack>)}
      <Divider />
      <Typography variant="h6" component="h3">{t("teacher:adaptive.diagnostic_bank")}</Typography>
      {data.diagnostic_blueprint ? <Stack sx={{ gap: 1 }}><Typography>{data.diagnostic_blueprint.title}</Typography><Typography>{t(data.diagnostic_blueprint.reviewed ? "teacher:adaptive.bank_reviewed" : "teacher:adaptive.bank_candidate")}</Typography><Button variant="contained" disabled={disabled || !data.diagnostic_blueprint.reviewed} onClick={async () => { const result = await props.command.execute(`sessions/${props.session.id}/diagnostic-attempts`, { expected_session_revision: data.revision, entry_route: "diagnostic", new_attempt: false }); if (result) props.onResult(result); }}>{t("teacher:diagnostic")}</Button></Stack> : <Typography color="text.secondary">{t("teacher:adaptive.no_bank")}</Typography>}
      <Button variant="outlined" disabled={disabled} onClick={() => setAuthoring(value => !value)}>{t("teacher:adaptive.author_bank")}</Button>
      {authoring && <DiagnosticBankForm {...props} revision={data.revision} disabled={disabled} onSaved={() => setAuthoring(false)} />}
      {data.diagnostic_blueprint && data.objectives.length > 0 && <Stack sx={{ gap: 2 }}>
        <Typography variant="subtitle1" component="h4">{t("teacher:adaptive.mapping")}</Typography>
        <SelectSingleInput label={t("teacher:adaptive.dimension")} options={data.diagnostic_blueprint.dimensions.map(item => ({ value: item.id, label: item.description }))} value={dimension} onChange={setDimension} disabled={disabled} />
        <SelectSingleInput label={t("teacher:adaptive.objective")} options={data.objectives.map(item => ({ value: item.objective_id, label: item.description }))} value={objective} onChange={setObjective} disabled={disabled} />
        <Button variant="outlined" disabled={disabled || !dimension || !objective} onClick={async () => { const item = data.objectives.find(value => value.objective_id === objective); if (!item || !data.diagnostic_blueprint || !dimension) return; await props.command.execute(`sessions/${props.session.id}/learning/diagnostic-mappings`, { expected_session_revision: data.revision, blueprint_id: data.diagnostic_blueprint.id, dimension_id: dimension, plan_revision_id: item.plan_revision_id, objective_id: item.objective_id }); }}>{t("teacher:adaptive.save_mapping")}</Button>
      </Stack>}
    </Stack>}
  </PanelState>;
}
