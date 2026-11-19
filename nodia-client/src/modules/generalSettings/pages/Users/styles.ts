import { styled } from "@mui/material/styles";
import {
  Box,
  TablePagination,
} from "@mui/material";

export const PageHeader = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
}));

export {
  PageTitleContainer,
  PageTitle,
  PageSubtitle,
  StyledTableContainer,
} from "../../styles";

export const FilterRow = styled(Box)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: { "& > button": { minHeight: 44 } },
  marginBottom: theme.spacing(2),
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
}));

export const ActiveFilters = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(3),
}));

export const TableTopBar = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: theme.spacing(2.5),
  gap: theme.spacing(2),
  flexWrap: "wrap",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "stretch",
    "& > *": {
      width: "100%",
    },
    "& button": {
      width: "100%",
    },
  },
}));

export const UserInfo = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

export const MobileList = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  minWidth: 0,
}));
export const AssignmentList = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(0.5),
  "& .MuiChip-root": { maxWidth: "100%", height: "auto", minHeight: 24 },
  "& .MuiChip-label": {
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    paddingBlock: theme.spacing(0.5),
  },
}));
export const ListPagination = TablePagination;
