import EnrichmentPaging from "./EnrichmentPaging";
import { useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import PanelState from "./PanelState";
import ActivityCard from "./ActivityCard";
import VisualCard from "./VisualCard";
import { useEnrichment } from "./useEnrichment";
import type { AdaptivePanelProps } from "./types";

export default function ActivitiesPanel(props: AdaptivePanelProps) {
  const { t } = useTranslation();
  const { query, disabled, readDisabled, execute, page, setPage } = useEnrichment(props);
  const [prompt, setPrompt] = useState("");
  const [solution, setSolution] = useState("");
  const [kind, setKind] = useState("completion");
  const [items, setItems] = useState("");
  const [categoryText, setCategoryText] = useState("");
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [labels, setLabels] = useState("");
  const [values, setValues] = useState("");
  const lines = items.split("\n").map(item => item.trim()).filter(Boolean);
  const categories = categoryText.split("\n").map(item => item.trim()).filter(Boolean);
  const solutionLines = solution.split("\n").map(item => item.trim()).filter(Boolean);
  const numbers = values.split("\n").map(value => value.trim()).filter(Boolean).map(Number);
  const labelLines = labels.split("\n").map(value => value.trim()).filter(Boolean);
  const valid = prompt.trim() && prompt.length <= 3000 && (kind === "classification" || solution.trim()) && (kind === "classification" ? lines.length >= 1 && lines.length <= 24 && new Set(lines).size === lines.length && categories.length >= 2 && categories.length <= 24 && new Set(categories).size === categories.length && lines.every(line => categories.includes(classes[line])) : kind === "completion" ? solution.length <= 2000 : lines.length >= 2 && lines.length <= 24 && lines.every(line => line.length <= 500) && new Set(lines).size === lines.length && (kind === "ordering" ? solutionLines.length === lines.length && new Set(solutionLines).size === lines.length && solutionLines.every(line => lines.includes(line)) : /^\d+$/.test(solution) && Number(solution) >= 1 && Number(solution) <= lines.length));
  return <PanelState loading={query.isLoading && !query.data} fetching={query.isFetching} error={query.isError} retry={query.refetch}>
    <Alert severity="info">{t("teacher:adaptive.activities_notice")}</Alert>
    {query.data && <Stack sx={{ gap: 2 }}>
      {!query.data.activities.length && <Typography color="text.secondary">{t("teacher:adaptive.empty")}</Typography>}
      {query.data.activities.map(activity => <ActivityCard key={activity.id} activity={activity} disabled={disabled} respond={answer => execute("activity_respond", { activity_id: activity.id, expected_activity_revision: activity.revision, answer })} />)}
      <Typography variant="h6" component="h3">{t("teacher:adaptive.create_activity")}</Typography>
      <SelectSingleInput label={t("teacher:adaptive.activity_type")} value={kind} clearable={false} disabled={disabled} onChange={value => { if (value) { setKind(value); setSolution(""); } }} options={["completion", "ordering", "classification", "error_location"].map(value => ({ value, label: t(`teacher:adaptive.activity_kinds.${value}`) }))} />
      <TextInput label={t("teacher:adaptive.question")} value={prompt} multiline disabled={disabled} onChange={event => setPrompt(event.target.value)} />
      {kind !== "completion" && <TextInput label={t("teacher:adaptive.activity_items")} value={items} multiline disabled={disabled} onChange={event => setItems(event.target.value)} />}
      {kind === "classification" && <><TextInput label={t("teacher:adaptive.categories")} value={categoryText} multiline disabled={disabled} onChange={event => setCategoryText(event.target.value)} />{lines.map(item => <SelectSingleInput key={item} label={item} value={classes[item] ?? null} options={categories} disabled={disabled} onChange={value => setClasses(current => ({ ...current, [item]: value ?? "" }))} />)}</>}
      {kind !== "classification" && <TextInput label={t(kind === "ordering" ? "teacher:adaptive.ordered_solution" : kind === "error_location" ? "teacher:adaptive.error_line" : "teacher:adaptive.expected_answer")} value={solution} multiline={kind === "ordering"} disabled={disabled} onChange={event => setSolution(event.target.value)} />}
      <Button variant="contained" disabled={disabled || !valid} onClick={async () => { const payload = kind === "classification" ? { items: lines, categories } : kind === "ordering" ? { items: lines } : kind === "error_location" ? { lines } : {}; const answer = kind === "classification" ? Object.fromEntries(lines.map(item => [item, classes[item]])) : kind === "ordering" ? solutionLines : kind === "error_location" ? Number(solution) : solution; if (await execute("activity_create", { kind, prompt, payload, solution: answer })) { setPrompt(""); setSolution(""); setItems(""); } }}>{t("teacher:adaptive.save_activity")}</Button>
      {query.data.visuals.map(visual => <VisualCard key={visual.id} visual={visual} />)}
      <Typography variant="h6" component="h3">{t("teacher:adaptive.create_visual")}</Typography>
      <TextInput label={t("teacher:adaptive.visual_title")} value={title} disabled={disabled} onChange={event => setTitle(event.target.value)} />
      <TextInput label={t("teacher:adaptive.visual_labels")} value={labels} multiline disabled={disabled} onChange={event => setLabels(event.target.value)} />
      <TextInput label={t("teacher:adaptive.visual_values")} value={values} multiline disabled={disabled} onChange={event => setValues(event.target.value)} />
      <Button variant="contained" disabled={disabled || !title.trim() || labelLines.length === 0 || labelLines.length > 24 || numbers.length !== labelLines.length || numbers.some(value => !Number.isFinite(value))} onClick={async () => { if (await execute("visual_create", { kind: "bar_chart", title, labels: labelLines, values: numbers })) { setTitle(""); setLabels(""); setValues(""); } }}>{t("teacher:adaptive.save_visual")}</Button>
    </Stack>}
    {query.data && <EnrichmentPaging page={page} hasMore={query.data.has_more} disabled={readDisabled} onPage={setPage} />}
  </PanelState>;
}
