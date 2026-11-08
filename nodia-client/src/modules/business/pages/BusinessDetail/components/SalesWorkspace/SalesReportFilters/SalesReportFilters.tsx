import { useState } from "react";
import { Alert } from "@mui/material";
import { useTranslation } from "react-i18next";
import Filter from "../../../../../../../components/Filter";
import FilterChips from "../../../../../../../components/Filter/components/FilterChips";
import DateInput from "../../../../../../../components/inputs/DateInput";
import SelectSingleInput from "../../../../../../../components/inputs/SelectSingleInput";
import { reportPeriod } from "./filters";
import type { ReportFilters } from "./filters";
import { AppliedFilters, FilterBar } from "./styles";

interface Props { value: ReportFilters; defaults: ReportFilters; disabled: boolean; onApply: (value: ReportFilters) => void }
export default function SalesReportFilters({ value, defaults, disabled, onApply }: Props) {
  const { t } = useTranslation("business");
  const [draft, setDraft] = useState(value);
  const valid = reportPeriod(draft) !== null;
  return <FilterBar>
    <Filter disabled={disabled} applyDisabled={!valid} title={t("business:pos.report_filters_title")}
      activeCount={1 + Number(value.metric !== "units")} onOpen={() => setDraft(value)}
      onFilter={() => { if (!disabled && reportPeriod(draft)) onApply(draft); }}
      onClear={() => { if (!disabled) { setDraft(defaults); onApply(defaults); } }}>
      <DateInput label={t("business:pos.from")} value={draft.from} onChange={(from) => setDraft(previous => ({ ...previous, from }))} disabled={disabled} error={!valid} />
      <DateInput label={t("business:pos.through")} value={draft.through} onChange={(through) => setDraft(previous => ({ ...previous, through }))} disabled={disabled} error={!valid} />
      <SelectSingleInput label={t("business:pos.ranking_metric")} value={draft.metric} clearable={false}
        options={[{ value: "units", label: t("business:pos.units_sold") }, { value: "amount", label: t("business:pos.registered_sales") }]}
        onChange={(metric) => { if (metric === "units" || metric === "amount") setDraft(previous => ({ ...previous, metric })); }} disabled={disabled} />
      {!valid && <Alert severity="error">{t("business:pos.invalid_period")}</Alert>}
    </Filter>
    <AppliedFilters>
      <FilterChips label={t("business:pos.report_period", { from: value.from, through: value.through })} />
      <FilterChips label={t(value.metric === "units" ? "business:pos.units_sold" : "business:pos.registered_sales")} />
    </AppliedFilters>
  </FilterBar>;
}
