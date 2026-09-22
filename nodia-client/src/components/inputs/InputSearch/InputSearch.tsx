import type { FC, ChangeEvent, FocusEvent } from "react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { InputAdornment, IconButton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import type { InputSearchProps } from "./types";
import { SearchTextField } from "./styles";

const InputSearch: FC<InputSearchProps> = ({
  value,
  onChange,
  placeholder,
  onClear,
  disabled = false,
  fullWidth = true,
  size = "small",
  variant = "standard",
  className,
  debounceMs = 300,
  onFocus,
  onBlur,
  autoFocus = false,
}) => {
  const { t } = useTranslation("core");
  const [prevValue, setPrevValue] = useState<string>(value);
  const [internalValue, setInternalValue] = useState<string>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isFocusedRef = useRef<boolean>(false);
  const wasFocusedBeforeDisabledRef = useRef<boolean>(false);

  if (value !== prevValue) {
    setPrevValue(value);
    setInternalValue(value);
  }

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Cleanup pending timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Restore focus if the input was focused before being disabled
  useEffect(() => {
    if (disabled) {
      if (isFocusedRef.current) {
        wasFocusedBeforeDisabledRef.current = true;
      }
    } else if (wasFocusedBeforeDisabledRef.current) {
      wasFocusedBeforeDisabledRef.current = false;
      isFocusedRef.current = true;
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    isFocusedRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (debounceMs <= 0) {
      onChangeRef.current(newValue);
      inputRef.current?.focus();
      return;
    }

    timerRef.current = setTimeout(() => {
      onChangeRef.current(newValue);
      // Ensure focus remains on input after search execution
      if (isFocusedRef.current) {
        inputRef.current?.focus();
      }
    }, debounceMs);
  };

  const handleClear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setInternalValue("");
    onChangeRef.current("");
    onClear?.();
    isFocusedRef.current = true;
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    onFocus?.(e);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (!disabled) {
      isFocusedRef.current = false;
    }
    onBlur?.(e);
  };

  return (
    <SearchTextField
      inputRef={inputRef}
      value={internalValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      autoFocus={autoFocus}
      placeholder={placeholder ?? t("search", "Buscar...")}
      disabled={disabled}
      fullWidth={fullWidth}
      size={size}
      className={className}
      variant={variant}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: "text.secondary", mr: 0.5 }} />
            </InputAdornment>
          ),
          endAdornment: internalValue ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                aria-label="clear search"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClear}
                edge="end"
                sx={{ p: 0.5 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  );
};

export default InputSearch;
