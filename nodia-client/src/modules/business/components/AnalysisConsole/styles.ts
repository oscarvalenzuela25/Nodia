import { Box, Paper } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
export const Workspace = styled(Box)({ containerType: "inline-size", minWidth: 0 });
export const WorkspaceGrid = styled(Box)(({ theme }) => ({
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', rowGap: theme.spacing(3), columnGap: theme.spacing(2),
  '& > *': { minWidth: 0 },
  '@container (min-width: 900px)': { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' },
}));
export const ConsolePaper = styled(Paper)(({ theme }) => ({
  minWidth: 0, overflow: 'hidden', border: `1px solid ${theme.palette.divider}`, borderRadius: theme.spacing(2),
  background: theme.palette.background.default, display: 'flex', flexDirection: 'column', height: 380,
}));
export const EventLog = styled(Box)(({ theme }) => {
  const thumb = alpha(theme.palette.mode === 'dark' ? '#ffffff' : '#000000', .2);
  return { overflowY: 'auto', minHeight: 0, flex: 1, padding: theme.spacing(2), scrollbarWidth: 'thin', scrollbarColor: `${thumb} transparent`,
    '&::-webkit-scrollbar': { width: 6, height: 6 }, '&::-webkit-scrollbar-track': { background: 'transparent !important' },
    '&::-webkit-scrollbar-button': { display: 'none !important', width: 0, height: 0 },
    '&::-webkit-scrollbar-thumb': { background: thumb, borderRadius: 9999, '&:hover': { background: alpha(theme.palette.mode === 'dark' ? '#ffffff' : '#000000', .35) } },
  };
});

