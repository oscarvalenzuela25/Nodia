import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import QueryErrorAlert from "../../../../../../../components/QueryErrorAlert";
import SelectSingleInput from "../../../../../../../components/inputs/SelectSingleInput";
import { usePagedProductCodeOptions } from "../../../../../infrastructure/usePagedOptions";

export interface ProductCodeFilterValue {
  presence: "present" | "missing" | null;
  code: string | null;
}

interface Props {
  businessId: string;
  field: "code" | "barcode";
  value: ProductCodeFilterValue;
  onChange: (value: ProductCodeFilterValue) => void;
  disabled: boolean;
}

export default function ProductCodeFilter({ businessId, field, value, onChange, disabled }: Props) {
  const { t } = useTranslation("business");
  const query = usePagedProductCodeOptions(businessId, field);
  const isBarcode = field === "barcode";
  const searchLabel = t(isBarcode ? "product_barcode_search" : "product_invoice_code_search");
  const emptyOptionsContent = query.isError ? (
    <Box sx={{ p: 1 }}>
      <QueryErrorAlert isError isFetching={query.isFetching} onRetry={query.refetch} />
    </Box>
  ) : (
    <Typography role="status" variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
      {query.isSearching ? t("product_code_searching") : !query.hasSearch ? t("product_code_search_prompt") : t("core:no_options_found")}
    </Typography>
  );

  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <SelectSingleInput
        label={t(isBarcode ? "product_barcode_presence" : "product_code_presence")}
        value={value.presence ?? "all"}
        options={[
          { value: "all", label: t("product_presence_all") },
          { value: "present", label: t("product_presence_present") },
          { value: "missing", label: t("product_presence_missing") },
        ]}
        clearable={false}
        disabled={disabled}
        onChange={(option) => {
          const presence = option === "present" || option === "missing" ? option : null;
          if (presence === "missing") query.setSearch("");
          onChange({ presence, code: presence === "missing" ? null : value.code });
        }}
      />
      {value.presence !== "missing" && (
        <SelectSingleInput
          label={searchLabel}
          searchPlaceholder={searchLabel}
          value={value.code}
          options={query.options}
          disabled={disabled}
          onChange={(code) => onChange({ ...value, code })}
          onSearchChange={query.setSearch}
          hasMore={query.hasNextPage}
          onLoadMore={() => { void query.fetchNextPage(); }}
          loadingOptions={query.isSearching}
          searchWhileLoading
          emptyOptionsContent={emptyOptionsContent}
        />
      )}
    </Box>
  );
}
