import type { FC, ReactNode } from "react";
import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { ChipWrapper } from "./styles";

type Props = {
  label: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
  disabled?: boolean;
};

const FilterChips: FC<Props> = ({ label, onAction, actionIcon, disabled = false }) => {
  const { t } = useTranslation("core");
  return (
    <ChipWrapper>
      {label}
      {onAction && (
        <IconButton 
          size="small" 
          onClick={onAction}
          disabled={disabled}
          aria-label={t("remove_filter", { label })}
          sx={{ color: "inherit", p: 0 }}
          data-testid="filter-chip-action"
        >
          {actionIcon || <CloseIcon fontSize="small" />}
        </IconButton>
      )}
    </ChipWrapper>
  );
};

export default FilterChips;
