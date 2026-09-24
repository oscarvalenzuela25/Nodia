import type { FC, KeyboardEvent, MouseEvent } from "react";
import { useState, useMemo, useId } from "react";
import { useTranslation } from "react-i18next";
import {
  IconButton,
  InputAdornment,
  Typography,
  Box,
  Button,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";

import {
  AVAILABLE_ICONS,
  DEFAULT_MODULE_ICON_KEY,
  ICON_REGISTRY,
} from "../../../store/generalSettings/moduleIcons";
import type { IconSelectProps } from "./types";
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
  OptionsContainer,
  IconOptionButton,
  IconLabel,
  HelperTypography,
} from "./styles";

const IconSelect: FC<IconSelectProps> = ({
  label,
  value = null,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  error = false,
  helperText,
  id,
  fullWidth = true,
  clearable = true,
  defaultIconKey = DEFAULT_MODULE_ICON_KEY,
  "data-testid": dataTestIdProp,
  dataTestId,
}) => {
  const { t } = useTranslation(["modules", "core"]);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const testId = dataTestIdProp ?? dataTestId ?? "icon-select";

  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const isOpen = Boolean(anchorEl);

  const selectedDef = useMemo(() => {
    if (!value) return null;
    return AVAILABLE_ICONS.find((item) => item.key === value) ?? null;
  }, [value]);

  const defaultDef = useMemo(() => {
    return (
      AVAILABLE_ICONS.find((item) => item.key === defaultIconKey) ??
      AVAILABLE_ICONS[0]
    );
  }, [defaultIconKey]);

  const SelectedIconComponent = selectedDef
    ? selectedDef.Component
    : value && ICON_REGISTRY[value]
    ? ICON_REGISTRY[value]
    : null;

  const DefaultIconComponent = defaultDef?.Component ?? null;

  const filteredIcons = useMemo(() => {
    if (!searchTerm.trim()) return AVAILABLE_ICONS;
    const term = searchTerm.toLowerCase().trim();
    return AVAILABLE_ICONS.filter(
      (item) =>
        item.key.toLowerCase().includes(term) ||
        item.label.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const handleOpen = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchTerm("");
  };

  const handleSelectIcon = (iconKey: string | null) => {
    onChange(iconKey);
    handleClose();
  };

  const handleClear = (e: MouseEvent<unknown>) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isOpen) {
        setAnchorEl(e.currentTarget);
      }
    } else if (e.key === "Escape" && isOpen) {
      handleClose();
    }
  };

  const resolvedPlaceholder =
    placeholder ?? t("modules:form.icon_placeholder", "Por defecto (automático)");

  return (
    <SelectContainer fullWidth={fullWidth} data-testid={`${testId}-container`}>
      {label && (
        <LabelTypography htmlFor={inputId} required={required}>
          {label}
          {required && <RequiredStar>*</RequiredStar>}
        </LabelTypography>
      )}

      <SelectTrigger
        id={inputId}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label ?? "Selector de ícono"}
        isOpen={isOpen}
        isError={error}
        isDisabled={disabled}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        data-testid={`${testId}-trigger`}
      >
        <ValueContainer>
          {SelectedIconComponent ? (
            <>
              <SelectedIconComponent
                fontSize="small"
                color="primary"
                sx={{ flexShrink: 0 }}
              />
              <SelectedText>
                {selectedDef ? selectedDef.label : value} ({value})
              </SelectedText>
            </>
          ) : (
            <>
              {DefaultIconComponent && (
                <DefaultIconComponent
                  fontSize="small"
                  sx={{ color: "text.disabled", flexShrink: 0 }}
                />
              )}
              <PlaceholderText>{resolvedPlaceholder}</PlaceholderText>
            </>
          )}
        </ValueContainer>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          {clearable && Boolean(value) && !disabled && (
            <IconButton
              size="small"
              onClick={handleClear}
              aria-label={t("core:clear", "Limpiar selección")}
              data-testid={`${testId}-clear`}
              sx={{ p: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
          <KeyboardArrowDownIcon
            fontSize="small"
            sx={{
              color: "text.secondary",
              transition: "transform 0.2s ease",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </Box>
      </SelectTrigger>

      {helperText && (
        <HelperTypography isError={error}>{helperText}</HelperTypography>
      )}

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
              width: anchorEl ? `${Math.max(anchorEl.clientWidth, 480)}px` : 480,
              maxWidth: "min(640px, calc(100vw - 32px))",
              overflow: "hidden",
            },
          },
        }}
      >
        <SearchContainer>
          <SearchField
            size="small"
            fullWidth
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("modules:form.search_icon", "Buscar ícono...")}
            data-testid={`${testId}-search`}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm("")}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
          />
          <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
            <Button
              size="small"
              variant="text"
              color="inherit"
              startIcon={<BlockOutlinedIcon fontSize="small" />}
              onClick={() => handleSelectIcon(null)}
              data-testid={`${testId}-default-option`}
              sx={{
                textTransform: "none",
                fontSize: "0.75rem",
                color: !value ? "primary.main" : "text.secondary",
                fontWeight: !value ? 600 : 400,
              }}
            >
              {t("modules:form.default_icon", "Usar ícono por defecto")}
            </Button>
          </Box>
        </SearchContainer>

        <OptionsContainer role="listbox" data-testid={`${testId}-options`}>
          {filteredIcons.length === 0 ? (
            <Box
              sx={{
                gridColumn: "1 / -1",
                py: 4,
                textAlign: "center",
                color: "text.secondary",
              }}
            >
              <Typography variant="body2">
                {t("modules:form.no_icons_found", "No se encontraron íconos")}
              </Typography>
            </Box>
          ) : (
            filteredIcons.map((item) => {
              const isSelected = value === item.key;
              const IconComp = item.Component;

              return (
                <IconOptionButton
                  key={item.key}
                  role="option"
                  aria-selected={isSelected}
                  isSelected={isSelected}
                  onClick={() => handleSelectIcon(item.key)}
                  data-testid={`${testId}-option-${item.key}`}
                  title={`${item.label} (${item.key})`}
                >
                  <IconComp fontSize="medium" />
                  <IconLabel>{item.label}</IconLabel>
                </IconOptionButton>
              );
            })
          )}
        </OptionsContainer>
      </StyledPopover>
    </SelectContainer>
  );
};

export default IconSelect;
