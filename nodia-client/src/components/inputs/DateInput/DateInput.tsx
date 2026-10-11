import { useId, useState } from "react";
import type { Ref } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  Popover,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import type { TextInputProps } from "../TextInput/types";
import {
  InputContainer,
  LabelTypography,
  RequiredStar,
  StyledTextField,
} from "../TextInput/styles";
import { PickerSurface } from "./styles";

export type DateInputProps = Omit<
  TextInputProps,
  "onChange" | "type" | "multiline" | "rows" | "minRows" | "maxRows"
> & {
  displayLabel?: string;
  onChange: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
  minDate?: string;
  maxDate?: string;
};

// Civil dates stay strings throughout transport. Incomplete manual drafts are
// forwarded unchanged, so RHF/Zod remains authoritative and can show its error.
export default function DateInput({
  label,
  displayLabel,
  value,
  onChange,
  onBlur,
  disabled,
  error,
  helperText,
  required,
  id,
  name,
  ref,
  minDate,
  maxDate,
  fullWidth = true,
  dataTestId,
  "data-testid": testId,
  ...props
}: DateInputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const { t } = useTranslation();
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor) && !disabled;
  const close = () => setAnchor(null);
  const parsed =
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    dayjs(value).format("YYYY-MM-DD") === value
      ? dayjs(value)
      : null;
  const calendar = (
    <PickerSurface>
      <DateCalendar
        value={parsed}
        views={["year", "month", "day"]}
        openTo="day"
        minDate={dayjs(minDate ?? "1900-01-01")}
        maxDate={dayjs(maxDate ?? "9999-12-31")}
        onChange={(date, selectionState) => {
          onChange(date?.format("YYYY-MM-DD") ?? "");
          if (selectionState === "finish") close();
        }}
      />
    </PickerSurface>
  );
  return (
    <InputContainer fullWidth={fullWidth} data-testid={testId ?? dataTestId}>
      {label && (
        <LabelTypography htmlFor={inputId}>
          {displayLabel ?? label}
          {required && <RequiredStar>*</RequiredStar>}
        </LabelTypography>
      )}
      <StyledTextField
        {...props}
        id={inputId}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        error={error}
        helperText={helperText}
        placeholder={props.placeholder ?? "YYYY-MM-DD"}
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
                  aria-label={t("core:open_date_calendar", {
                    label: label ?? "",
                  })}
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  onClick={(event) => setAnchor(event.currentTarget)}
                >
                  <CalendarMonthOutlined />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      {open &&
        (mobile ? (
          <Dialog
            open
            onClose={close}
            fullWidth
            slotProps={{ paper: { "aria-label": label } }}
          >
            <DialogContent sx={{ p: 1 }}>{calendar}</DialogContent>
            <DialogActions>
              <Button onClick={close}>{t("core:close_date_calendar")}</Button>
            </DialogActions>
          </Dialog>
        ) : (
          <Popover
            open
            anchorEl={anchor}
            onClose={close}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { role: "dialog", "aria-label": label } }}
          >
            {calendar}
          </Popover>
        ))}
    </InputContainer>
  );
}
