import type { ThemeOptions } from "@mui/material/styles";

type ZIndex = ThemeOptions["zIndex"];

const zIndex: ZIndex = {
  mobileStepper: 1000,
  fab: 1050,
  speedDial: 1050,
  appBar: 1100,
  drawer: 1200,
  modal: 1300,
  snackbar: 1400,
  tooltip: 1500,
};

export default zIndex;
