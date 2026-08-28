import type { ChangeEventHandler, ReactNode, FocusEventHandler } from "react";

export type TextInputProps = {
  label?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  id?: string;
  name?: string;
  fullWidth?: boolean;
  autoFocus?: boolean;
};
