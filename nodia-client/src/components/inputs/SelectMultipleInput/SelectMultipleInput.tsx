import type { FC, KeyboardEvent, MouseEvent } from "react";
import { useState, useMemo, useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Checkbox,
  Chip,
  Button,
  LinearProgress,
  IconButton,
  InputAdornment,
  ListItemText,
  Typography,
  Box,
  Tooltip,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import type { SelectMultipleInputProps, SelectMultipleOption } from "./types";
import {
  SelectContainer,
  LabelTypography,
  RequiredStar,
  SelectTrigger,
  SelectedChipsContainer,
  PlaceholderText,
  StyledPopover,
  SearchContainer,
  SearchField,
  OptionsList,
  StyledMenuItem,
  HelperTypography,
} from "./styles";

const SelectMultipleInput: FC<SelectMultipleInputProps> = ({
  label,
  options,
  selectedOptions,
  value = [],
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
}) => {
  const { t } = useTranslation("core");
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLabelCache, setSelectedLabelCache] = useState<Record<string, string>>({});

  const isOpen = Boolean(anchorEl);

  const normalizedOptions: SelectMultipleOption[] = useMemo(() => {
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

  const handleOpen = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled || loadingOptions) return;
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchTerm("");
    onSearchChange?.("");
  };

  const handleToggleOption = (optionValue: string) => {
    if (disabled || loadingOptions) return;
    const option = normalizedOptions.find((item) => item.value === optionValue);
    if (option) setSelectedLabelCache((labels) => ({ ...labels, [option.value]: option.label }));
    const isSelected = value.includes(optionValue);
    if (isSelected) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const isAllSelected = useMemo(() => {
    if (filteredOptions.length === 0) return false;
    return filteredOptions.every((opt) => value.includes(opt.value));
  }, [filteredOptions, value]);

  const isSomeSelected = useMemo(() => {
    return filteredOptions.some((opt) => value.includes(opt.value));
  }, [filteredOptions, value]);

  const handleToggleSelectAll = () => {
    if (disabled || loadingOptions || filteredOptions.length === 0) return;
    setSelectedLabelCache((labels) => ({ ...labels, ...Object.fromEntries(filteredOptions.map((option) => [option.value, option.label])) }));
    const visibleValues = new Set(filteredOptions.map((option) => option.value));
    onChange(isAllSelected ? value.filter((selected) => !visibleValues.has(selected))
      : Array.from(new Set([...value, ...visibleValues])));
  };

  const handleDeleteChip = (
    e: MouseEvent<unknown>,
    optionValue: string
  ) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
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

  const selectedLabelsMap = useMemo(() => {
    const map = new Map<string, string>(Object.entries(selectedLabelCache));
    selectedOptions?.forEach((opt) => map.set(opt.value, opt.label));
    normalizedOptions.forEach((opt) => map.set(opt.value, opt.label));
    return map;
  }, [normalizedOptions, selectedLabelCache, selectedOptions]);

  return (
    <SelectContainer fullWidth={fullWidth}>
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
        <SelectedChipsContainer>
          {value.length === 0 ? (
            <PlaceholderText>
              {placeholder ?? t("select_placeholder", "Seleccionar...")}
            </PlaceholderText>
          ) : (
            value.map((val) => {
              const displayLabel = selectedLabelsMap.get(val) ?? val;
              return (
                <Chip
                  key={val}
                  label={displayLabel}
                  size="small"
                  color="primary"
                  variant="outlined"
                  onDelete={
                    disabled || loadingOptions ? undefined : (e) => handleDeleteChip(e, val)
                  }
                  sx={{
                    borderRadius: "6px",
                    fontWeight: 500,
                    height: "26px",
                  }}
                />
              );
            })
          )}
        </SelectedChipsContainer>

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
            flexShrink: 0,
            ml: 1,
          })}
        />
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
          {normalizedOptions.length >= 2 && (
            <Tooltip
              title={
                isAllSelected
                  ? t(onSearchChange ? "deselect_loaded" : "deselect_all")
                  : t(onSearchChange ? "select_loaded" : "select_all")
              }
              arrow
              placement="top"
            >
              <Box sx={{ display: "inline-flex", alignItems: "center" }}>
                <Checkbox
                  size="small"
                  checked={isAllSelected}
                  indeterminate={isSomeSelected && !isAllSelected}
                  onChange={handleToggleSelectAll}
                  disabled={disabled || loadingOptions || filteredOptions.length === 0}
                  color="primary"
                  slotProps={{
                    input: {
                      "aria-label": isAllSelected
                        ? t(onSearchChange ? "deselect_loaded" : "deselect_all")
                        : t(onSearchChange ? "select_loaded" : "select_all"),
                    },
                  }}
                  sx={{
                    p: 0.5,
                    flexShrink: 0,
                  }}
                />
              </Box>
            </Tooltip>
          )}
        </SearchContainer>

        {loadingOptions && <LinearProgress sx={{ height: 2 }} />}
        <OptionsList role="listbox" aria-multiselectable="true">
          {filteredOptions.length === 0 ? (
            <Box sx={{ py: 2, px: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {t("no_options_found", "No se encontraron resultados")}
              </Typography>
            </Box>
          ) : (
            filteredOptions.map((opt) => {
              const isChecked = value.includes(opt.value);
              return (
                <StyledMenuItem
                  disabled={disabled || loadingOptions}
                  key={opt.value}
                  selected={isChecked}
                  onClick={() => handleToggleOption(opt.value)}
                >
                  <Checkbox
                    size="small"
                    checked={isChecked}
                    color="primary"
                    sx={{ p: 0.5 }}
                  />
                  <ListItemText
                    primary={opt.label}
                    slotProps={{
                      primary: {
                        variant: "body2",
                        sx: { fontWeight: isChecked ? 600 : 400 },
                      },
                    }}
                  />
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

export default SelectMultipleInput;
