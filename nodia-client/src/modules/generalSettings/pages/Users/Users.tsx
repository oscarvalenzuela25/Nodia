import type { FC, MouseEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Button,
  IconButton,
  Avatar,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import UserModal from "./components/UserModal";
import type { UserFormData } from "./components/UserModal";
import {
  PageHeader,
  PageTitleContainer,
  PageTitle,
  PageSubtitle,
  FilterRow,
  ActiveFilters,
  TableTopBar,
  UserInfo,
  StyledTableContainer,
} from "./styles";

type UserItem = {
  id: string;
  name: string | null;
  email: string;
  roles: string[];
  isActive: boolean;
  imageUrl?: string | null;
};

const INITIAL_USERS: UserItem[] = [
  {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Juan Perez",
    email: "juan@example.com",
    roles: ["Admin", "User"],
    isActive: true,
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174001",
    name: null,
    email: "correo@example.com",
    roles: [],
    isActive: false,
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174002",
    name: "Maria Lopez",
    email: "maria@example.com",
    roles: ["Manager"],
    isActive: true,
  },
];

const AVAILABLE_ROLES = ["Admin", "User", "Manager", "SuperAdmin", "Editor"];

const Users: FC = () => {
  const { t } = useTranslation(["users", "core"]);

  const [users, setUsers] = useState<UserItem[]>(INITIAL_USERS);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Filter modal draft state
  const [draftFilterNames, setDraftFilterNames] = useState<string[]>([]);
  const [draftFilterEmails, setDraftFilterEmails] = useState<string[]>([]);
  const [draftFilterRoles, setDraftFilterRoles] = useState<string[]>([]);
  const [draftFilterActive, setDraftFilterActive] = useState<boolean>(true);

  // Applied filter state
  const [appliedFilterNames, setAppliedFilterNames] = useState<string[]>([]);
  const [appliedFilterEmails, setAppliedFilterEmails] = useState<string[]>([]);
  const [appliedFilterRoles, setAppliedFilterRoles] = useState<string[]>([]);
  const [appliedFilterActive, setAppliedFilterActive] = useState<boolean | null>(
    null
  );

  // User Create / Edit Modal state
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [selectedUserForEdit, setSelectedUserForEdit] =
    useState<UserFormData | null>(null);

  // Table row actions menu
  const [actionMenuAnchor, setActionMenuAnchor] =
    useState<HTMLButtonElement | null>(null);
  const [actionUser, setActionUser] = useState<UserItem | null>(null);

  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    user: UserItem
  ) => {
    setActionMenuAnchor(e.currentTarget);
    setActionUser(user);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
    setActionUser(null);
  };

  const handleOpenCreateModal = () => {
    setSelectedUserForEdit(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditModal = () => {
    if (actionUser) {
      setSelectedUserForEdit({
        id: actionUser.id,
        name: actionUser.name,
        email: actionUser.email,
        roles: actionUser.roles,
        isActive: actionUser.isActive,
        imageUrl: actionUser.imageUrl ?? null,
      });
      setIsUserModalOpen(true);
    }
    handleCloseActionMenu();
  };

  const handleSaveUser = (data: UserFormData) => {
    if (data.id) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === data.id
            ? {
                ...u,
                name: data.name ?? null,
                email: data.email,
                roles: data.roles,
                isActive: data.isActive,
                imageUrl: data.imageUrl ?? null,
              }
            : u
        )
      );
    } else {
      const newUser: UserItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}`,
        name: data.name ?? null,
        email: data.email,
        roles: data.roles,
        isActive: data.isActive,
        imageUrl: data.imageUrl ?? null,
      };
      setUsers((prev) => [newUser, ...prev]);
    }
  };

  // Filter application
  const handleApplyFilters = () => {
    setAppliedFilterNames(draftFilterNames);
    setAppliedFilterEmails(draftFilterEmails);
    setAppliedFilterRoles(draftFilterRoles);
    setAppliedFilterActive(draftFilterActive);
  };

  const handleClearFilters = () => {
    setDraftFilterNames([]);
    setDraftFilterEmails([]);
    setDraftFilterRoles([]);
    setDraftFilterActive(true);
    setAppliedFilterNames([]);
    setAppliedFilterEmails([]);
    setAppliedFilterRoles([]);
    setAppliedFilterActive(null);
  };

  // Filter options derived from all users
  const userNameOptions = useMemo(() => {
    return Array.from(
      new Set(users.map((u) => u.name).filter(Boolean) as string[])
    );
  }, [users]);

  const userEmailOptions = useMemo(() => {
    return Array.from(new Set(users.map((u) => u.email)));
  }, [users]);

  // Active filter count calculation
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterNames.length > 0) count += appliedFilterNames.length;
    if (appliedFilterEmails.length > 0) count += appliedFilterEmails.length;
    if (appliedFilterRoles.length > 0) count += appliedFilterRoles.length;
    if (appliedFilterActive !== null) count += 1;
    return count;
  }, [
    appliedFilterNames,
    appliedFilterEmails,
    appliedFilterRoles,
    appliedFilterActive,
  ]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // 1. Search bar by Name
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const userName = user.name ? user.name.toLowerCase() : "";
        if (!userName.includes(query)) {
          return false;
        }
      }

      // 2. Modal filter by Name
      if (appliedFilterNames.length > 0) {
        if (!user.name || !appliedFilterNames.includes(user.name)) {
          return false;
        }
      }

      // 3. Modal filter by Email
      if (appliedFilterEmails.length > 0) {
        if (!appliedFilterEmails.includes(user.email)) {
          return false;
        }
      }

      // 4. Modal filter by Roles
      if (appliedFilterRoles.length > 0) {
        const hasMatchingRole = user.roles.some((role) =>
          appliedFilterRoles.includes(role)
        );
        if (!hasMatchingRole) {
          return false;
        }
      }

      // 5. Modal filter by Active
      if (appliedFilterActive !== null) {
        if (user.isActive !== appliedFilterActive) {
          return false;
        }
      }

      return true;
    });
  }, [
    users,
    searchTerm,
    appliedFilterNames,
    appliedFilterEmails,
    appliedFilterRoles,
    appliedFilterActive,
  ]);

  return (
    <Box>
      <PageHeader>
        <PageTitleContainer>
          <PeopleAltOutlinedIcon color="primary" fontSize="large" />
          <PageTitle>{t("users:title")}</PageTitle>
        </PageTitleContainer>
        <PageSubtitle>{t("users:subtitle")}</PageSubtitle>
      </PageHeader>

      <FilterRow>
        <Filter
          onFilter={handleApplyFilters}
          onClear={handleClearFilters}
          activeCount={activeFiltersCount}
          title={t("users:filter_modal_title")}
          subtitle={t("users:filter_modal_subtitle")}
        >
          <SelectMultipleInput
            label={t("users:form.name")}
            options={userNameOptions}
            value={draftFilterNames}
            onChange={setDraftFilterNames}
            placeholder={t("users:form.name_placeholder")}
          />

          <SelectMultipleInput
            label={t("users:form.email")}
            options={userEmailOptions}
            value={draftFilterEmails}
            onChange={setDraftFilterEmails}
            placeholder={t("users:form.email_placeholder")}
          />

          <SelectMultipleInput
            label={t("users:form.roles")}
            options={AVAILABLE_ROLES}
            value={draftFilterRoles}
            onChange={setDraftFilterRoles}
            placeholder={t("users:form.roles_placeholder")}
          />

          <Box
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 1.5,
              borderRadius: 1.5,
              border: `1px solid ${
                theme.palette.border?.default ?? theme.palette.divider
              }`,
            })}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={draftFilterActive}
                  onChange={(e) => setDraftFilterActive(e.target.checked)}
                  color="primary"
                />
              }
              label={t("users:form.active")}
              labelPlacement="start"
              sx={{ m: 0, width: "100%", justifyContent: "space-between" }}
            />
          </Box>
        </Filter>
      </FilterRow>

      {activeFiltersCount > 0 && (
        <ActiveFilters>
          {appliedFilterNames.map((name) => (
            <FilterChips
              key={`name-${name}`}
              label={t("users:filter_chips.name", { value: name })}
              onAction={() =>
                setAppliedFilterNames((prev) => prev.filter((n) => n !== name))
              }
            />
          ))}
          {appliedFilterEmails.map((email) => (
            <FilterChips
              key={`email-${email}`}
              label={t("users:filter_chips.email", { value: email })}
              onAction={() =>
                setAppliedFilterEmails((prev) =>
                  prev.filter((e) => e !== email)
                )
              }
            />
          ))}
          {appliedFilterRoles.map((role) => (
            <FilterChips
              key={`role-${role}`}
              label={t("users:filter_chips.role", { value: role })}
              onAction={() =>
                setAppliedFilterRoles((prev) => prev.filter((r) => r !== role))
              }
            />
          ))}
          {appliedFilterActive !== null && (
            <FilterChips
              label={
                appliedFilterActive
                  ? t("users:filter_chips.active_only")
                  : t("users:no")
              }
              onAction={() => setAppliedFilterActive(null)}
            />
          )}
        </ActiveFilters>
      )}

      <TableTopBar>
        <Box sx={{ width: { xs: "100%", sm: "320px" } }}>
          <InputSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t("users:search_placeholder")}
            fullWidth
          />
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PersonAddAlt1OutlinedIcon />}
          onClick={handleOpenCreateModal}
          sx={(theme) => ({
            borderRadius: 2,
            color: theme.palette.primary.contrastText,
          })}
        >
          {t("users:new_user")}
        </Button>
      </TableTopBar>

      <StyledTableContainer>
        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead
              sx={{
                bgcolor: "primary.main",
                "& th": {
                  color: "primary.contrastText",
                  fontWeight: "bold",
                },
              }}
            >
              <TableRow>
                <TableCell>{t("users:table.id")}</TableCell>
                <TableCell>{t("users:table.name")}</TableCell>
                <TableCell>{t("users:table.email")}</TableCell>
                <TableCell>{t("users:table.roles")}</TableCell>
                <TableCell>{t("users:table.active")}</TableCell>
                <TableCell align="center">
                  {t("users:table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{ py: 4, color: "text.secondary" }}
                  >
                    {t("core:no_options_found")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    hover
                    sx={{
                      "&:last-child td, &:last-child th": { border: 0 },
                    }}
                  >
                    <TableCell
                      sx={{
                        color: "text.secondary",
                        fontSize: "0.875rem",
                        fontFamily: "monospace",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {user.id.split("-")[0]}...
                        <Tooltip title={t("users:copy")} arrow placement="top">
                          <IconButton
                            size="small"
                            onClick={() =>
                              navigator.clipboard.writeText(user.id)
                            }
                            aria-label={t("users:copy")}
                          >
                            <ContentCopyIcon
                              fontSize="small"
                              sx={{ fontSize: "1rem" }}
                            />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {user.name ? (
                        <UserInfo>
                          <Avatar
                            src={user.imageUrl ?? undefined}
                            sx={{
                              width: 32,
                              height: 32,
                              fontSize: "0.875rem",
                              bgcolor: "primary.light",
                            }}
                          >
                            {user.name.charAt(0)}
                          </Avatar>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "medium" }}
                          >
                            {user.name}
                          </Typography>
                        </UserInfo>
                      ) : (
                        t("users:empty_value")
                      )}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.roles && user.roles.length > 0 ? (
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                          {user.roles.map((role) => (
                            <Chip
                              key={role}
                              label={role}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                        </Box>
                      ) : (
                        t("users:empty_value")
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          user.isActive
                            ? t("users:yes")
                            : t("users:no")
                        }
                        color={user.isActive ? "success" : "error"}
                        size="small"
                        variant={user.isActive ? "filled" : "outlined"}
                        sx={
                          user.isActive
                            ? { color: "success.contrastText" }
                            : {}
                        }
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        aria-label={t("users:table.actions")}
                        onClick={(e) => handleOpenActionMenu(e, user)}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </StyledTableContainer>

      {/* Row Actions Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleCloseActionMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              borderRadius: 2,
              minWidth: 140,
              boxShadow: theme.shadows[3],
              border: `1px solid ${
                theme.palette.border?.default ?? theme.palette.divider
              }`,
            }),
          },
          list: {
            sx: {
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              p: 1,
            },
          },
        }}
      >
        <MenuItem onClick={handleOpenEditModal} sx={{ borderRadius: 1 }}>
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("users:actions.update")} />
        </MenuItem>
      </Menu>

      {/* User Create / Edit Modal */}
      <UserModal
        open={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSubmit={handleSaveUser}
        initialData={selectedUserForEdit}
        availableRoles={AVAILABLE_ROLES}
      />
    </Box>
  );
};

export default Users;
