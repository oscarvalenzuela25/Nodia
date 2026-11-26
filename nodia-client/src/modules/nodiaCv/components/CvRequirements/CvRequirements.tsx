import { useId } from "react";
import { Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { CvRequirement, CvSavedAnalysis } from "../../infrastructure/generationSchema";

const coverageColor = { supported: "success", confirm: "warning", omitted: "info", gap: "default" } as const;
type Props = {
  analysis: CvSavedAnalysis | null;
  onReview?: (requirement: CvRequirement) => void;
  reviewDisabled?: boolean;
};

export default function CvRequirements({ analysis, onReview, reviewDisabled }: Props) {
  const { t } = useTranslation("nodiaCv");
  const titleId = useId();
  const facts = new Map(analysis?.facts.map((fact) => [fact.id, fact.text]));
  const evidence = new Map(analysis?.evidence.map((item) => [item.requirement_id, item]));
  return (
    <Stack
      component={Paper}
      variant="outlined"
      spacing={2}
      sx={{ borderRadius: 2, minWidth: 0, p: { xs: 2, sm: 2.5 } }}
      aria-labelledby={titleId}
    >
      <Typography component="h2" id={titleId} variant="h6" sx={{ fontWeight: 750 }}>
        {t("generation_requirements")}
      </Typography>
      {!analysis?.requirements.length ? (
        <Typography variant="body2" color="text.secondary">
          {t(analysis ? "generation_requirements_empty" : "version_requirements_unavailable")}
        </Typography>
      ) : (
        <Stack component="ul" spacing={1.5} sx={{ listStyle: "none", m: 0, p: 0, minWidth: 0 }}>
          {analysis.requirements.map((requirement) => {
            const declared = evidence.get(requirement.id);
            const knownFacts = requirement.evidenceIds.map((id) => facts.get(id)).filter(Boolean);
            return (
              <Stack
                component="li"
                key={requirement.id}
                spacing={1.25}
                sx={{
                  overflowWrap: "anywhere",
                  minWidth: 0,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: "divider",
                  "&:last-child": { borderBottom: 0, pb: 0 },
                }}
              >
                <Typography sx={{ fontWeight: 650 }}>{requirement.quote}</Typography>
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                  <Chip size="small" variant="outlined" label={t("requirement_kind." + requirement.kind)} />
                  <Chip
                    size="small"
                    color={coverageColor[requirement.coverage]}
                    label={t("requirement_coverage." + requirement.coverage)}
                  />
                  {declared && <Chip size="small" variant="outlined" label={t("review_declared")} />}
                </Stack>
                {knownFacts.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {t("generation_linked_evidence")} {knownFacts.join(" · ")}
                  </Typography>
                )}
                {declared && (
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {declared.source} · {declared.detail}
                  </Typography>
                )}
                {onReview && (
                  <Button
                    variant="text"
                    disabled={reviewDisabled}
                    onClick={() => onReview(requirement)}
                    aria-label={t("review_named", { quote: requirement.quote })}
                    sx={{ minHeight: 44, alignSelf: { xs: "stretch", sm: "flex-start" } }}
                  >
                    {t("review_action")}
                  </Button>
                )}
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
