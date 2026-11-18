import { useTranslation } from "react-i18next";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import TextInput from "../../../../../../../components/inputs/TextInput";
import { StyledFormControlLabel, StyledSwitch, SwitchWrapper } from "./styles";
import type { CategoryFields } from "./fields";

export function CashActiveField({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation("business");
  return (
    <SwitchWrapper>
      <StyledFormControlLabel
        label={t("business:status_active")}
        labelPlacement="start"
        control={
          <StyledSwitch
            checked={checked}
            disabled={disabled}
            onChange={(_, value) => onChange(value)}
          />
        }
      />
    </SwitchWrapper>
  );
}

export function CashTextField<Fields extends FieldValues>({
  control,
  name,
  label,
  disabled,
  multiline,
  required = true,
  autoFocus,
  type,
}: {
  control: Control<Fields>;
  name: FieldPath<Fields>;
  label: string;
  disabled: boolean;
  multiline?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  type?: "date" | "amount";
}) {
  const { t } = useTranslation("business");
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextInput
          name={field.name}
          label={label}
          value={field.value}
          onBlur={field.onBlur}
          onChange={field.onChange}
          disabled={disabled}
          multiline={multiline}
          rows={multiline ? 3 : undefined}
          autoFocus={autoFocus}
          type={type === "date" ? "date" : undefined}
          inputMode={type === "amount" ? "numeric" : undefined}
          error={!!fieldState.error}
          helperText={fieldState.error?.message && t(fieldState.error.message)}
          required={required}
        />
      )}
    />
  );
}

export function CashCategoryFields({
  control,
  disabled,
  hideActivity = false,
}: {
  control: Control<CategoryFields>;
  disabled: boolean;
  hideActivity?: boolean;
}) {
  const { t } = useTranslation("business");
  return (
    <>
      <CashTextField
        control={control}
        name="name"
        label={t("business:cash.category_name")}
        disabled={disabled}
        autoFocus
      />
      <CashTextField
        control={control}
        name="description"
        label={t("business:description_label")}
        disabled={disabled}
        multiline
        required={false}
      />
      {!hideActivity && (
        <Controller
          name="is_active"
          control={control}
          render={({ field }) => (
            <CashActiveField checked={field.value} disabled={disabled} onChange={field.onChange} />
          )}
        />
      )}
    </>
  );
}
