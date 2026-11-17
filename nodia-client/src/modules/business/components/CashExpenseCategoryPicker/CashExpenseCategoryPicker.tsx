import { useEffect, useId, useState } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import HelpOutlineOutlined from "@mui/icons-material/HelpOutlineOutlined";
import { useTranslation } from "react-i18next";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { CashCategory, CashScope } from "../../infrastructure/cashTypes";
import { useCashCategoryOptions } from "../../infrastructure/useCashServices";
import { trimCashText } from "../../infrastructure/cashValues";
import { validCashSearch } from "../../pages/BusinessDetail/components/CashTab/cashFilters";
import { PickerRow } from "./styles";

export type CashCategoryOption = Pick<CashCategory, "id" | "name" | "is_active">;

interface Props {
  id?: string;
  scope: CashScope;
  selected: CashCategoryOption | null;
  onChange: (category: CashCategoryOption | null) => void;
  onQuickCreate: () => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

export function CashExpenseCategoryPicker({
  id, scope, selected, onChange, onQuickCreate, disabled = false, error, helperText,
}: Props) {
  const { t } = useTranslation("business");
  const descriptionId = useId();
  const [helpOpen, setHelpOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const searchValid = validCashSearch(search);

  useEffect(() => {
    if (!searchValid) return;
    const timer = window.setTimeout(() => setCommittedSearch(trimCashText(search)), 300);
    return () => window.clearTimeout(timer);
  }, [search, searchValid]);

  const query = useCashCategoryOptions(scope, { active: true, search: committedSearch }, !disabled);
  const categories = query.data?.pages.flatMap((page) => page.data) ?? [];
  const options = new Map<string, CashCategoryOption>(categories.map((category) => [category.id, category]));
  if (selected && !options.has(selected.id)) options.set(selected.id, selected);

  return (
    <Box sx={{ minWidth: 0 }}>
      <PickerRow>
        <SelectSingleInput
          id={id}
          label={t("business:cash.expense_category")}
          value={selected?.id ?? null}
          onChange={(value) => {
            if (value === null) onChange(null);
            else {
              const category = options.get(value);
              if (category?.is_active) onChange(category);
            }
          }}
          placeholder={t("business:cash.expense_category_empty")}
          options={[...options.values()].map((category) => ({
            value: category.id,
            label: category.is_active
              ? category.name
              : t("business:cash.category_inactive_option", { name: category.name }),
          }))}
          onSearchChange={setSearch}
          onLoadMore={() => {
            if (searchValid && !query.isFetching) void query.fetchNextPage();
          }}
          hasMore={searchValid && query.hasNextPage}
          loadingOptions={query.isFetching}
          disabled={disabled}
          error={error || !searchValid}
          helperText={!searchValid ? t("business:cash.search_invalid") : helperText}
          fullSizeClear
          labelAdornment={
            <Tooltip title={t("business:cash.expense_category_help_label")}>
              <span>
                <IconButton
                  aria-label={t("business:cash.expense_category_help_label")}
                  aria-expanded={helpOpen}
                  aria-controls={descriptionId}
                  disabled={disabled}
                  onClick={() => setHelpOpen((previous) => !previous)}
                  sx={{ width: 44, height: 44 }}
                  size="small"
                >
                  <HelpOutlineOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          }
        />
        <Tooltip title={t("business:cash.category_add")}>
          <span>
            <IconButton
              aria-label={t("business:cash.category_add")}
              color="primary"
              onClick={onQuickCreate}
              disabled={disabled || query.isFetching}
              sx={{ mt: "50px", width: 44, height: 44, border: 1, borderColor: "divider", borderRadius: 2 }}
            >
              <AddOutlined />
            </IconButton>
          </span>
        </Tooltip>
      </PickerRow>
      <Typography id={descriptionId} hidden={!helpOpen} variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        {t("business:cash.expense_category_help")}
      </Typography>
      <QueryErrorAlert isError={query.isError} isFetching={disabled || query.isFetching} onRetry={query.refetch} />
    </Box>
  );
}
