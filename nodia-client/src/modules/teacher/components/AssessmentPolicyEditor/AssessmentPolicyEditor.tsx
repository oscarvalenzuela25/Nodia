import { useEffect, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Stack, Typography } from "@mui/material";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import { ASSESSMENT_COUNT_SCOPES, ASSESSMENT_FORMATS, assessmentCountFields, parseAssessmentCountFields, type AssessmentPolicy } from "../../infrastructure/assessmentPolicy";
import { CountGroup, Fields } from "./styles";

type Props = { value: AssessmentPolicy; maximumSectionObjectives: number; busy: boolean; onChange: (value: AssessmentPolicy) => void; onValidation: (valid: boolean) => void };
export default function AssessmentPolicyEditor({ value, maximumSectionObjectives, busy, onChange, onValidation }: Props) {
  const { t } = useTranslation();
  const [fields, setFields] = useState(() => assessmentCountFields(value));
  const parsed = parseAssessmentCountFields(fields, value, maximumSectionObjectives);
  useEffect(() => { onValidation(parsed.valid); }, [onValidation, parsed.valid]);
  return <Accordion disabled={busy} disableGutters elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 1, "&:before": { display: "none" } }}>
    <AccordionSummary expandIcon={<ExpandMoreOutlined />} aria-controls="teacher-assessment-policy"><Typography component="span" variant="subtitle1">{t("teacher:assessment_policy")}</Typography></AccordionSummary>
    <AccordionDetails id="teacher-assessment-policy"><Stack sx={{ gap: 2 }}>
      <Typography variant="body2">{t("teacher:assessment_limits")}</Typography>
      {ASSESSMENT_COUNT_SCOPES.map(scope => <CountGroup key={scope}><legend>{t(`teacher:assessment_scopes.${scope}`)}</legend><Fields>
        {ASSESSMENT_FORMATS.map(format => <TextInput key={format} label={t("teacher:assessment_count_label", { scope: t(`teacher:assessment_scopes.${scope}`), format: t(`teacher:assessment_formats.${format}`) })} value={fields[scope][format]} type="number" inputMode="numeric" disabled={busy} error={!/^\d+$/.test(fields[scope][format]) || Number(fields[scope][format]) < 1} onChange={event => {
          const next = { ...fields, [scope]: { ...fields[scope], [format]: event.target.value } };
          setFields(next);
          const result = parseAssessmentCountFields(next, value, maximumSectionObjectives);
          onValidation(result.valid);
          if (result.valid) onChange(result.policy);
        }} />)}
      </Fields></CountGroup>)}
      {!parsed.valid && <Alert severity="error">{t("teacher:assessment_counts_invalid")}</Alert>}
      <Alert severity="info">{t("teacher:final_policy")}</Alert>
      <Typography variant="body2">{t("teacher:assessment_rubric")}</Typography>
    </Stack></AccordionDetails>
  </Accordion>;
}
