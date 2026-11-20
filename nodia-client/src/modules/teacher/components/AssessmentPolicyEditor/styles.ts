import { Box, styled } from "@mui/material";
export const CountGroup = styled("fieldset")(({ theme }) => ({ border: `1px solid ${theme.palette.divider}`, borderRadius: theme.spacing(1), margin: 0, padding: theme.spacing(2), minWidth: 0, "& > legend": { padding: theme.spacing(0, .5) } }));
export const Fields = styled(Box)(({ theme }) => ({ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 9rem), 1fr))", gap: theme.spacing(2) }));
