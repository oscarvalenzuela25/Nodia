import { TablePagination } from "@mui/material";
import type { TablePaginationProps } from "@mui/material";
import { useTranslation } from "react-i18next";
export default function BusinessPagination(props: TablePaginationProps<"div">) {
  const { t } = useTranslation();
  return (
    <TablePagination
      getItemAriaLabel={(type) => t(`core:pagination.page_${type}`)}
      {...props}
    />
  );
}
