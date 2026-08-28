export type InputSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
  variant?: "standard" | "outlined" | "filled";
  className?: string;
};
