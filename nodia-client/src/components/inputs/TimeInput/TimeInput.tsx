import { useId, useState } from "react";
import type { Ref } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
} from "@mui/material";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import { MultiSectionDigitalClock } from "@mui/x-date-pickers/MultiSectionDigitalClock";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import type { TextInputProps } from "../TextInput/types";
import {
  InputContainer,
  LabelTypography,
  RequiredStar,
  StyledTextField,
} from "../TextInput/styles";
import { ClockSurface } from "./styles";
export type TimeInputProps = Omit<TextInputProps, "type" | "onChange"> & {
  displayLabel?: string;
  onChange: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
};
export default function TimeInput({
  label,
  displayLabel,
  id,
  name,
  value,
  onChange,
  onBlur,
  ref,
  disabled,
  error,
  helperText,
  required,
  fullWidth = true,
}: TimeInputProps) {
  const generated = useId();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const inputId = id ?? generated;
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  return (
    <InputContainer fullWidth={fullWidth}>
      {label && (
        <LabelTypography htmlFor={inputId}>
          {displayLabel ?? label}
          {required && <RequiredStar>*</RequiredStar>}
        </LabelTypography>
      )}
      <StyledTextField
        id={inputId}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder="HH:mm"
        disabled={disabled}
        error={error}
        helperText={helperText}
        fullWidth
        slotProps={{
          htmlInput: {
            ref,
            "aria-required": required,
            "aria-label": displayLabel ? label : undefined,
            inputMode: "text",
          },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  sx={{ minWidth: 44, minHeight: 44 }}
                  disabled={disabled}
                  aria-label={t("core:open_time_picker", {
                    label: label ?? "",
                  })}
                  aria-haspopup="dialog"
                  aria-expanded={open && !disabled}
                  onClick={() => setOpen(true)}
                >
                  <ScheduleOutlined />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      {open && !disabled && (
        <Dialog open onClose={() => setOpen(false)} aria-label={label}>
          <DialogContent>
            <ClockSurface>
              <MultiSectionDigitalClock
                value={valid ? dayjs("2000-01-01T" + value) : null}
                referenceDate={dayjs("2000-01-01T00:00")}
                ampm={false}
                views={["hours", "minutes"]}
                timeSteps={{ minutes: 1 }}
                onChange={(time) => onChange(time?.format("HH:mm") ?? "")}
              />
            </ClockSurface>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>
              {t("core:close_date_calendar")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </InputContainer>
  );
}
