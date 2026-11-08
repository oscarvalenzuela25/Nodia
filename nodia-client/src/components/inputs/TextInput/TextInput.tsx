import type { FC } from "react";
import { useId } from "react";
import { Box } from "@mui/material";
import type { TextInputProps } from "./types";
import {
  InputContainer,
  LabelTypography,
  RequiredStar,
  StyledTextField,
} from "./styles";

const TextInput: FC<TextInputProps> = ({
  label,
  labelAdornment,
  value,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  type = "text",
  inputMode,
  placeholder,
  required = false,
  disabled = false,
  error = false,
  helperText,
  endAdornment,
  "aria-describedby": ariaDescribedBy,
  id,
  name,
  fullWidth = true,
  autoFocus = false,
  multiline = false,
  rows,
  minRows,
  maxRows,
  "data-testid": dataTestIdProp,
  dataTestId,
}) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const testId = dataTestIdProp ?? dataTestId;

  return (
    <InputContainer fullWidth={fullWidth} data-testid={testId}>
      {label && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
          <LabelTypography htmlFor={inputId}>
            {label}
            {required && <RequiredStar>*</RequiredStar>}
          </LabelTypography>
          {labelAdornment}
        </Box>
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
        slotProps={{ input: { endAdornment }, htmlInput: { onFocus, onKeyDown, inputMode, ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}) } }}
        fullWidth
        autoFocus={autoFocus}
        variant="outlined"
        multiline={multiline}
        rows={rows}
        minRows={minRows}
        maxRows={maxRows}
      />
    </InputContainer>
  );
};

export default TextInput;
