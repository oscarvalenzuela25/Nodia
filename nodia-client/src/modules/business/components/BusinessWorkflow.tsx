import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

// Import previews retain a scrollable comparison grid. Their surrounding
// controls use the same single-column mobile ergonomics as the catalog.
const BusinessWorkflow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  minWidth: 0,
  overflowWrap: "anywhere",
  [theme.breakpoints.down("sm")]: {
    "& [data-business-toolbar]": {
      flexDirection: "column",
      alignItems: "stretch",
      width: "100%",
    },
    "& [data-business-toolbar] > span, & [data-business-toolbar] > .MuiBox-root":
      { width: "100%", flexWrap: "wrap", minWidth: 0 },
    "& [data-business-toolbar] button": { width: "100%", minHeight: 44 },
  },
}));
export default BusinessWorkflow;
