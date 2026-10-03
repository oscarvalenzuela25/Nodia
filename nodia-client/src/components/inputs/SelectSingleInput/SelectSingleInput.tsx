import type { FC, KeyboardEvent, MouseEvent } from "react";
import { useState, useMemo, useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  LinearProgress,
  IconButton,
  InputAdornment,
  ListItemText,
  Typography,
  Box,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import type { SelectSingleInputProps, SelectSingleOption } from "./types";
import {
  SelectContainer,
  LabelTypography,
  RequiredStar,
  SelectTrigger,
  ValueContainer,
  SelectedText,
  PlaceholderText,
  StyledPopover,
  SearchContainer,
  SearchField,
  OptionsList,
  StyledMenuItem,
  HelperTypography,
} from "./styles";

const SelectSingleInput: FC<SelectSingleInputProps> = ({
  label,
  options,
  value = null,
  onChange,
  placeholder,
  searchPlaceholder,
  disabled = false,
  onSearchChange, onLoadMore, hasMore = false, loadingOptions = false,
  required = false,
  error = false,
  helperText,
  id,
  fullWidth = true,
  clearable = true,
  "data-testid": dataTestIdProp,
  dataTestId,
}) => {
  const { t } = useTranslation("core");
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const testId = dataTestIdProp ?? dataTestId;

  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<SelectSingleOption | null>(null);

  const isOpen = Boolean(anchorEl);

  const normalizedOptions: SelectSingleOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === "string") {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (onSearchChange || !searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term)
    );
  }, [normalizedOptions, searchTerm, onSearchChange]);

  const selectedOption = useMemo(() => {
    if (!value) return null;
    return normalizedOptions.find((opt) => opt.value === value) ?? (selectedLabel?.value === value ? selectedLabel : { value, label: value });
  }, [normalizedOptions, value, selectedLabel]);

  const handleOpen = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled || loadingOptions) return;
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchTerm("");
    onSearchChange?.("");
  };

  const handleSelectOption = (optionValue: string) => {
    if (disabled || loadingOptions) return;
    setSelectedLabel(normalizedOptions.find((option) => option.value === optionValue) ?? null);
    onChange(optionValue);
    handleClose();
  };

  const handleClear = (e: MouseEvent<unknown>) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleClearSearch = (e: MouseEvent<unknown>) => {
    e.stopPropagation();
    setSearchTerm("");
    onSearchChange?.("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || loadingOptions) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen) {
        setAnchorEl(e.currentTarget);
      }
    } else if (e.key === "Escape" && isOpen) {
      handleClose();
    }
  };

  return (
    <SelectContainer fullWidth={fullWidth} data-testid={testId}>
      {label && (
        <LabelTypography htmlFor={inputId} required={required}>
          {label}
          {required && <RequiredStar>*</RequiredStar>}
        </LabelTypography>
      )}

      <SelectTrigger
        id={inputId}
        role="button"
        aria-label={label}
        tabIndex={disabled || loadingOptions ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled || loadingOptions}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        isOpen={isOpen}
        isError={error}
        isDisabled={disabled || loadingOptions}
      >
        <ValueContainer>
          {selectedOption ? (
            <SelectedText>{selectedOption.label}</SelectedText>
          ) : (
            <PlaceholderText>
              {placeholder ?? t("select_placeholder", "Seleccionar...")}
            </PlaceholderText>
          )}
        </ValueContainer>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          {clearable && selectedOption && !disabled && (
            <IconButton
              size="small"
              aria-label="clear selection"
              onClick={handleClear}
              sx={{ p: 0.25 }}
            >
              <CloseIcon fontSize="small" sx={{ fontSize: "1rem" }} />
            </IconButton>
          )}
          <KeyboardArrowDownIcon
            fontSize="small"
            sx={(theme) => ({
              color: error
                ? theme.palette.error.main
                : isOpen
                ? theme.palette.primary.main
                : theme.palette.text.secondary,
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: theme.transitions.create("transform", {
                duration: theme.transitions.duration.shorter,
              }),
            })}
          />
        </Box>
      </SelectTrigger>

      <StyledPopover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        slotProps={{
          paper: {
            sx: {
              width: anchorEl ? anchorEl.clientWidth : "auto",
              minWidth: 260,
            },
          },
        }}
      >
        <SearchContainer onClick={(e) => e.stopPropagation()}>
          <SearchField
            autoFocus
            fullWidth
            size="small"
            value={searchTerm}
            disabled={loadingOptions}
            onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
            placeholder={searchPlaceholder ?? t("search", "Buscar...")}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      aria-label={t("clear_search")}
                      onClick={handleClearSearch}
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
        </SearchContainer>

        {loadingOptions && <LinearProgress sx={{ height: 2 }} />}
        <OptionsList role="listbox" aria-multiselectable="false">
          {filteredOptions.length === 0 ? (
            <Box sx={{ py: 2, px: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {t("no_options_found", "No se encontraron resultados")}
              </Typography>
            </Box>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <StyledMenuItem
                  disabled={disabled || loadingOptions}
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  selected={isSelected}
                  onClick={() => handleSelectOption(opt.value)}
                >
                  <ListItemText
                    primary={opt.label}
                    slotProps={{
                      primary: {
                        variant: "body2",
                        sx: { fontWeight: isSelected ? 600 : 400 },
                      },
                    }}
                  />
                  {isSelected && (
                    <CheckIcon
                      fontSize="small"
                      sx={{ color: "primary.main", fontSize: "1.1rem" }}
                    />
                  )}
                </StyledMenuItem>
              );
            })
          )}
        </OptionsList>
        {hasMore && <Button fullWidth disabled={loadingOptions || disabled} onClick={onLoadMore}>{t("load_more")}</Button>}
      </StyledPopover>

      {helperText && (
        <HelperTypography isError={error}>{helperText}</HelperTypography>
      )}
    </SelectContainer>
  );
};

export default SelectSingleInput;
