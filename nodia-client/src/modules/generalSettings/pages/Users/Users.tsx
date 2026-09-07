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
  LinearProgress,
  Alert,
  AlertTitle,
  TablePagination,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddReactionOutlinedIcon from "@mui/icons-material/AddReactionOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";

import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import UserModal from "./components/UserModal";
import type { UserFormData } from "./components/UserModal";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
} from "./infrastructure/useServices";
import { useRoles } from "../Roles";
import type { RoleSummary, User } from "./types";
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

const Users: FC = () => {
  const { t } = useTranslation(["users", "core"]);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

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
  const [actionUser, setActionUser] = useState<User | null>(null);

  // Confirm Active / Inactive Dialog state
  const [userToToggle, setUserToToggle] = useState<User | null>(null);
  const [isConfirmToggleOpen, setIsConfirmToggleOpen] =
    useState<boolean>(false);

  // Build Ransack query
  const ransackQuery = useMemo(() => {
    const q: Record<string, unknown> = {};
    if (searchTerm.trim()) {
      q.name_cont = searchTerm.trim();
    }
    if (appliedFilterNames.length > 0) {
      q.name_in = appliedFilterNames;
    }
    if (appliedFilterEmails.length > 0) {
      q.email_in = appliedFilterEmails;
    }
    if (appliedFilterRoles.length > 0) {
      q.roles_id_in = appliedFilterRoles;
    }
    if (appliedFilterActive !== null) {
      q.is_active_eq = appliedFilterActive;
    }
    return q;
  }, [
    searchTerm,
    appliedFilterNames,
    appliedFilterEmails,
    appliedFilterRoles,
    appliedFilterActive,
  ]);

  // Table users fetch (Endpoint 1: paginated with relations)
  const {
    data: usersResponse,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useUsers({
    page: page + 1,
    size: rowsPerPage,
    q: Object.keys(ransackQuery).length > 0 ? ransackQuery : undefined,
  });

  // Filter users fetch (Endpoint 1 with all=true and includes=false)
  const {
    data: filterUsersResponse,
    isLoading: isLoadingFilterUsers,
    isFetching: isFetchingFilterUsers,
  } = useUsers({
    all: true,
    includes: false,
  });

  // Filter roles fetch (all=true and includes=false)
  const {
    data: filterRolesResponse,
    isLoading: isLoadingFilterRoles,
    isFetching: isFetchingFilterRoles,
  } = useRoles({
    all: true,
    includes: false,
  });

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();

  const isMutating =
    createUserMutation.isPending || updateUserMutation.isPending;

  const users: User[] = useMemo(
    () => usersResponse?.data ?? [],
    [usersResponse]
  );

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getRoleKeys = (roles: (RoleSummary | string)[] = []): string[] => {
    return roles.map((r) => (typeof r === "string" ? r : r.key));
  };

  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    user: User
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
        roles: actionUser.roles.map((r) =>
          typeof r === "string" ? r : r.id
        ),
        isActive: actionUser.is_active,
        imageUrl: actionUser.image_url ?? null,
      });
      setIsUserModalOpen(true);
    }
    handleCloseActionMenu();
  };

  const handleSaveUser = async (data: UserFormData) => {
    try {
      if (data.id) {
        await updateUserMutation.mutateAsync({
          userId: data.id,
          payload: {
            name: data.name ?? null,
            email: data.email,
            roles: data.roles,
            is_active: data.isActive,
            image_url: data.imageUrl ?? null,
          },
        });
      } else {
        await createUserMutation.mutateAsync({
          name: data.name ?? null,
          email: data.email,
          roles: data.roles,
          is_active: data.isActive,
          image_url: data.imageUrl ?? null,
        });
      }
      setIsUserModalOpen(false);
    } catch {
      // Handled by onError sileo toast; modal stays open
    }
  };

  const handleRequestToggleActive = (user: User) => {
    setUserToToggle(user);
    setIsConfirmToggleOpen(true);
    handleCloseActionMenu();
  };

  const handleCloseConfirmToggle = () => {
    if (isMutating) return;
    setIsConfirmToggleOpen(false);
    setUserToToggle(null);
  };

  const handleConfirmToggleActive = async () => {
    if (!userToToggle) return;
    try {
      await updateUserMutation.mutateAsync({
        userId: userToToggle.id,
        payload: {
          is_active: !userToToggle.is_active,
        },
      });
      setIsConfirmToggleOpen(false);
      setUserToToggle(null);
    } catch {
      // Error is handled by mutation onError sileo notification
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    sileo.info({
      title: t("users:copy"),
      description: t("users:copied"),
    });
  };

  // Filter application
  const handleApplyFilters = () => {
    setAppliedFilterNames(draftFilterNames);
    setAppliedFilterEmails(draftFilterEmails);
    setAppliedFilterRoles(draftFilterRoles);
    setAppliedFilterActive(draftFilterActive);
    setPage(0);
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
    setPage(0);
  };

  // Filter options derived from all users (without relations)
  const userNameOptions = useMemo(() => {
    return Array.from(
      new Set(
        (filterUsersResponse?.data ?? [])
          .map((u) => u.name)
          .filter(Boolean) as string[]
      )
    );
  }, [filterUsersResponse]);

  const userEmailOptions = useMemo(() => {
    return Array.from(
      new Set(
        (filterUsersResponse?.data ?? [])
          .map((u) => u.email)
          .filter(Boolean) as string[]
      )
    );
  }, [filterUsersResponse]);

  // Filter options derived from all roles (without relations)
  const roleFilterOptions = useMemo(() => {
    return (filterRolesResponse?.data ?? []).map((role) => ({
      value: role.id,
      label: role.key,
    }));
  }, [filterRolesResponse]);

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

  return (
    <Box>
      <PageHeader>
        <PageTitleContainer>
          <AddReactionOutlinedIcon color="primary" fontSize="large" />
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
            disabled={isLoadingFilterUsers || isFetchingFilterUsers}
          />

          <SelectMultipleInput
            label={t("users:form.email")}
            options={userEmailOptions}
            value={draftFilterEmails}
            onChange={setDraftFilterEmails}
            placeholder={t("users:form.email_placeholder")}
            disabled={isLoadingFilterUsers || isFetchingFilterUsers}
          />

          <SelectMultipleInput
            label={t("users:form.roles")}
            options={roleFilterOptions}
            value={draftFilterRoles}
            onChange={setDraftFilterRoles}
            placeholder={t("users:form.roles_placeholder")}
            disabled={isLoadingFilterRoles || isFetchingFilterRoles}
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
                  disabled={isLoading || isFetching}
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
              onAction={() => {
                setAppliedFilterNames((prev) => prev.filter((n) => n !== name));
                setPage(0);
              }}
            />
          ))}
          {appliedFilterEmails.map((email) => (
            <FilterChips
              key={`email-${email}`}
              label={t("users:filter_chips.email", { value: email })}
              onAction={() => {
                setAppliedFilterEmails((prev) =>
                  prev.filter((e) => e !== email)
                );
                setPage(0);
              }}
            />
          ))}
          {appliedFilterRoles.map((roleId) => {
            const role = filterRolesResponse?.data?.find((r) => r.id === roleId);
            const roleLabel = role?.key ?? roleId;
            return (
              <FilterChips
                key={`role-${roleId}`}
                label={t("users:filter_chips.role", { value: roleLabel })}
                onAction={() => {
                  setAppliedFilterRoles((prev) => prev.filter((r) => r !== roleId));
                  setPage(0);
                }}
              />
            );
          })}
          {appliedFilterActive !== null && (
            <FilterChips
              label={
                appliedFilterActive
                  ? t("users:filter_chips.active_only")
                  : t("users:no")
              }
              onAction={() => {
                setAppliedFilterActive(null);
                setPage(0);
              }}
            />
          )}
        </ActiveFilters>
      )}

      {isError && (
        <Box sx={{ mb: 2.5 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                {t("core:retry", "Reintentar")}
              </Button>
            }
          >
            <AlertTitle>
              {t("users:error_state.title", "Error al cargar los usuarios")}
            </AlertTitle>
            {error instanceof Error
              ? error.message
              : t(
                  "users:error_state.description",
                  "No se pudo obtener el listado de usuarios desde el servidor."
                )}
          </Alert>
        </Box>
      )}

      <TableTopBar>
        <Box sx={{ width: { xs: "100%", sm: "320px" } }}>
          <InputSearch
            value={searchTerm}
            onChange={(val) => {
              setSearchTerm(val);
              setPage(0);
            }}
            placeholder={t("users:search_placeholder")}
            fullWidth
            disabled={isLoading || isMutating}
          />
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PersonAddAlt1OutlinedIcon />}
          onClick={handleOpenCreateModal}
          disabled={isLoading || isFetching || isMutating}
          sx={(theme) => ({
            borderRadius: 2,
            color: theme.palette.primary.contrastText,
          })}
        >
          {t("users:new_user")}
        </Button>
      </TableTopBar>

      <Skeleton loading={isLoading} name="users-table">
        <StyledTableContainer>
          {isFetching && !isLoading && (
            <LinearProgress
              sx={{
                height: 3,
              }}
            />
          )}
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
                {!isLoading && users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      align="center"
                      sx={{ py: 6, color: "text.secondary" }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 1.5,
                        }}
                      >
                        <Typography variant="h6" color="text.primary">
                          {t(
                            "users:empty_state.title",
                            "No hay usuarios disponibles"
                          )}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ maxWidth: 420 }}
                        >
                          {t(
                            "users:empty_state.description",
                            "No se encontraron usuarios actualmente. Comience agregando uno nuevo."
                          )}
                        </Typography>
                        <Button
                          variant="contained"
                          size="small"
                          color="primary"
                          startIcon={<PersonAddAlt1OutlinedIcon />}
                          onClick={handleOpenCreateModal}
                          disabled={isLoading || isFetching || isMutating}
                          sx={(theme) => ({
                            mt: 1,
                            borderRadius: 2,
                            color: theme.palette.primary.contrastText,
                          })}
                        >
                          {t(
                            "users:empty_state.cta",
                            "Crear primer usuario"
                          )}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
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
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          {user.id.includes("-")
                            ? `${user.id.split("-")[0]}...`
                            : user.id}
                          <Tooltip
                            title={t("users:copy")}
                            arrow
                            placement="top"
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleCopyId(user.id)}
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
                              src={user.image_url ?? undefined}
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
                          <Box
                            sx={{
                              display: "flex",
                              gap: 0.5,
                              flexWrap: "wrap",
                            }}
                          >
                            {getRoleKeys(user.roles).map((roleKey) => (
                              <Chip
                                key={roleKey}
                                label={roleKey}
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
                            user.is_active
                              ? t("users:yes")
                              : t("users:no")
                          }
                          color={user.is_active ? "success" : "error"}
                          size="small"
                          variant={user.is_active ? "filled" : "outlined"}
                          sx={
                            user.is_active
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
                          disabled={isLoading || isFetching || isMutating}
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
          <TablePagination
            component="div"
            count={usersResponse?.meta?.total_items ?? users.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            disabled={isLoading || isFetching || isMutating}
            labelRowsPerPage={t("core:pagination.rows_per_page")}
            labelDisplayedRows={({ from, to, count }) =>
              `${from}–${to} ${t("core:pagination.of")} ${
                count !== -1 ? count : `${t("core:pagination.more_than")} ${to}`
              }`
            }
          />
        </StyledTableContainer>
      </Skeleton>

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
              minWidth: 160,
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
        {actionUser && (
          <MenuItem
            onClick={() => handleRequestToggleActive(actionUser)}
            sx={{ borderRadius: 1 }}
          >
            <ListItemIcon>
              {actionUser.is_active ? (
                <BlockOutlinedIcon fontSize="small" color="error" />
              ) : (
                <CheckCircleOutlineOutlinedIcon
                  fontSize="small"
                  color="success"
                />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                actionUser.is_active
                  ? t("users:deactivate")
                  : t("users:activate")
              }
            />
          </MenuItem>
        )}
      </Menu>

      {/* User Create / Edit Modal */}
      <UserModal
        open={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSubmit={handleSaveUser}
        initialData={selectedUserForEdit}
        isSubmitting={isMutating}
      />

      {/* Confirm User Active/Inactive Dialog */}
      <ConfirmDialog
        open={isConfirmToggleOpen}
        onClose={handleCloseConfirmToggle}
        onConfirm={handleConfirmToggleActive}
        isLoading={isMutating}
        title={
          userToToggle?.is_active
            ? t("users:confirm_deactivate_title")
            : t("users:confirm_activate_title")
        }
        message={
          userToToggle?.is_active
            ? t("users:confirm_deactivate_message", {
                name: userToToggle?.name || userToToggle?.email,
              })
            : t("users:confirm_activate_message", {
                name: userToToggle?.name || userToToggle?.email,
              })
        }
      />
    </Box>
  );
};

export default Users;
