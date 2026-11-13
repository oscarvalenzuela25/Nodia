import ConceptTargetPicker from "./ConceptTargetPicker";
import EnrichmentPaging from "./EnrichmentPaging";
import { useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import { learningSchema } from "../../infrastructure/learningSchemas";
import { sourceContentSchema } from "../../infrastructure/enrichmentSchemas";
import { useTeacherQuery } from "../../infrastructure/useServices";
import ConceptDetails from "./ConceptDetails";
import PanelState from "./PanelState";
import { useEnrichment } from "./useEnrichment";
import type { AdaptivePanelProps } from "./types";

export default function ConceptsPanel(props: AdaptivePanelProps) {
  const { t } = useTranslation();
  const { query, disabled, readDisabled, execute, page, setPage } = useEnrichment(props);
  const [label, setLabel] = useState("");
  const [statement, setStatement] = useState("");
  const [conditions, setConditions] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [objectiveId, setObjectiveId] = useState<string | null>(null);
  const [relationKind, setRelationKind] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState<string | null>(null);
  const [quote, setQuote] = useState("");
  const learning = useTeacherQuery(`sessions/${props.session.id}/learning`, learningSchema, undefined, props.visible);
  const source = useTeacherQuery(`sessions/${props.session.id}/enrichment/sources/${sourceId}`, sourceContentSchema, undefined, props.visible && sourceId !== null);
  const data = query.data;
  const sourceSummary = data?.sources.find(item => item.id === sourceId);
  const citationReady = sourceId === null || Boolean(sourceSummary && pageNumber && quote.trim() && quote.length <= 1000 && source.data?.pages.some(page => String(page.page) === pageNumber && page.text.includes(quote)));
  const locked = disabled || learning.isFetching || source.isFetching;
  return <PanelState loading={query.isLoading && !data} fetching={query.isFetching} error={query.isError} retry={query.refetch}>
    <Alert severity="info">{t("teacher:adaptive.concepts_notice")}</Alert>
    {data && <Stack sx={{ gap: 2 }}>
      {!data.concepts.length && <Typography color="text.secondary">{t("teacher:adaptive.empty")}</Typography>}
      <SelectSingleInput label={t("teacher:adaptive.focus_concept")} options={data.concepts.map(item => ({ value: item.id, label: item.label }))} value={focus} disabled={readDisabled} onChange={setFocus} />
      {data.concepts.filter(concept => focus === null || concept.id === focus).map(concept => <Stack key={concept.id} sx={{ gap: 1, p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}><Typography variant="h6" component="h3">{concept.label}</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{concept.statement}</Typography>{concept.conditions && <Typography variant="body2" color="text.secondary">{concept.conditions}</Typography>}<Button variant="outlined" disabled={readDisabled} onClick={() => setFocus(concept.id)}>{t("teacher:adaptive.inspect_concept")}</Button>{focus === concept.id && <ConceptDetails sessionId={props.session.id} conceptId={concept.id} visible={props.visible} />}</Stack>)}
      {data.accepted_equivalences.filter(item => focus === null || item.from_concept_id === focus).map(item => <Stack key={item.id} sx={{ gap: 1 }}><Typography>{item.from_label} ↔ {item.to_label}</Typography><Typography>{item.to_statement}</Typography></Stack>)}
      <Typography variant="h6" component="h3">{t("teacher:adaptive.add_concept")}</Typography>
      <TextInput label={t("teacher:adaptive.concept_label")} value={label} disabled={disabled} onChange={event => setLabel(event.target.value)} />
      <TextInput label={t("teacher:adaptive.concept_statement")} value={statement} multiline disabled={disabled} onChange={event => setStatement(event.target.value)} />
      <TextInput label={t("teacher:adaptive.concept_conditions")} value={conditions} multiline disabled={disabled} onChange={event => setConditions(event.target.value)} />
      <PanelState loading={learning.isLoading && !learning.data} fetching={learning.isFetching} error={learning.isError} retry={learning.refetch}><SelectSingleInput label={t("teacher:adaptive.optional_concept_objective")} options={learning.data?.objectives.map(item => ({ value: item.objective_id, label: item.description })) ?? []} value={objectiveId} disabled={locked} onChange={setObjectiveId} /></PanelState>
      <SelectSingleInput label={t("teacher:adaptive.optional_relation")} value={relationKind} disabled={locked} onChange={value => { setRelationKind(value); if (!value) setTargets([]); }} options={["support", "derivation", "contradiction", "prerequisite"].map(kind => ({ value: kind, label: t(`teacher:adaptive.relation_kinds.${kind}`) }))} />
      {relationKind && <><SelectMultipleInput label={t("teacher:adaptive.related_concepts")} value={targets} options={data.concepts.map(item => ({ value: item.id, label: item.label }))} disabled={locked} onChange={setTargets} error={targets.length > 4} helperText={t("teacher:adaptive.proposed_relation_notice")} /></>}
      <SelectSingleInput label={t("teacher:adaptive.optional_concept_source")} value={sourceId} disabled={locked} options={data.sources.map(item => ({ value: item.id, label: item.title }))} onChange={value => { setSourceId(value); setPageNumber(null); setQuote(""); }} />
      {sourceId && <PanelState loading={source.isLoading && !source.data} fetching={source.isFetching} error={source.isError} retry={source.refetch}><SelectSingleInput label={t("teacher:adaptive.citation_page")} value={pageNumber} options={source.data?.pages.map(page => ({ value: String(page.page), label: t("teacher:adaptive.page", { number: page.page }) })) ?? []} disabled={locked} onChange={setPageNumber} /><TextInput label={t("teacher:adaptive.exact_quote")} value={quote} multiline disabled={locked} onChange={event => setQuote(event.target.value)} error={quote.length > 1000 || Boolean(quote && !citationReady)} /></PanelState>}
      <Button variant="contained" disabled={locked || !label.trim() || label.length > 160 || !statement.trim() || statement.length > 2000 || conditions.length > 2000 || Boolean(relationKind && (targets.length === 0 || targets.length > 4)) || !citationReady} onClick={async () => { if (await execute("concept_create", { label, statement, conditions, ...(objectiveId ? { objective_id: objectiveId } : {}), ...(relationKind ? { relations: [{ kind: relationKind, target_concept_ids: targets }] } : {}), ...(sourceId && sourceSummary && pageNumber ? { source_refs: [{ source_id: sourceId, content_hash: sourceSummary.content_hash, page: Number(pageNumber), quote }] } : {}) })) { setLabel(""); setStatement(""); setConditions(""); setObjectiveId(null); setRelationKind(null); setTargets([]); setSourceId(null); setPageNumber(null); setQuote(""); } }}>{t("teacher:adaptive.save_concept")}</Button>
      <Typography variant="h6" component="h3">{t("teacher:adaptive.equivalences")}</Typography>
      {!data.equivalences.length && <Typography color="text.secondary">{t("teacher:adaptive.no_equivalences")}</Typography>}
      {data.equivalences.map(item => <Stack key={item.id} sx={{ gap: 1 }}><Typography>{data.concepts.find(concept => concept.id === item.from_concept_id)?.label ?? t("teacher:adaptive.other_plan_concept")} ↔ {data.concepts.find(concept => concept.id === item.to_concept_id)?.label ?? t("teacher:adaptive.other_plan_concept")}</Typography><Typography>{t(`teacher:adaptive.equivalence_states.${item.state}`)}</Typography><Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1 }}>{(["accepted", "rejected"] as const).map(state => <Button key={state} variant="outlined" disabled={disabled || item.state === state} onClick={() => void execute("equivalence_set", { from_concept_id: item.from_concept_id, to_concept_id: item.to_concept_id, state, expected_equivalence_revision: item.revision })}>{t(`teacher:adaptive.equivalence_actions.${state}`)}</Button>)}</Stack></Stack>)}
      <SelectSingleInput label={t("teacher:adaptive.from_concept")} options={data.concepts.map(item => ({ value: item.id, label: item.label }))} value={from} disabled={disabled} onChange={setFrom} />
      <ConceptTargetPicker visible={props.visible} disabled={disabled} value={to} onChange={setTo} />
      <Button variant="outlined" disabled={disabled || !from || !to || from === to} onClick={async () => { if (await execute("equivalence_set", { from_concept_id: from, to_concept_id: to, state: "proposed" })) { setFrom(null); setTo(null); } }}>{t("teacher:adaptive.propose_equivalence")}</Button>
      {data.has_more && <Alert severity="info">{t("teacher:adaptive.bounded_list")}</Alert>}
    </Stack>}
    {query.data && <EnrichmentPaging page={page} hasMore={query.data.has_more} disabled={readDisabled} onPage={setPage} />}
  </PanelState>;
}
