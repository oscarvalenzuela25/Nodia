import type { FC, ReactNode } from "react";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Popover, IconButton, Chip, Box, Button } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { FilterHeader, FilterTitle, FilterActions } from "./styles";

type Props = {
  onFilter: () => void;
  onClear: () => void;
  children?: ReactNode;
};

const Filter: FC<Props> = ({ onFilter, onClear, children }) => {
  const { t } = useTranslation("core");
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const chipRef = useRef<HTMLDivElement | null>(null);

  const handleOpen = () => {
    if (chipRef.current) {
      setAnchorEl(chipRef.current);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleApply = () => {
    onFilter();
    handleClose();
  };

  const handleClear = () => {
    onClear();
    handleClose();
  };

  const open = Boolean(anchorEl);
  const id = open ? "filter-popover" : undefined;

  return (
    <>
      <Chip
        ref={chipRef}
        label={t("filter")}
        onClick={handleOpen}
        color="primary"
        sx={{
          color: "primary.contrastText",
          cursor: "pointer",
        }}
      />
      <Popover
        id={id}
        open={open}
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
            sx: { p: 2, minWidth: 320 },
          },
        }}
      >
        <FilterHeader>
          <FilterTitle>{t("filtering_by")}</FilterTitle>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </FilterHeader>
        <Box sx={{ my: 2 }}>
          {children}
        </Box>
        <FilterActions>
          <Button variant="outlined" color="error" onClick={handleClear}>
            {t("clear_filters")}
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" color="error" onClick={handleClose}>
              {t("cancel")}
            </Button>
            <Button variant="contained" color="primary" onClick={handleApply}>
              {t("filter")}
            </Button>
          </Box>
        </FilterActions>
      </Popover>
    </>
  );
};

export default Filter;
