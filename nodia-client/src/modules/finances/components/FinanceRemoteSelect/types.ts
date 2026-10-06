import type { FinanceActive } from "../../types";
export type FinanceRemoteResource =
  "categories" | "category-groups" | "obligations";
export type FinanceRemoteOption = {
  id: string;
  name: string;
  key?: string;
  is_active?: boolean;
  type?: "loan" | "debt";
};
export type FinanceSelectionState = { busy: boolean; invalid: boolean };
export type FinanceRemoteSelectProps = {
  resource: FinanceRemoteResource;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  enabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  selectedOption?: FinanceRemoteOption;
  active?: FinanceActive;
  /** Filters can retain valid IDs without hydrating each selected item. Forms require resolution. */
  allowUnresolved?: boolean;
  onSelectionStateChange?: (state: FinanceSelectionState) => void;
  onOptionsResolved?: (options: FinanceRemoteOption[]) => void;
};
export type FinanceRemoteMultiSelectProps = Omit<
  FinanceRemoteSelectProps,
  "value" | "onChange" | "selectedOption"
> & {
  value: string[];
  onChange: (value: string[]) => void;
  selectedOptions?: FinanceRemoteOption[];
};
