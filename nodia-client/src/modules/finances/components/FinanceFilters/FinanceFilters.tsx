import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../components/inputs/TextInput";
import FinanceRemoteSelect, {
  FinanceRemoteMultiSelect,
} from "../FinanceRemoteSelect";
import type {
  FinanceRemoteOption,
  FinanceRemoteResource,
} from "../FinanceRemoteSelect/types";
import type { FinanceActive, FinanceQuery, FinanceResource } from "../../types";
import { financePeriod } from "../../utils/dates";
import { ActiveFilters, FilterBar } from "./styles";

const calendarDate = (value: unknown, exclusiveEnd = false) => {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (exclusiveEnd) date.setTime(date.getTime() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export interface FinanceFiltersProps {
  resource: FinanceResource | "overview";
  query: FinanceQuery;
  onChange: (query: FinanceQuery) => void;
  disabled?: boolean;
}

const FinanceFilters = ({
  resource,
  query,
  onChange,
  disabled = false,
}: FinanceFiltersProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<FinanceQuery>(query);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const rememberOptions = useCallback(
    (resource: FinanceRemoteResource, options: FinanceRemoteOption[]) => {
      setLabels((current) => {
        const next = { ...current };
        let changed = false;
        for (const option of options) {
          const key = `${resource}:${option.id}`;
          const label = option.key ? `${option.name} (${option.key})` : option.name;
          if (next[key] !== label) {
            next[key] = label;
            changed = true;
          }
        }
        return changed ? next : current;
      });
    },
    [],
  );
  const rememberCategories = useCallback(
    (options: FinanceRemoteOption[]) => rememberOptions("categories", options),
    [rememberOptions],
  );
  const rememberGroups = useCallback(
    (options: FinanceRemoteOption[]) => rememberOptions("category-groups", options),
    [rememberOptions],
  );
  const rememberObligations = useCallback(
    (options: FinanceRemoteOption[]) => rememberOptions("obligations", options),
    [rememberOptions],
  );
  const [selectionStates, setSelectionStates] = useState<
    Record<string, { busy: boolean; invalid: boolean }>
  >({});
  const open = () => {
    setDraft(query);
    setStart(calendarDate(query.q?.created_at_gteq));
    setEnd(calendarDate(query.q?.created_at_lt, true));
    setSelectionStates({});
  };
  const financial = resource === "movements" || resource === "overview";
  const hasTypes = financial || resource === "obligations";
  const options = (values: string[]) =>
    values.map((value) => ({ value, label: t(`finance:${value}`) }));
  const updatePredicate = (key: string, value: string | null) => {
    setDraft((current) => {
      const q = { ...current.q };
      if (value) q[key] = value;
      else delete q[key];
      if (key === "type_eq") delete q.status_eq;
      return { ...current, q };
    });
  };
  let dateError = false;
  let period: Record<string, string> = {};
  if (financial) {
    try {
      period = financePeriod(start, end);
    } catch {
      dateError = true;
    }
  }
  const selectorBlocked = Object.values(selectionStates).some(
    (state) => state.busy || state.invalid,
  );
  const reportSelection =
    (key: string) => (state: { busy: boolean; invalid: boolean }) =>
      setSelectionStates((current) => {
        if (
          current[key]?.busy === state.busy &&
          current[key]?.invalid === state.invalid
        )
          return current;
        return { ...current, [key]: state };
      });
  const apply = () => {
    if (disabled || dateError || selectorBlocked) return;
    const q = { ...draft.q };
    if (financial) {
      delete q.created_at_gteq;
      delete q.created_at_lt;
      Object.assign(q, period);
    }
    onChange({ ...draft, active: draft.active ?? "active", q, page: 1 });
  };
  const clear = () => {
    const cleared: FinanceQuery = {
      active: "active",
      page: 1,
      limit: query.limit,
    };
    setDraft(cleared);
    setStart("");
    setEnd("");
    setSelectionStates({});
    onChange(cleared);
  };
  const type = typeof draft.q?.type_eq === "string" ? draft.q.type_eq : null;
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const active = query.active ?? "active";
  const addPredicate = (key: string, field: string, value: string) => {
    chips.push({
      key,
      label: t("finance:filter_chips.value", {
        field: t(`finance:${field}`),
        value,
      }),
      remove: () => {
        const q = { ...query.q };
        delete q[key];
        onChange({ ...query, q, page: 1 });
      },
    });
  };
  for (const key of ["type_eq", "status_eq"] as const) {
    const value = query.q?.[key];
    if (typeof value === "string") {
      addPredicate(key, key === "type_eq" ? "type" : "status", t(`finance:${value}`));
    }
  }
  for (const key of ["created_at_gteq", "created_at_lt"] as const) {
    const value = calendarDate(query.q?.[key], key === "created_at_lt");
    if (value) {
      addPredicate(key, key === "created_at_lt" ? "created_to" : "created_from", value);
    }
  }
  for (const [key, resourceName, field] of [
    ["category_ids", "categories", "category"],
    ["category_group_ids", "category-groups", "category_groups"],
  ] as const) {
    for (const id of query[key] ?? []) {
      chips.push({
        key: `${key}:${id}`,
        label: t("finance:filter_chips.value", {
          field: t(`finance:${field}`),
          value: labels[`${resourceName}:${id}`] ?? `#${id}`,
        }),
        remove: () => onChange({
          ...query,
          [key]: query[key]?.filter((value) => value !== id),
          page: 1,
        }),
      });
    }
  }
  if (query.obligation_id) {
    chips.push({
      key: "obligation_id",
      label: t("finance:filter_chips.value", {
        field: t("finance:obligation"),
        value: labels[`obligations:${query.obligation_id}`] ?? `#${query.obligation_id}`,
      }),
      remove: () => onChange({ ...query, obligation_id: undefined, page: 1 }),
    });
  }
  if (active !== "all") {
    chips.push({
      key: "active",
      label: t(`finance:filter_chips.${active}_only`),
      remove: () => onChange({ ...query, active: "all", page: 1 }),
    });
  }

  return (
    <FilterBar>
      <Filter
        onFilter={apply}
        onClear={clear}
        onOpen={open}
        activeCount={chips.length}
        disabled={disabled}
        applyDisabled={dateError || selectorBlocked}
        title={t("finance:filters")}
      >
        <SelectSingleInput
          label={t("finance:visibility")}
          value={draft.active ?? "active"}
          options={options(["active", "inactive", "all"])}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              active: (value ?? "active") as FinanceActive,
            }))
          }
          clearable={false}
          disabled={disabled}
        />
        {hasTypes && (
          <SelectSingleInput
            label={t("finance:type")}
            value={type}
            options={options(
              resource === "obligations"
                ? ["loan", "debt"]
                : ["income", "expense"],
            )}
            onChange={(value) => updatePredicate("type_eq", value)}
            disabled={disabled}
          />
        )}
        {financial && (
          <>
            <SelectSingleInput
              label={t("finance:status")}
              value={
                typeof draft.q?.status_eq === "string"
                  ? draft.q.status_eq
                  : null
              }
              options={options(
                type === "income"
                  ? ["pending", "received", "cancelled"]
                  : type === "expense"
                    ? ["pending", "paid", "cancelled"]
                    : ["pending", "received", "paid", "cancelled"],
              )}
              onChange={(value) => updatePredicate("status_eq", value)}
              disabled={disabled}
            />
            <TextInput
              label={t("finance:created_from")}
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              disabled={disabled}
            />
            <TextInput
              label={t("finance:created_to")}
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              disabled={disabled}
              error={dateError}
              helperText={
                dateError
                  ? t("finance:invalid_period")
                  : t("finance:period_timezone")
              }
            />
            <FinanceRemoteMultiSelect
              resource="categories"
              active="all"
              allowUnresolved
              label={t("finance:categories")}
              value={draft.category_ids ?? []}
              onChange={(value) =>
                setDraft((current) => ({ ...current, category_ids: value }))
              }
              disabled={disabled}
              onSelectionStateChange={reportSelection("categories")}
              onOptionsResolved={rememberCategories}
            />
            <FinanceRemoteMultiSelect
              resource="category-groups"
              active="all"
              allowUnresolved
              label={t("finance:category_groups")}
              value={draft.category_group_ids ?? []}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  category_group_ids: value,
                }))
              }
              disabled={disabled}
              onSelectionStateChange={reportSelection("groups")}
              onOptionsResolved={rememberGroups}
            />
            <FinanceRemoteSelect
              resource="obligations"
              active="all"
              label={t("finance:obligation")}
              value={draft.obligation_id ?? null}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  obligation_id: value ?? undefined,
                }))
              }
              disabled={disabled}
              onSelectionStateChange={reportSelection("obligations")}
              onOptionsResolved={rememberObligations}
            />
          </>
        )}
      </Filter>
      {chips.length > 0 && (
        <ActiveFilters>
          {chips.map((chip) => (
            <FilterChips
              key={chip.key}
              label={chip.label}
              onAction={chip.remove}
              disabled={disabled}
            />
          ))}
        </ActiveFilters>
      )}
    </FilterBar>
  );
};

export default FinanceFilters;
