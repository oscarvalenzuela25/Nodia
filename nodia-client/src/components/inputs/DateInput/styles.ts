import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
export const PickerSurface = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  ".MuiDateCalendar-root": { width: "100%", maxWidth: 320 },
  ".MuiPickersCalendarHeader-root": {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  [theme.breakpoints.down("sm")]: {
    padding: 0,
    ".MuiPickersDay-root": { width: 32, height: 40 },
  },
}));
