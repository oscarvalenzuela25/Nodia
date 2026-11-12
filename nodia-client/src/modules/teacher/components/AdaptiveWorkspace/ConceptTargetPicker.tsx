import { useState } from "react";
import { z } from "zod";
import { Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import { sessionsSchema } from "../../infrastructure/schemas";
import { conceptSchema } from "../../infrastructure/enrichmentSchemas";
import { useTeacherQuery } from "../../infrastructure/useServices";
import PanelState from "./PanelState";
import EnrichmentPaging from "./EnrichmentPaging";

const conceptsPageSchema = z.object({ items: z.array(conceptSchema), page: z.number().int(), limit: z.number().int(), has_more: z.boolean() });
export default function ConceptTargetPicker({ visible, disabled, value, onChange }: { visible: boolean; disabled: boolean; value: string | null; onChange: (id: string | null) => void }) {
  const { t } = useTranslation();
  const [planSearch, setPlanSearch] = useState("");
  const [planPage, setPlanPage] = useState(1);
  const [planId, setPlanId] = useState<string | null>(null);
  const [conceptSearch, setConceptSearch] = useState("");
  const [page, setPage] = useState(1);
  const plans = useTeacherQuery("sessions", sessionsSchema, { page: planPage, limit: 20, q: planSearch, archived: false }, visible);
  const concepts = useTeacherQuery(`sessions/${planId}/enrichment/concepts`, conceptsPageSchema, { page, q: conceptSearch }, visible && planId !== null);
  const locked = disabled || plans.isFetching || concepts.isFetching;
  return <Stack sx={{ gap: 2 }}>
    <InputSearch value={planSearch} onChange={text => { setPlanSearch(text); setPlanPage(1); }} placeholder={t("teacher:adaptive.find_plan")} disabled={disabled || plans.isFetching} />
    <PanelState loading={plans.isLoading && !plans.data} fetching={plans.isFetching} error={plans.isError} retry={plans.refetch}>
      <SelectSingleInput label={t("teacher:adaptive.target_plan")} value={planId} options={plans.data?.data.map(plan => ({ value: plan.id, label: `${plan.title || plan.topic} · ${plan.objective}` })) ?? []} disabled={locked} onChange={id => { setPlanId(id); setPage(1); setConceptSearch(""); onChange(null); }} />
      {plans.data && <EnrichmentPaging page={planPage} hasMore={plans.data.meta.total_pages > planPage} disabled={locked} onPage={setPlanPage} />}
    </PanelState>
    {planId && <PanelState loading={concepts.isLoading && !concepts.data} fetching={concepts.isFetching} error={concepts.isError} retry={concepts.refetch}>
      <InputSearch value={conceptSearch} onChange={text => { setConceptSearch(text); setPage(1); }} placeholder={t("teacher:adaptive.find_concept")} disabled={locked} />
      <SelectSingleInput label={t("teacher:adaptive.to_concept")} value={value} options={concepts.data?.items.map(item => ({ value: item.id, label: `${item.label} · ${item.conditions}` })) ?? []} disabled={locked} onChange={onChange} />
      {concepts.data && <EnrichmentPaging page={page} hasMore={concepts.data.has_more} disabled={locked} onPage={setPage} />}
    </PanelState>}
  </Stack>;
}
