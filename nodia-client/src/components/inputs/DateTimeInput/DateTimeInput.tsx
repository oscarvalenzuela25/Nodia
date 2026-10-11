import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import DateInput from "../DateInput";
import TimeInput from "../TimeInput";
import type { TimeInputProps } from "../TimeInput";
import {
  localDateTimeToInstant,
  toLocalDateTime,
} from "../../../utils/civilDates";
import { DateTimeFields, DateTimeRow, GroupLabel } from "./styles";
type Props = Omit<TimeInputProps, "displayLabel"> & { timezone: string };
export default function DateTimeInput({
  value,
  onChange,
  label,
  timezone,
  name,
  id,
  ref,
  ...props
}: Props) {
  const { t } = useTranslation();
  let local = value;
  try {
    if (value) local = toLocalDateTime(value, timezone);
  } catch {
    /* Keep invalid drafts editable and visible to the resolver. */
  }
  const [date = "", time = ""] = local.split("T");
  const change = (day: string, hour: string) => {
    if (!day && !hour) {
      onChange("");
      return;
    }
    const draft = `${day}T${hour}`;
    try {
      onChange(localDateTimeToInstant(draft, timezone));
    } catch {
      onChange(draft);
    }
  };
  return (
    <DateTimeFields role="group" aria-label={label}>
      {label && <GroupLabel>{label}</GroupLabel>}
      <DateTimeRow>
        <DateInput
          {...props}
          ref={ref}
          id={id}
          name={name}
          label={t("core:date_time_date", { label: label ?? "" })}
          displayLabel={t("core:date_label")}
          value={date}
          onChange={(day) => change(day, time)}
        />
        <TimeInput
          {...props}
          name={name ? name + "-time" : undefined}
          label={t("core:date_time_time", { label: label ?? "" })}
          displayLabel={t("core:time_label")}
          value={time}
          onChange={(hour) => change(date, hour)}
        />
      </DateTimeRow>
      <Typography variant="caption" color="text.secondary">
        {timezone}
      </Typography>
    </DateTimeFields>
  );
}
