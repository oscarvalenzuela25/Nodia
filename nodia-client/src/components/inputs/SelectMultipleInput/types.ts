import type { ReactNode } from "react";

export type SelectMultipleOption = {
  value: string;
  label: string;
};

export type SelectMultipleInputProps = {
  label?: string;
  options: Array<string | SelectMultipleOption>;
  /** Labels for selected records outside the loaded page; excluded from select-loaded actions. */
  selectedOptions?: SelectMultipleOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  onSearchChange?: (value: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingOptions?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  id?: string;
  name?: string;
  fullWidth?: boolean;
};
