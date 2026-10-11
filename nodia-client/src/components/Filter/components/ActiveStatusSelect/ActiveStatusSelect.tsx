import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../inputs/SelectSingleInput";
import type { ActiveStatusSelectProps } from "./types";
import { StatusField } from "./styles";

export default function ActiveStatusSelect({
  value = "active",
  onChange,
  disabled = false,
}: ActiveStatusSelectProps) {
  const { t } = useTranslation("core");
  return (
    <StatusField>
      <SelectSingleInput
        label={t("core:active_filter.label")}
        value={value}
        options={[
          { value: "active", label: t("core:active_filter.active") },
          { value: "inactive", label: t("core:active_filter.inactive") },
          { value: "all", label: t("core:active_filter.all") },
        ]}
        onChange={(next) => {
          if (next === "active" || next === "inactive" || next === "all") {
            onChange(next);
          }
        }}
        clearable={false}
        disabled={disabled}
        fullWidth
      />
    </StatusField>
  );
}
