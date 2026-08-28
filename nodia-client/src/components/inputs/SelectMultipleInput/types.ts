import type { ReactNode } from "react";

export type SelectMultipleOption = {
  value: string;
  label: string;
};

export type SelectMultipleInputProps = {
  label?: string;
  options: Array<string | SelectMultipleOption>;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  id?: string;
  name?: string;
  fullWidth?: boolean;
};
