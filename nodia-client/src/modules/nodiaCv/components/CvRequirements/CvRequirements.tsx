import { useId } from "react";
import { Box, Button, ButtonBase, Chip, Paper, Stack, Typography } from "@mui/material";
import NorthEastOutlined from "@mui/icons-material/NorthEastOutlined";
import { useTranslation } from "react-i18next";
import type { CvRequirement, CvSavedAnalysis } from "../../infrastructure/generationSchema";

const coverageColor = { supported: "success", confirm: "warning", omitted: "info", gap: "default" } as const;
const requirementKinds = ["required", "preferred", "uncertain"] as const;

export type CvRequirementInteraction = {
  previewId: string;
  activeId: string | null;
  pinnedId: string | null;
  onHover: (id: string | null) => void;
  onFocus: (id: string | null) => void;
  onPin: (id: string) => void;
  coverage: (requirement: CvRequirement) => CvRequirement["coverage"];
};

type Props = {
  analysis: CvSavedAnalysis | null;
  interaction?: CvRequirementInteraction;
  onReview?: (requirement: CvRequirement) => void;
  reviewDisabled?: boolean;
};

export function CvRequirementsList({ analysis, interaction, onReview, reviewDisabled }: Props) {
  const { t } = useTranslation("nodiaCv");
  if (!analysis?.requirements.length) return (
    <Typography variant="body2" color="text.secondary">
      {t(analysis ? "generation_requirements_empty" : "version_requirements_unavailable")}
    </Typography>
  );

  const facts = new Map(analysis.facts.map((fact) => [fact.id, fact.text]));
  const evidence = new Map(analysis.evidence.map((item) => [item.requirement_id, item]));
  return (
    <Stack spacing={1.75} sx={{ minWidth: 0 }}>
      {requirementKinds.map((kind) => {
        const requirements = analysis.requirements.filter((requirement) => requirement.kind === kind);
        if (!requirements.length) return null;
        return (
          <Stack component="section" spacing={0.75} key={kind}
            sx={{ "& + &": { borderTop: 1, borderColor: "divider", pt: 1.5 } }}>
            <Typography component="h3" variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
              {t("requirement_group." + kind)}
            </Typography>
            <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", m: 0, p: 0, minWidth: 0 }}>
              {requirements.map((requirement) => {
                const { id, quote } = requirement;
                const declared = evidence.get(id);
                const coverage = interaction?.coverage(requirement) ?? requirement.coverage;
                const knownFacts = requirement.evidenceIds.map((factId) => facts.get(factId)).filter(Boolean);
                const detail = <>
                  <Box component="span" sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                    <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>{quote}</Typography>
                    {interaction && <NorthEastOutlined fontSize="small" color="primary" sx={{ flexShrink: 0 }} />}
                  </Box>
                  <Box component="span" sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    <Chip component="span" size="small" color={coverageColor[coverage]}
                      label={t("requirement_coverage." + coverage)} />
                    {declared && <Chip component="span" size="small" variant="outlined" label={t("review_declared")} />}
                  </Box>
                  {knownFacts.length > 0 && (
                    <Typography component="span" variant="caption" color="text.secondary">
                      {t("generation_linked_evidence")} {knownFacts.join(" · ")}
                    </Typography>
                  )}
                  {declared && (
                    <Typography component="span" variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {declared.source} · {declared.detail}
                    </Typography>
                  )}
                </>;
                return (
                  <Stack component="li" key={id} sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {interaction ? (
                      <ButtonBase type="button" aria-controls={interaction.previewId}
                        aria-pressed={interaction.pinnedId === id} data-cv-requirement-active={interaction.activeId === id || undefined}
                        onPointerEnter={(event) => {
                          if (event.pointerType !== "touch") interaction.onHover(id);
                        }}
                        onPointerLeave={() => interaction.onHover(null)}
                        onFocus={() => interaction.onFocus(id)} onBlur={() => interaction.onFocus(null)}
                        onClick={() => interaction.onPin(id)}
                        sx={{
                          width: "100%", minHeight: 44, p: 1, textAlign: "start", alignItems: "stretch",
                          display: "grid", justifyContent: "stretch", gap: 0.625, border: 1,
                          borderColor: "transparent", borderRadius: 1.5,
                          "&[data-cv-requirement-active]": { bgcolor: "action.selected", borderColor: "primary.main" },
                          "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                        }}>
                        {detail}
                      </ButtonBase>
                    ) : <Stack spacing={0.75} sx={{ px: 1, py: 0.75 }}>{detail}</Stack>}
                    {onReview && (
                      <Button variant="text" disabled={reviewDisabled} onClick={() => onReview(requirement)}
                        aria-label={t("review_named", { quote })}
                        sx={{ minHeight: 44, alignSelf: { xs: "stretch", sm: "flex-start" } }}>
                        {t("review_action")}
                      </Button>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
}

export default function CvRequirements(props: Props) {
  const { t } = useTranslation("nodiaCv");
  const titleId = useId();
  return (
    <Stack component={Paper} variant="outlined" spacing={2} aria-labelledby={titleId}
      sx={{ borderRadius: 2, minWidth: 0, p: { xs: 2, sm: 2.5 } }}>
      <Typography component="h2" id={titleId} variant="h6" sx={{ fontWeight: 750 }}>
        {t("generation_requirements")}
      </Typography>
      <CvRequirementsList {...props} />
    </Stack>
  );
}
