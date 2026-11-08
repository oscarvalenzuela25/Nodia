import { Stack, styled } from "@mui/material";
export const Feedback = styled(Stack)(({ theme }) => ({ borderTop: `1px solid ${theme.palette.divider}`, paddingTop: theme.spacing(2), gap: theme.spacing(1) }));
