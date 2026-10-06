import { useContext, useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import useAuthStore, { hasValidatedSession } from "../../../../store/authStore";
import { getRentalList } from "../../infrastructure/services";
import type {
  RentalListResource,
  RentalQuery,
  RentalRecordMap,
} from "../../types";
import { SelectWrapper } from "./styles";
import { RentalAccessContext } from "../../infrastructure/scope";
type Resource = Extract<
  RentalListResource,
  | "properties"
  | "reservations"
  | "cancellation-policies"
  | "collaborator-candidates"
>;
export type RentalRemoteSelectProps = {
  resource: Resource;
  propertyId?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
  disabled?: boolean;
  enabled?: boolean;
  selectedLabel?: string;
  query?: RentalQuery;
  required?: boolean;
  error?: boolean;
  helperText?: string;
};
function labelOf(record: RentalRecordMap[Resource]): string {
  const name = "guest_name" in record ? record.guest_name : record.name;
  return name ? `${name} · #${record.id}` : `#${record.id}`;
}
export default function RentalRemoteSelect({
  resource,
  propertyId,
  value,
  onChange,
  label,
  disabled,
  enabled = true,
  selectedLabel,
  query = {},
  required,
  error,
  helperText,
}: RentalRemoteSelectProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(draftSearch), 300);
    return () => clearTimeout(timer);
  }, [draftSearch]);
  const [selected, setSelected] = useState<
    { value: string; label: string } | undefined
  >();
  const actor = useAuthStore((state) => state.user?.id);
  const authenticated = useAuthStore(hasValidatedSession);
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const accessible = useContext(RentalAccessContext);
  const candidate = resource === "collaborator-candidates";
  const results = useInfiniteQuery({
    queryKey: [
      "rental",
      actor,
      propertyId,
      "options",
      resource,
      query,
      search,
      sessionVersion,
    ],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      getRentalList(
        resource,
        propertyId,
        {
          ...query,
          page: pageParam,
          limit: 20,
          ...(resource === "collaborator-candidates"
            ? { search: search.trim() }
            : {
                q: {
                  ...query.q,
                  ...(search.trim()
                    ? {
                        [resource === "reservations"
                          ? "guest_name_cont"
                          : "name_cont"]: search.trim(),
                      }
                    : {}),
                },
              }),
        },
        signal,
      ),
    enabled: Boolean(
      enabled &&
      accessible &&
      actor &&
      authenticated &&
      (resource === "properties" || propertyId) &&
      (!candidate || search.trim().length >= 3),
    ),
    getNextPageParam: (last) =>
      last.meta.page < last.meta.total_pages ? last.meta.page + 1 : undefined,
    retry: false,
  });
  const records = results.data?.pages.flatMap((page) => page.data) ?? [];
  const options = records.map((record) => ({
    value: record.id,
    label: labelOf(record),
  }));
  if (value && !options.some((option) => option.value === value))
    options.unshift({
      value,
      label:
        selected?.value === value
          ? selected.label
          : (selectedLabel ?? `${t("rental:record")} #${value}`),
    });
  return (
    <SelectWrapper>
      <SelectSingleInput
        label={label}
        value={value}
        onChange={(next) => {
          const option = options.find((item) => item.value === next);
          setSelected(option);
          onChange(next);
        }}
        options={options}
        disabled={disabled}
        required={required}
        error={error}
        helperText={helperText}
        fullWidth
        onSearchChange={setDraftSearch}
        searchPlaceholder={
          candidate ? t("rental:candidate_search") : t("rental:search")
        }
        onLoadMore={() => {
          if (results.hasNextPage && !results.isFetching)
            void results.fetchNextPage();
        }}
        hasMore={results.hasNextPage}
        loadingOptions={results.isFetching}
      />
    </SelectWrapper>
  );
}
