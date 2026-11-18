import { useEffect, useState } from "react";
import { Alert } from "@mui/material";
import { useTranslation } from "react-i18next";
import Filter from "../../../../../../components/Filter";
import ActiveStatusSelect from "../../../../../../components/Filter/components/ActiveStatusSelect";
import FilterChips from "../../../../../../components/Filter/components/FilterChips";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import BusinessDateRange from "../../../../components/BusinessDateRange";
import type { CashScope } from "../../../../infrastructure/cashTypes";
import { useCashCategoryOptions } from "../../../../infrastructure/useCashServices";
import { trimCashText } from "../../../../infrastructure/cashValues";
import { defaultCashFilters, validCashFilterPeriod, validCashSearch } from "./cashFilters";
import type { CashFilters } from "./cashFilters";
import { AppliedFilters } from "./styles";

interface CashFiltersProps {
  scope: CashScope;
  applied: CashFilters;
  onApply: (filters: CashFilters) => void;
  disabled: boolean;
}

export function CashFiltersButton({ scope, applied, onApply, disabled }: CashFiltersProps) {
  const { t } = useTranslation(["business", "core"]);
  const [draft, setDraft] = useState(applied);
  const valid = validCashFilterPeriod(draft);
  const activeCount = Number(Boolean(applied.category)) +
    Number(Boolean(applied.from || applied.to)) + Number(applied.activity !== "all");

  return (
    <Filter
      title={t("business:cash.filters")}
      activeCount={activeCount}
      disabled={disabled}
      applyDisabled={!valid}
      onOpen={() => setDraft(applied)}
      onFilter={() => { if (valid && !disabled) onApply(draft); }}
      onClear={() => {
        const defaults = defaultCashFilters();
        setDraft(defaults);
        onApply(defaults);
      }}
    >
      <CashCategoryFilter
        scope={scope}
        selected={draft.category}
        onChange={(category) => setDraft((previous) => ({ ...previous, category }))}
        disabled={disabled}
      />
      <BusinessDateRange
        from={{
          label: t("business:cash.from"),
          value: draft.from,
          onChange: (from) => setDraft((previous) => ({ ...previous, from })),
          disabled,
          error: !valid,
          minDate: "0001-01-01",
        }}
        to={{
          label: t("business:cash.to"),
          value: draft.to,
          onChange: (to) => setDraft((previous) => ({ ...previous, to })),
          disabled,
          error: !valid,
          minDate: "0001-01-01",
        }}
      />
      <ActiveStatusSelect
        value={draft.activity}
        onChange={(activity) => setDraft((previous) => ({ ...previous, activity }))}
        disabled={disabled}
      />
      {!valid && <Alert severity="error">{t("business:cash.invalid_period")}</Alert>}
    </Filter>
  );
}

interface CategoryFilterProps {
  scope: CashScope;
  selected: CashFilters["category"];
  onChange: (category: CashFilters["category"]) => void;
  disabled: boolean;
}

function CashCategoryFilter({ scope, selected, onChange, disabled }: CategoryFilterProps) {
  const { t } = useTranslation("business");
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const normalizedSearch = trimCashText(search);
  const validSearch = validCashSearch(search);
  useEffect(() => {
    if (!validSearch) return;
    const timeout = setTimeout(() => setQuerySearch(normalizedSearch), 300);
    return () => clearTimeout(timeout);
  }, [normalizedSearch, validSearch]);
  // This component mounts only while the filter dialog is visible.
  const query = useCashCategoryOptions(scope, { search: querySearch || undefined }, validSearch);
  const categories = query.data?.pages.flatMap((page) => page.data) ?? [];
  const options = categories.map(({ id, name }) => ({ value: id, label: name }));
  const canSelect = validSearch && querySearch === normalizedSearch && !query.isFetching && !query.isError;
  if (selected && !categories.some(({ id }) => id === selected.id)) {
    options.unshift({ value: selected.id, label: selected.name });
  }

  return (
    <>
      <SelectSingleInput
        label={t("business:cash.category_filter")}
        placeholder={t("business:cash.all_categories")}
        options={options}
        value={selected?.id ?? null}
        disabled={disabled}
        error={!validSearch}
        helperText={!validSearch ? t("business:cash.search_invalid") : undefined}
        loadingOptions={query.isFetching}
        onSearchChange={setSearch}
        hasMore={query.hasNextPage && validSearch}
        onLoadMore={() => { if (query.hasNextPage && canSelect) void query.fetchNextPage(); }}
        onChange={(id) => {
          if (id === null) onChange(null);
          const category = categories.find((entry) => entry.id === id);
          if (category && canSelect) onChange({ id: category.id, name: category.name });
        }}
      />
      <QueryErrorAlert
        isError={query.isError}
        isFetching={query.isFetching}
        onRetry={() => { if (validSearch) void query.refetch(); }}
      />
    </>
  );
}

export function CashAppliedFilters({
  applied,
  period,
  onApply,
  disabled,
}: Omit<CashFiltersProps, "scope"> & { period: string }) {
  const { t } = useTranslation(["business", "core"]);
  const hasPeriod = Boolean(applied.from || applied.to);
  const hasActivity = applied.activity !== "all";
  const { category } = applied;
  if (!hasPeriod && !hasActivity && !category) return null;

  return (
    <AppliedFilters>
      {hasPeriod && (
        <FilterChips label={period} disabled={disabled} onAction={() => onApply({ ...applied, from: "", to: "" })} />
      )}
      {hasActivity && (
        <FilterChips
          label={t("business:cash.filter_activity", { status: t(`core:active_filter.${applied.activity}`) })}
          disabled={disabled}
          onAction={() => onApply({ ...applied, activity: "all" })}
        />
      )}
      {category && (
        <FilterChips label={category.name} disabled={disabled} onAction={() => onApply({ ...applied, category: null })} />
      )}
    </AppliedFilters>
  );
}
