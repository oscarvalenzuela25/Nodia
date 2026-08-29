export type SelectSingleOption = {
  value: string;
  label: string;
  category?: string;
};

export type SelectSingleInputProps = {
  id?: string;
  label?: string;
  options: (SelectSingleOption | string)[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  clearable?: boolean;
};
