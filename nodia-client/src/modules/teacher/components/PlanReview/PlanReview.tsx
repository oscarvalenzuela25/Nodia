import { useId, useState } from "react";
import { AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import type { Plan, Outline } from "../../infrastructure/schemas";
import { outlineSchema } from "../../infrastructure/schemas";
import { Actions } from "../../pages/Teacher/styles";
import PlanStructureEditor from "../PlanStructureEditor";
import { Decision, MetricRow, OutlineSection, ReviewSummary, SectionNumber, SectionSummary, UnitList } from "./styles";

type Props = { plan: Plan; busy: boolean; canAccept: boolean; canAdjust: boolean; futureRevision?: boolean; onSave: (outline: Outline) => Promise<void>; onAccept: () => Promise<void>; onAdjust: (text: string) => Promise<void> };
export default function PlanReview({ plan, busy, canAccept, canAdjust, futureRevision = false, onSave, onAccept, onAdjust }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState(() => structuredClone(plan.outline));
  const [adjustment, setAdjustment] = useState("");
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [policyValid, setPolicyValid] = useState(true);
  const changed = JSON.stringify(draft) !== JSON.stringify(plan.outline);
  const unitCount = draft.sections.reduce((sum, section) => sum + section.units.length, 0);
  const save = async () => {
    if (busy || !changed || !policyValid) return;
    const result = outlineSchema.safeParse(draft);
    setInvalid(!result.success);
    if (result.success) await onSave(result.data);
  };
  return <Stack component="section" aria-labelledby={`${id}-title`} sx={{ gap: 3, minWidth: 0 }}>
    <Stack direction="row" sx={{ gap: 1, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <Typography id={`${id}-title`} component="h2" variant="h5" sx={{ fontSize: 22, fontWeight: 700 }}>{t(futureRevision ? "teacher:review_ui.future_title" : "teacher:review_ui.title")}</Typography>
      <Chip label={t("teacher:revision", { revision: plan.revision_no })} size="small" variant="outlined" />
    </Stack>
    <ReviewSummary>
      <Stack sx={{ gap: 2, minWidth: 0 }}>
        <Typography component="h3" variant="h5" sx={{ fontWeight: 700, textWrap: "balance" }}>{draft.title || draft.topic}</Typography>
        <Typography sx={{ whiteSpace: "pre-wrap" }}>{draft.objective}</Typography>
        <MetricRow>
          <Chip label={t("teacher:review_ui.sections", { count: draft.sections.length })} size="small" />
          <Chip label={t("teacher:review_ui.units", { count: unitCount })} size="small" />
          <Chip label={draft.organization === "days" && draft.day_count !== null ? t("teacher:review_ui.days", { count: draft.day_count }) : t(`teacher:organization.${draft.organization}`)} size="small" />
        </MetricRow>
      </Stack>
      <Decision>
        <Typography variant="body2" color="text.secondary">{t("teacher:review_ui.decision_hint")}</Typography>
        <Button variant="contained" startIcon={<CheckOutlined />} disabled={busy || changed || !canAccept || !policyValid}
          onClick={() => void onAccept()}>{t(futureRevision ? "teacher:activate_revision" : "teacher:review_ui.use_plan")}</Button>
        <Typography variant="caption" color="text.secondary">{t(futureRevision ? "teacher:review_ui.future_accept_hint" : "teacher:review_ui.accept_hint")}</Typography>
      </Decision>
    </ReviewSummary>
    <Stack sx={{ gap: 1 }}>
      <Actions>
        <Button variant="outlined" startIcon={<EditOutlined />} disabled={busy} aria-expanded={editing} aria-controls={`${id}-editor`} onClick={() => setEditing(value => !value)}>{t(editing ? "teacher:review_ui.show_overview" : "teacher:review_ui.edit_structure")}</Button>
        <Button variant="outlined" startIcon={<TuneOutlined />} disabled={busy} aria-expanded={adjusting} aria-controls={`${id}-adjustment`} onClick={() => setAdjusting(value => !value)}>{t("teacher:review_ui.request_adjustment")}</Button>
      </Actions>
      {changed && <Alert severity="warning">{t("teacher:review_ui.unsaved")}</Alert>}
      {!policyValid && <Alert severity="error">{t("teacher:review_ui.invalid_policy")}</Alert>}
      {invalid && <Alert severity="error">{t("teacher:invalid_plan")}</Alert>}
      {(changed || !policyValid) && !editing && <Actions><Button variant="outlined" disabled={busy} onClick={() => setEditing(true)}>{t("teacher:review_ui.continue_editing")}</Button></Actions>}
    </Stack>
    <Box id={`${id}-adjustment`} hidden={!adjusting}>
      <Stack sx={{ gap: 2 }}>
        <Typography component="h3" variant="h6">{t("teacher:review_ui.adjustment_title")}</Typography>
        <Typography variant="body2" color="text.secondary">{t("teacher:review_ui.adjustment_hint")}</Typography>
        <TextInput label={t("teacher:adjustment")} helperText={t("teacher:review_ui.adjustment_example")} value={adjustment} onChange={event => setAdjustment(event.target.value)} multiline minRows={2} disabled={busy} />
        {!canAdjust && <Alert severity="info">{t("teacher:review_ui.adjustment_unavailable")}</Alert>}
        <Actions><Button variant="contained" disabled={busy || changed || !policyValid || !canAdjust || !adjustment.trim()} onClick={() => void onAdjust(adjustment)}>{t("teacher:ask_adjustment")}</Button></Actions>
      </Stack>
    </Box>
    <Box hidden={editing}>
      <Stack sx={{ gap: 2 }}>
        <Stack sx={{ gap: 0.5 }}>
          <Typography component="h3" variant="h6">{t("teacher:review_ui.journey")}</Typography>
          <Typography variant="body2" color="text.secondary">{t("teacher:review_ui.journey_hint")}</Typography>
        </Stack>
        {draft.sections.map((section, index) => <OutlineSection key={section.id} disabled={busy} disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMoreOutlined />} aria-controls={`${id}-section-${section.id}`}>
            <SectionSummary>
              <SectionNumber>{index + 1}</SectionNumber>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="span" sx={{ display: "block", fontWeight: 600 }}>{section.title || t("teacher:review_ui.section_fallback", { number: index + 1 })}</Typography>
                <Typography component="span" variant="body2" color="text.secondary">{t("teacher:review_ui.section_units", { count: section.units.length })}</Typography>
              </Box>
              {!section.required && <Chip size="small" variant="outlined" label={t("teacher:review_ui.optional")} />}
            </SectionSummary>
          </AccordionSummary>
          <AccordionDetails id={`${id}-section-${section.id}`}>
            <Stack sx={{ gap: 2 }}>
              <Box>
                <Typography variant="subtitle2">{t("teacher:review_ui.learning_outcomes")}</Typography>
                <UnitList as="ul">{section.objectives.map(objective => <li key={objective.id}>{objective.description}</li>)}</UnitList>
              </Box>
              <Box>
                <Typography variant="subtitle2">{t("teacher:review_ui.section_content")}</Typography>
                <UnitList>{section.units.map(unit => <li key={unit.id}>
                  {unit.title}
                  {draft.organization === "days" && unit.day_start !== null && unit.day_end !== null && <Typography variant="caption" color="text.secondary" component="span" sx={{ display: "block" }}>{t("teacher:review_ui.day_range", { start: unit.day_start, end: unit.day_end })}</Typography>}
                </li>)}</UnitList>
              </Box>
            </Stack>
          </AccordionDetails>
        </OutlineSection>)}
        {!draft.sections.length && <Alert severity="info">{t("teacher:review_ui.empty_sections")}</Alert>}
      </Stack>
    </Box>
    <Box id={`${id}-editor`} hidden={!editing}>
      <Stack sx={{ gap: 3 }}>
        <Stack sx={{ gap: 0.5 }}>
          <Typography component="h3" variant="h6">{t("teacher:review_ui.edit_structure")}</Typography>
          <Typography variant="body2" color="text.secondary">{t("teacher:review_ui.edit_hint")}</Typography>
        </Stack>
        <PlanStructureEditor value={draft} onChange={setDraft} busy={busy} onValidation={setPolicyValid} />
        <Actions><Button variant="contained" disabled={busy || !changed || !policyValid} onClick={() => void save()}>{t("teacher:save_changes")}</Button></Actions>
      </Stack>
    </Box>
  </Stack>;
}
