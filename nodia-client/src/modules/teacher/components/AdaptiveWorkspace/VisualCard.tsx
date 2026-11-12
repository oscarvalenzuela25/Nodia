import { Alert, Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { LearningVisual } from "../../infrastructure/enrichmentSchemas";

/** Every visual keeps a readable value list; unsupported renderers never execute payloads. */
export default function VisualCard({ visual }: { visual: LearningVisual }) {
  const { t } = useTranslation();
  return <Box component="figure" sx={{ m: 0, minWidth: 0 }}>
    <Typography component="figcaption" variant="h6">{visual.title}</Typography>
    {visual.availability === "unsupported" ? <Alert severity="info">{t("teacher:adaptive.unsupported_visual")}</Alert> :
      <Stack component={visual.kind === "timeline" ? "ol" : "ul"} sx={{ pl: visual.kind === "timeline" ? 3 : 0, m: 0, gap: 1, listStyle: visual.kind === "timeline" ? "decimal" : "none" }}>
        {visual.labels.map((label, index) => <Box component="li" key={`${label}:${index}`}>
          <Stack direction="row" sx={{ gap: 1, justifyContent: "space-between", overflowWrap: "anywhere" }}><Typography>{label}</Typography><Typography>{visual.values[index]}</Typography></Stack>
          {visual.kind === "bar_chart" && <Box sx={{ height: 12, width: `${Math.abs(visual.values[index]) / (Math.max(...visual.values.map(value => Math.abs(value))) || 1) * 100}%`, bgcolor: visual.values[index] < 0 ? "error.main" : "primary.main", borderRadius: 1 }} aria-hidden="true" />}
        </Box>)}
      </Stack>}
  </Box>;
}
