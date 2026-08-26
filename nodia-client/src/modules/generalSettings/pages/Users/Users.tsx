import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, Button, IconButton, Avatar, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Tooltip } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import { 
  PageHeader, 
  PageTitleContainer,
  PageTitle, 
  PageSubtitle, 
  FilterRow, 
  ActiveFilters,
  ActionRow, 
  UserInfo,
  StyledTableContainer
} from "./styles";

const mockUsers = [
  {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Juan Perez",
    email: "juan@example.com",
    roles: ["Admin", "User"],
    isAllowed: true,
    isActive: true,
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174001",
    name: null,
    email: "correo@example.com",
    roles: [],
    isAllowed: false,
    isActive: false,
  }
];

const Users: FC = () => {
  const { t } = useTranslation("users");

  return (
    <Box>
      <PageHeader>
        <PageTitleContainer>
          <PeopleAltOutlinedIcon color="primary" fontSize="large" />
          <PageTitle>{t("title")}</PageTitle>
        </PageTitleContainer>
        <PageSubtitle>{t("subtitle")}</PageSubtitle>
      </PageHeader>
      
      <FilterRow>
        <Filter onFilter={() => {}} onClear={() => {}}>
          <Typography color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
            {t("filter_placeholder")}
          </Typography>
        </Filter>
      </FilterRow>

      <ActiveFilters>
        <FilterChips label="Lorem Ipsum" onAction={() => {}} />
        <FilterChips label="Lorem Ipsum" />
        <FilterChips label="Lorem Ipsum" />
        <FilterChips label="Lorem Ipsum" />
      </ActiveFilters>

      <ActionRow>
        <Button variant="contained" color="primary" startIcon={<PersonAddAlt1OutlinedIcon />} sx={{ borderRadius: 2 }}>
          {t("new_user")}
        </Button>
      </ActionRow>

      <StyledTableContainer>
        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead sx={{ bgcolor: "primary.main", "& th": { color: "primary.contrastText", fontWeight: 'bold' } }}>
              <TableRow>
                <TableCell>{t("table.id")}</TableCell>
                <TableCell>{t("table.name")}</TableCell>
                <TableCell>{t("table.email")}</TableCell>
                <TableCell>{t("table.roles")}</TableCell>
                <TableCell>{t("table.allowed")}</TableCell>
                <TableCell>{t("table.active")}</TableCell>
                <TableCell align="center">{t("table.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockUsers.map((user) => (
                <TableRow key={user.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell sx={{ color: "text.secondary", fontSize: "0.875rem", fontFamily: "monospace" }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {user.id.split('-')[0]}...
                      <Tooltip title={t("copy")} arrow placement="top">
                        <IconButton size="small" onClick={() => navigator.clipboard.writeText(user.id)}>
                          <ContentCopyIcon fontSize="small" sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {user.name ? (
                      <UserInfo>
                        <Avatar sx={{ width: 32, height: 32, fontSize: "0.875rem", bgcolor: 'primary.light' }}>
                          {user.name.charAt(0)}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>{user.name}</Typography>
                      </UserInfo>
                    ) : (
                      t("empty_value")
                    )}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.roles && user.roles.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {user.roles.map(role => <Chip key={role} label={role} size="small" variant="outlined" color="primary" />)}
                      </Box>
                    ) : (
                      t("empty_value")
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={user.isAllowed != null ? (user.isAllowed ? t("yes") : t("no")) : t("empty_value")}
                      color={user.isAllowed ? "success" : "default"}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={user.isActive != null ? (user.isActive ? t("yes") : t("no")) : t("empty_value")}
                      color={user.isActive ? "success" : "error"}
                      size="small"
                      variant={user.isActive ? "filled" : "outlined"}
                      sx={user.isActive ? { color: 'success.contrastText' } : {}}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton onClick={() => {}} size="small" color="primary">
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </StyledTableContainer>
    </Box>
  );
};

export default Users;
