export interface IconSelectProps {
  label?: string;
  value?: string | null;
  onChange: (iconKey: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  id?: string;
  fullWidth?: boolean;
  clearable?: boolean;
  defaultIconKey?: string;
  "data-testid"?: string;
  dataTestId?: string;
}
