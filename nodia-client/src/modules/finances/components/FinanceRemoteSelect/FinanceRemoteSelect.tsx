import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import {
  useFinanceOptions,
  useFinanceRecord,
} from "../../infrastructure/useServices";
import type {
  FinanceRemoteMultiSelectProps,
  FinanceRemoteOption,
  FinanceRemoteSelectProps,
} from "./types";
import { SelectorContainer } from "./styles";

const EMPTY_OPTIONS: FinanceRemoteOption[] = [];

function useRemoteSearch() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);
  return { search: debounced, setSearch, waiting: search !== debounced };
}

export default function FinanceRemoteSelect({
  resource,
  label,
  value,
  onChange,
  disabled = false,
  enabled = true,
  active = "active",
  allowUnresolved = false,
  required,
  error,
  helperText,
  selectedOption,
  onSelectionStateChange,
  onOptionsResolved,
}: FinanceRemoteSelectProps) {
  const { t } = useTranslation();
  const { search, setSearch, waiting } = useRemoteSearch();
  const query = useFinanceOptions(resource, search, enabled, active);
  const loaded = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? EMPTY_OPTIONS,
    [query.data],
  );
  const known =
    loaded.find((option) => option.id === value) ??
    (selectedOption?.id === value ? selectedOption : undefined);
  const selected = useFinanceRecord(
    resource,
    value ?? undefined,
    enabled && Boolean(value) && !known,
  );
  const resolved = known ?? selected.data;
  useEffect(() => {
    if (resolved) onOptionsResolved?.([resolved]);
  }, [resolved, onOptionsResolved]);
  const options = new Map(loaded.map((option) => [option.id, option]));
  if (resolved && resolved.id === value) options.set(resolved.id, resolved);
  const busy = query.isFetching || selected.isFetching || waiting;
  const invalid = !allowUnresolved && Boolean(value && !resolved);
  useEffect(() => {
    onSelectionStateChange?.({ busy, invalid });
  }, [onSelectionStateChange, busy, invalid]);
  return (
    <SelectorContainer>
      <SelectSingleInput
        label={label}
        value={value}
        onChange={onChange}
        required={required}
        options={Array.from(options.values(), (option) => ({
          value: option.id,
          label: option.name,
        }))}
        placeholder={t("finance:select_placeholder")}
        searchPlaceholder={t("core:search")}
        disabled={disabled || busy}
        loadingOptions={query.isFetching}
        error={error}
        helperText={helperText}
        onSearchChange={setSearch}
        onLoadMore={() => {
          if (!query.isFetching && query.hasNextPage)
            void query.fetchNextPage();
        }}
        hasMore={query.hasNextPage}
      />
    </SelectorContainer>
  );
}

export function FinanceRemoteMultiSelect({
  resource,
  label,
  value,
  onChange,
  disabled = false,
  enabled = true,
  active = "active",
  allowUnresolved = false,
  required,
  error,
  helperText,
  selectedOptions = EMPTY_OPTIONS,
  onSelectionStateChange,
  onOptionsResolved,
}: FinanceRemoteMultiSelectProps) {
  const { t } = useTranslation();
  const { search, setSearch, waiting } = useRemoteSearch();
  const query = useFinanceOptions(resource, search, enabled, active);
  const [chosen, setChosen] = useState<FinanceRemoteOption[]>(EMPTY_OPTIONS);
  const loaded = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? EMPTY_OPTIONS,
    [query.data],
  );
  const options = new Map(
    [
      ...selectedOptions.filter((option) => value.includes(option.id)),
      ...chosen.filter((option) => value.includes(option.id)),
      ...loaded,
    ].map((option) => [option.id, option]),
  );
  useEffect(() => {
    onOptionsResolved?.([...selectedOptions, ...chosen, ...loaded]);
  }, [selectedOptions, chosen, loaded, onOptionsResolved]);
  const invalid = !allowUnresolved && value.some((id) => !options.has(id));
  const busy = query.isFetching || waiting;
  useEffect(() => {
    onSelectionStateChange?.({ busy, invalid });
  }, [onSelectionStateChange, busy, invalid]);
  const change = (ids: string[]) => {
    setChosen(
      ids.flatMap((id) => {
        const option = options.get(id);
        return option ? [option] : [];
      }),
    );
    onChange(ids);
  };
  return (
    <SelectorContainer>
      <SelectMultipleInput
        label={label}
        value={value}
        onChange={change}
        required={required}
        options={loaded.map((option) => ({
          value: option.id,
          label: option.name,
        }))}
        selectedOptions={Array.from(options.values(), (option) => ({
          value: option.id,
          label: option.name,
        }))}
        placeholder={t("finance:select_placeholder")}
        searchPlaceholder={t("core:search")}
        disabled={disabled || busy}
        loadingOptions={query.isFetching}
        error={error}
        helperText={helperText}
        onSearchChange={setSearch}
        onLoadMore={() => {
          if (!query.isFetching && query.hasNextPage)
            void query.fetchNextPage();
        }}
        hasMore={query.hasNextPage}
      />
    </SelectorContainer>
  );
}
