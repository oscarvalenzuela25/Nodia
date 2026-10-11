import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import ActiveStatusSelect from "../../../../components/Filter/components/ActiveStatusSelect";

type Status = "active" | "inactive" | null;
export default function BusinessStatusFilter({
  value,
  onChange,
  disabled = false,
  layout = "inline",
}: {
  value: Status;
  onChange: (value: Status) => void;
  disabled?: boolean;
  layout?: "inline" | "stacked";
}) {
  const { t } = useTranslation(["business", "core"]);
  const [draft, setDraft] = useState<Status>(value);
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: layout === "stacked" ? "column" : "row",
        alignItems: layout === "stacked" ? "flex-start" : "center",
        gap: layout === "stacked" ? 2 : 1,
        flexWrap: "wrap",
        width: { xs: "100%", sm: "auto" },
      }}
    >
      <Filter
        disabled={disabled}
        activeCount={value === null ? 0 : 1}
        onOpen={() => setDraft(value)}
        onFilter={() => onChange(draft)}
        onClear={() => {
          setDraft("active");
          onChange("active");
        }}
      >
        <ActiveStatusSelect
          value={draft ?? "all"}
          onChange={(next) => setDraft(next === "all" ? null : next)}
          disabled={disabled}
        />
      </Filter>
      {value !== null && (
        <FilterChips
          label={
            layout === "stacked"
              ? t("business:filter_chips_status", {
                  value: t(
                    value === "active"
                      ? "business:status_active"
                      : "business:status_inactive",
                  ),
                })
              : t(
                  value === "active"
                    ? "business:status_active"
                    : "business:status_inactive",
                )
          }
          onAction={() => onChange(null)}
          disabled={disabled}
        />
      )}
    </Box>
  );
}
