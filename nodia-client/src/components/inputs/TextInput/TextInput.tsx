import type { FC } from "react";
import { useId } from "react";
import type { TextInputProps } from "./types";
import {
  InputContainer,
  LabelTypography,
  RequiredStar,
  StyledTextField,
} from "./styles";

const TextInput: FC<TextInputProps> = ({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
  error = false,
  helperText,
  id,
  name,
  fullWidth = true,
  autoFocus = false,
}) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <InputContainer fullWidth={fullWidth}>
      {label && (
        <LabelTypography htmlFor={inputId}>
          {label}
          {required && <RequiredStar>*</RequiredStar>}
        </LabelTypography>
      )}
      <StyledTextField
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        error={error}
        helperText={helperText}
        fullWidth
        autoFocus={autoFocus}
        variant="outlined"
      />
    </InputContainer>
  );
};

export default TextInput;
