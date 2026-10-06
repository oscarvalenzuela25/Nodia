import type { FC, ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Box } from "@mui/material";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import BaseModal from "../BaseModal";
import {
  FilterTrigger,
  FilterBadge,
  FilterActionsContainer,
  FilterRightActions,
} from "./styles";

type Props = {
  onFilter: () => void;
  onClear: () => void;
  children?: ReactNode;
  activeCount?: number;
  title?: string;
  subtitle?: string;
  triggerLabel?: string;
  disabled?: boolean;
  applyDisabled?: boolean;
  onOpen?: () => void;
};

const Filter: FC<Props> = ({
  onFilter,
  onClear,
  children,
  activeCount = 0,
  title,
  subtitle,
  triggerLabel,
  disabled = false,
  applyDisabled = false,
  onOpen,
}) => {
  const { t } = useTranslation("core");
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleOpen = () => {
    if (!disabled) {
      onOpen?.();
      setIsOpen(true);
    }
  };
  const handleClose = () => setIsOpen(false);

  const handleApply = () => {
    if (disabled || applyDisabled) return;
    onFilter();
    handleClose();
  };

  const handleClear = () => {
    if (disabled) return;
    onClear();
    handleClose();
  };

  const hasActiveFilters = activeCount > 0;

  const modalActions = (
    <FilterActionsContainer>
      <Button
        variant="outlined"
        color="error"
        onClick={handleClear}
        disabled={disabled}
        sx={{ borderRadius: 2 }}
      >
        {t("clear_filters", "Limpiar filtros")}
      </Button>
      <FilterRightActions>
        <Button
          variant="contained"
          color="error"
          onClick={handleClose}
          sx={(theme) => ({
            color: theme.palette.error.contrastText,
            borderRadius: 2,
          })}
        >
          {t("cancel", "Cancelar")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleApply}
          disabled={disabled || applyDisabled}
          sx={(theme) => ({
            color: theme.palette.primary.contrastText,
            borderRadius: 2,
          })}
        >
          {t("filter_action", "Filtrar")}
        </Button>
      </FilterRightActions>
    </FilterActionsContainer>
  );

  return (
    <>
      <FilterTrigger
        onClick={handleOpen}
        disabled={disabled}
        hasActiveFilters={hasActiveFilters}
        aria-label={triggerLabel ?? t("open_filters")}
      >
        <TuneOutlinedIcon fontSize="small" />
        <span>{triggerLabel ?? t("filter", "Filtro")}</span>
        {hasActiveFilters && <FilterBadge>{activeCount}</FilterBadge>}
      </FilterTrigger>

      <BaseModal
        open={isOpen}
        onClose={handleClose}
        title={title ?? t("filtering_by", "Filtrando por")}
        subtitle={subtitle}
        size="sm"
        actions={modalActions}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, py: 1 }}>
          {children}
        </Box>
      </BaseModal>
    </>
  );
};

export default Filter;
