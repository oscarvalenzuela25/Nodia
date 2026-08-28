import type { FC, ChangeEvent } from "react";
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
  fullWidth = false,
  size = "small",
  variant = "standard",
  className,
}) => {
  const { t } = useTranslation("core");

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  return (
    <SearchTextField
      value={value}
      onChange={handleChange}
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
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                aria-label="clear search"
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
