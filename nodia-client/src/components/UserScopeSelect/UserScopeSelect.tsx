import { useEffect, useState } from "react";
import { Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../inputs/SelectSingleInput";
import { useScopeUsers } from "./infrastructure/useServices";
import { Wrapper } from "./styles";

type Props = {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  enabled?: boolean;
  activeOnly?: boolean;
};
export default function UserScopeSelect({
  value,
  onChange,
  disabled = false,
  enabled = true,
  activeOnly = false,
}: Props) {
  const { t } = useTranslation("core");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const { list, selected } = useScopeUsers(
    debounced,
    value,
    enabled,
    activeOnly,
  );
  const users = new Map(
    [
      ...(selected.data?.data ?? []),
      ...(list.data?.pages.flatMap((page) => page.data) ?? []),
    ].map((user) => [user.id, user]),
  );
  const failed = list.isError || selected.isError;
  const loading = list.isFetching || selected.isFetching;
  return (
    <Wrapper>
      <SelectSingleInput
        label={t("data_owner")}
        value={value}
        clearable={false}
        fullWidth
        options={[...users.values()].map((user) => ({
          value: user.id,
          label: `${user.name ? `${user.name} (${user.email})` : user.email}${user.is_active === false ? ` · ${t("inactive")}` : ""}`,
        }))}
        onChange={(id) => {
          if (id) onChange(id);
        }}
        disabled={disabled || loading || !enabled}
        searchPlaceholder={t("search_owner_email")}
        onSearchChange={setSearch}
        onLoadMore={() => {
          void list.fetchNextPage();
        }}
        hasMore={list.hasNextPage}
        loadingOptions={loading}
      />
      {failed && (
        <Button
          disabled={disabled || loading}
          onClick={() => {
            void list.refetch();
            void selected.refetch();
          }}
        >
          {t("retry")}
        </Button>
      )}
    </Wrapper>
  );
}
