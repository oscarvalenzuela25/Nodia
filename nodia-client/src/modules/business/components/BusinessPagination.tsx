import { TablePagination } from "@mui/material";
import { styled } from "@mui/material/styles";
import type { TablePaginationProps } from "@mui/material";
import { useTranslation } from "react-i18next";
const ResponsivePagination = styled(TablePagination)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    "& .MuiTablePagination-actions .MuiIconButton-root": { width: 44, height: 44 },
    "& .MuiSelect-select": { minHeight: 44, boxSizing: "border-box", display: "flex", alignItems: "center" },
  },
}));
export default function BusinessPagination(props: TablePaginationProps<"div">) {
  const { t } = useTranslation();
  return (
    <ResponsivePagination
      getItemAriaLabel={(type) => t(`core:pagination.page_${type}`)}
      {...props}
    />
  );
}
