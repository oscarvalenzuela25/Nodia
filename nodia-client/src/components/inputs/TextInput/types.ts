import type { ChangeEventHandler, ReactNode, FocusEventHandler } from "react";

export type TextInputProps = {
  label?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onBlur?: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
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
  multiline?: boolean;
  rows?: number;
  minRows?: number;
  maxRows?: number;
};
