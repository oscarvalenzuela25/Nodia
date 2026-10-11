import { useId, type Ref } from "react";
import type { CountryCode } from "libphonenumber-js/max";
import PhoneCountryInput from "../PhoneCountryInput";
import type { TextInputProps } from "../TextInput/types";
import {
  InputContainer,
  LabelTypography,
  RequiredStar,
  StyledTextField,
} from "../TextInput/styles";
import { PhoneFields } from "./styles";

type Props = Omit<
  TextInputProps,
  "type" | "multiline" | "rows" | "minRows" | "maxRows"
> & {
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  ref?: Ref<HTMLInputElement>;
};
export default function PhoneInput({
  country,
  onCountryChange,
  label,
  value,
  onChange,
  onBlur,
  ref,
  name,
  id,
  required,
  disabled,
  error,
  helperText,
  placeholder,
  autoFocus,
  "data-testid": testId,
  dataTestId,
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <PhoneFields data-testid={testId ?? dataTestId}>
      <PhoneCountryInput
        id={inputId + "-country"}
        value={country}
        onChange={onCountryChange}
        disabled={disabled}
      />
      <InputContainer fullWidth>
        {label && (
          <LabelTypography htmlFor={inputId}>
            {label}
            {required && <RequiredStar aria-hidden="true">*</RequiredStar>}
          </LabelTypography>
        )}
        <StyledTextField
          id={inputId}
          name={name}
          type="tel"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          error={error}
          helperText={helperText}
          placeholder={placeholder}
          fullWidth
          autoFocus={autoFocus}
          slotProps={{
            htmlInput: {
              ref,
              "aria-required": required,
              autoComplete: "tel-national",
            },
          }}
        />
      </InputContainer>
    </PhoneFields>
  );
}
