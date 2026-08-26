import type { FC, ReactNode } from "react";
import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { ChipWrapper } from "./styles";

type Props = {
  label: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
};

const FilterChips: FC<Props> = ({ label, onAction, actionIcon }) => {
  return (
    <ChipWrapper>
      {label}
      {onAction && (
        <IconButton 
          size="small" 
          onClick={onAction}
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
