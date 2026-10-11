export type ActiveFilterStatus = "active" | "inactive" | "all";

export type ActiveStatusSelectProps = {
  value?: ActiveFilterStatus;
  onChange: (value: ActiveFilterStatus) => void;
  disabled?: boolean;
};
