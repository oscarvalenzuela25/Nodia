import type { FC, MouseEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Button,
  IconButton,
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
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import AddModeratorOutlinedIcon from "@mui/icons-material/AddModeratorOutlined";
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
import RoleModal from "./components/RoleModal";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
} from "./infrastructure/useServices";
import { useActions } from "../Actions";
import type { RoleItem, RoleFormData, ActionOption, Role } from "./types";
import {
  PageHeader,
  PageTitleContainer,
  PageTitle,
  PageSubtitle,
  FilterRow,
  ActiveFilters,
  TableTopBar,
  StyledTableContainer,
  KeyBadge,
  ActionsWrapper,
  ActionTag,
  MoreActionsChip,
} from "./styles";

const Roles: FC = () => {
  const { t, i18n } = useTranslation(["roles", "actions", "core"]);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Filter modal draft state
  const [draftFilterRoleKeys, setDraftFilterRoleKeys] = useState<string[]>([]);
  const [draftFilterActions, setDraftFilterActions] = useState<string[]>([]);
  const [draftFilterActive, setDraftFilterActive] = useState<boolean>(true);

  // Applied filter state
  const [appliedFilterRoleKeys, setAppliedFilterRoleKeys] = useState<string[]>(
    []
  );
  const [appliedFilterActions, setAppliedFilterActions] = useState<string[]>([]);
  const [appliedFilterActive, setAppliedFilterActive] = useState<
    boolean | null
  >(null);

  // Role Create / Edit Modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [selectedRoleForEdit, setSelectedRoleForEdit] =
    useState<RoleFormData | null>(null);

  // Table row actions menu
  const [actionMenuAnchor, setActionMenuAnchor] =
    useState<HTMLButtonElement | null>(null);
  const [actionRole, setActionRole] = useState<RoleItem | null>(null);

  // Confirm Active / Inactive Dialog state
  const [roleToToggle, setRoleToToggle] = useState<RoleItem | null>(null);
  const [isConfirmToggleOpen, setIsConfirmToggleOpen] =
    useState<boolean>(false);

  // Mutations
  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();
  const isMutating =
    createRoleMutation.isPending || updateRoleMutation.isPending;

  // Build Ransack query
  const ransackQuery = useMemo(() => {
    const q: Record<string, unknown> = {};
    if (searchTerm.trim()) {
      q.key_cont = searchTerm.trim();
    }
    if (appliedFilterActive !== null) {
      q.is_active_eq = appliedFilterActive;
    }
    return q;
  }, [searchTerm, appliedFilterActive]);

  // React Query hook for Endpoint 1
  const {
    data: rolesResponse,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useRoles({
    page: page + 1,
    size: rowsPerPage,
    includes: true,
    q: Object.keys(ransackQuery).length > 0 ? ransackQuery : undefined,
  });

  const roles: RoleItem[] = useMemo(() => {
    if (rolesResponse?.data) {
      return rolesResponse.data.map((r: Role) => {
        const keyTrans = r.translates?.find((t) => t.key === "key");
        const nameTranslations = keyTrans
          ? { es: keyTrans.es, en: keyTrans.en }
          : r.nameTranslations;
        const lang = i18n.language?.startsWith("en") ? "en" : "es";
        const altLang = lang === "en" ? "es" : "en";
        const name =
          keyTrans?.[lang] ||
          keyTrans?.[altLang] ||
          (i18n.exists(`roles:role_names.${r.key}`)
            ? t(`roles:role_names.${r.key}`)
            : null);
        return {
          id: r.id,
          name,
          key: r.key,
          nameTranslations,
          translates: r.translates,
          actions: (r.actions ?? []).map((a) =>
            typeof a === "string" ? a : a.key
          ),
          isActive: r.is_active ?? true,
        };
      });
    }
    return [];
  }, [rolesResponse, i18n.language, t, i18n]);

  const totalItems = useMemo(() => {
    return rolesResponse?.meta?.total_items ?? roles.length;
  }, [rolesResponse, roles.length]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Actions fetch (Endpoint 1 with all=true and includes=false)
  const {
    data: filterActionsResponse,
    isLoading: isLoadingFilterActions,
    isFetching: isFetchingFilterActions,
  } = useActions({
    all: true,
    includes: false,
  });

  const actionCleanNamesMap = useMemo(() => {
    const map = new Map<string, string>();
    const lang = i18n.language?.startsWith("en") ? "en" : "es";
    const altLang = lang === "en" ? "es" : "en";

    // 1. Load from actions catalog if available
    (filterActionsResponse?.data ?? []).forEach((act) => {
      const keyTrans = act.translates?.find((tr) => tr.key === "key");
      const translated =
        keyTrans?.[lang] ||
        keyTrans?.[altLang] ||
        (i18n.exists(`actions:action_names.${act.key}`)
          ? t(`actions:action_names.${act.key}`)
          : i18n.exists(`roles:action_names.${act.key}`)
          ? t(`roles:action_names.${act.key}`)
          : null);
      if (translated) {
        map.set(act.key, translated);
      }
    });

    // 2. Load directly from role actions translates returned in roles fetch
    (rolesResponse?.data ?? []).forEach((r: Role) => {
      (r.actions ?? []).forEach((act) => {
        if (typeof act !== "string" && act.key) {
          const keyTrans = act.translates?.find((tr) => tr.key === "key");
          const translated =
            keyTrans?.[lang] ||
            keyTrans?.[altLang] ||
            (i18n.exists(`actions:action_names.${act.key}`)
              ? t(`actions:action_names.${act.key}`)
              : i18n.exists(`roles:action_names.${act.key}`)
              ? t(`roles:action_names.${act.key}`)
              : null);
          if (translated) {
            map.set(act.key, translated);
          }
        }
      });
    });

    return map;
  }, [filterActionsResponse, rolesResponse, i18n.language, t, i18n]);

  // Roles fetch for filter options (all=true and includes=false)
  const {
    data: allRolesResponse,
    isLoading: isLoadingAllRoles,
    isFetching: isFetchingAllRoles,
  } = useRoles({
    all: true,
    includes: false,
  });

  // Action options with current language labels in Translate (key) format
  const availableActionOptions: ActionOption[] = useMemo(() => {
    return (filterActionsResponse?.data ?? []).map((act) => {
      const cleanName = actionCleanNamesMap.get(act.key);
      const label =
        cleanName && cleanName !== act.key
          ? `${cleanName} (${act.key})`
          : act.key;
      return {
        value: act.key,
        label,
        category: act.key.split(".")[0],
      };
    });
  }, [filterActionsResponse, actionCleanNamesMap]);

  const actionLabelsMap = useMemo(() => {
    const map = new Map<string, string>();
    availableActionOptions.forEach((opt) => map.set(opt.value, opt.label));
    return map;
  }, [availableActionOptions]);

  // Role filter options for the filter modal in Translate (key) format
  const roleFilterOptions = useMemo(() => {
    const sourceRoles = allRolesResponse?.data ?? roles;
    return sourceRoles.map((role: Role | RoleItem) => {
      const keyTrans = role.translates?.find((t) => t.key === "key");
      const lang = i18n.language?.startsWith("en") ? "en" : "es";
      const altLang = lang === "en" ? "es" : "en";
      const name =
        keyTrans?.[lang] ||
        keyTrans?.[altLang] ||
        role.nameTranslations?.[lang] ||
        role.nameTranslations?.[altLang] ||
        ("name" in role && role.name ? role.name : null) ||
        (i18n.exists(`roles:role_names.${role.key}`)
          ? t(`roles:role_names.${role.key}`)
          : null);
      const label =
        name && name !== role.key ? `${name} (${role.key})` : role.key;
      return {
        value: role.key,
        label,
      };
    });
  }, [allRolesResponse?.data, roles, i18n.language, t, i18n]);

  const roleLabelsMap = useMemo(() => {
    const map = new Map<string, string>();
    roleFilterOptions.forEach((opt) => map.set(opt.value, opt.label));
    return map;
  }, [roleFilterOptions]);

  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    role: RoleItem
  ) => {
    setActionMenuAnchor(e.currentTarget);
    setActionRole(role);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
    setActionRole(null);
  };

  const handleOpenCreateModal = () => {
    setSelectedRoleForEdit(null);
    setIsRoleModalOpen(true);
  };

  const handleOpenEditModal = () => {
    if (actionRole) {
      const keyTrans = actionRole.translates?.find((t) => t.key === "key");
      setSelectedRoleForEdit({
        id: actionRole.id,
        key: actionRole.key,
        nameTranslations:
          actionRole.nameTranslations ?? {
            es: keyTrans?.es ?? "",
            en: keyTrans?.en ?? "",
          },
        actions: actionRole.actions,
        isActive: actionRole.isActive,
      });
      setIsRoleModalOpen(true);
    }
    handleCloseActionMenu();
  };

  const handleSaveRole = async (data: RoleFormData) => {
    const roleId = data.id;
    try {
      if (roleId) {
        await updateRoleMutation.mutateAsync({
          roleId,
          payload: {
            key: data.key,
            is_active: data.isActive,
            actions: data.actions,
            translates: data.translates,
          },
        });
      } else {
        await createRoleMutation.mutateAsync({
          key: data.key,
          is_active: data.isActive,
          actions: data.actions,
          translates: data.translates,
        });
      }
      setIsRoleModalOpen(false);
    } catch {
      // Error is handled by mutation onError sileo notification
    }
  };

  const handleRequestToggleActive = (role: RoleItem) => {
    setRoleToToggle(role);
    setIsConfirmToggleOpen(true);
    handleCloseActionMenu();
  };

  const handleCloseConfirmToggle = () => {
    if (isMutating) return;
    setIsConfirmToggleOpen(false);
    setRoleToToggle(null);
  };

  const handleConfirmToggleActive = async () => {
    if (!roleToToggle) return;
    try {
      await updateRoleMutation.mutateAsync({
        roleId: roleToToggle.id,
        payload: {
          is_active: !roleToToggle.isActive,
        },
      });
      setIsConfirmToggleOpen(false);
      setRoleToToggle(null);
    } catch {
      // Error is handled by mutation onError sileo notification
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    sileo.info({
      title: t("roles:copy"),
      description: t("roles:copied"),
    });
  };

  // Filter application
  const handleApplyFilters = () => {
    setAppliedFilterRoleKeys(draftFilterRoleKeys);
    setAppliedFilterActions(draftFilterActions);
    setAppliedFilterActive(draftFilterActive);
    setPage(0);
  };

  const handleClearFilters = () => {
    setDraftFilterRoleKeys([]);
    setDraftFilterActions([]);
    setDraftFilterActive(true);
    setAppliedFilterRoleKeys([]);
    setAppliedFilterActions([]);
    setAppliedFilterActive(null);
    setPage(0);
  };

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterRoleKeys.length > 0) count += appliedFilterRoleKeys.length;
    if (appliedFilterActions.length > 0) count += appliedFilterActions.length;
    if (appliedFilterActive !== null) count += 1;
    return count;
  }, [appliedFilterRoleKeys, appliedFilterActions, appliedFilterActive]);

  // Filtered roles list
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const rawKey = role.key.toLowerCase();

      // 1. Search bar by key
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        if (!rawKey.includes(query)) {
          return false;
        }
      }

      // 2. Modal filter by Role
      if (appliedFilterRoleKeys.length > 0) {
        if (!appliedFilterRoleKeys.includes(role.key)) {
          return false;
        }
      }

      // 3. Modal filter by Actions
      if (appliedFilterActions.length > 0) {
        const hasMatchingAction = role.actions.some((action) =>
          appliedFilterActions.includes(action)
        );
        if (!hasMatchingAction) {
          return false;
        }
      }

      // 4. Modal filter by Active
      if (appliedFilterActive !== null) {
        if (role.isActive !== appliedFilterActive) {
          return false;
        }
      }

      return true;
    });
  }, [
    roles,
    searchTerm,
    appliedFilterRoleKeys,
    appliedFilterActions,
    appliedFilterActive,
  ]);

  return (
    <Box>
      <PageHeader>
        <PageTitleContainer>
          <SecurityOutlinedIcon color="primary" fontSize="large" />
          <PageTitle>{t("roles:title")}</PageTitle>
        </PageTitleContainer>
        <PageSubtitle>{t("roles:subtitle")}</PageSubtitle>
      </PageHeader>

      <FilterRow>
        <Filter
          onFilter={handleApplyFilters}
          onClear={handleClearFilters}
          activeCount={activeFiltersCount}
          title={t("roles:filter_modal_title")}
          subtitle={t("roles:filter_modal_subtitle")}
        >
          <SelectMultipleInput
            label={t("roles:table.key")}
            options={roleFilterOptions}
            value={draftFilterRoleKeys}
            onChange={setDraftFilterRoleKeys}
            placeholder={t("roles:form.key_placeholder")}
            disabled={
              isLoading ||
              isFetching ||
              isLoadingAllRoles ||
              isFetchingAllRoles
            }
          />

          <SelectMultipleInput
            label={t("roles:form.actions")}
            options={availableActionOptions}
            value={draftFilterActions}
            onChange={setDraftFilterActions}
            placeholder={t("roles:form.actions_placeholder")}
            disabled={isLoadingFilterActions || isFetchingFilterActions}
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
              label={t("roles:form.active")}
              labelPlacement="start"
              sx={{ m: 0, width: "100%", justifyContent: "space-between" }}
            />
          </Box>
        </Filter>
      </FilterRow>

      {activeFiltersCount > 0 && (
        <ActiveFilters>
          {appliedFilterRoleKeys.map((roleKey) => {
            const roleLabel = roleLabelsMap.get(roleKey) ?? roleKey;
            return (
              <FilterChips
                key={`role-${roleKey}`}
                label={t("roles:filter_chips.role", { value: roleLabel })}
                onAction={() => {
                  setAppliedFilterRoleKeys((prev) =>
                    prev.filter((k) => k !== roleKey)
                  );
                  setPage(0);
                }}
              />
            );
          })}
          {appliedFilterActions.map((actionKey) => {
            const actionLabel =
              actionLabelsMap.get(actionKey) ??
              t(`roles:action_names.${actionKey}`, actionKey);
            return (
              <FilterChips
                key={`action-${actionKey}`}
                label={t("roles:filter_chips.action", { value: actionLabel })}
                onAction={() => {
                  setAppliedFilterActions((prev) =>
                    prev.filter((a) => a !== actionKey)
                  );
                  setPage(0);
                }}
              />
            );
          })}
          {appliedFilterActive !== null && (
            <FilterChips
              label={
                appliedFilterActive
                  ? t("roles:filter_chips.active_only")
                  : t("roles:no")
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
              {t("roles:error_state.title", "Error al cargar los roles")}
            </AlertTitle>
            {error instanceof Error
              ? error.message
              : t(
                  "roles:error_state.description",
                  "No se pudo obtener el listado de roles desde el servidor."
                )}
          </Alert>
        </Box>
      )}

      <TableTopBar>
        <Box sx={{ width: { xs: "100%", sm: "340px" } }}>
          <InputSearch
            value={searchTerm}
            onChange={(val) => {
              setSearchTerm(val);
              setPage(0);
            }}
            placeholder={t("roles:search_placeholder")}
            fullWidth
            disabled={isLoading || isMutating}
          />
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddModeratorOutlinedIcon />}
          onClick={handleOpenCreateModal}
          disabled={isLoading || isFetching || isMutating}
          sx={(theme) => ({
            borderRadius: 2,
            color: theme.palette.primary.contrastText,
          })}
        >
          {t("roles:new_role")}
        </Button>
      </TableTopBar>

      <Skeleton loading={isLoading} name="roles-table">
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
                <TableCell>{t("roles:table.id")}</TableCell>
                <TableCell>{t("roles:table.name")}</TableCell>
                <TableCell>{t("roles:table.key")}</TableCell>
                <TableCell>{t("roles:table.actions")}</TableCell>
                <TableCell>{t("roles:table.active")}</TableCell>
                <TableCell align="center">
                  {t("roles:table.row_actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!isLoading && filteredRoles.length === 0 ? (
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
                      <SecurityOutlinedIcon
                        sx={{ fontSize: 48, color: "text.disabled" }}
                      />
                      <Typography variant="h6" color="text.secondary">
                        {t("roles:empty_state.title", "No hay roles disponibles")}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.disabled"
                        sx={{ maxWidth: 400 }}
                      >
                        {t(
                          "roles:empty_state.description",
                          "No se encontraron roles actualmente. Comience agregando uno nuevo."
                        )}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddModeratorOutlinedIcon />}
                        onClick={handleOpenCreateModal}
                        disabled={isLoading || isFetching || isMutating}
                        sx={{ mt: 1 }}
                      >
                        {t("roles:empty_state.cta", "Crear primer rol")}
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((role) => {
                  const maxVisibleActions = 2;
                  const visibleActions = role.actions.slice(0, maxVisibleActions);
                  const overflowCount = role.actions.length - maxVisibleActions;

                  const allActionsTooltip = (
                    <Box sx={{ p: 0.5 }}>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
                      >
                        {t("roles:all_actions_title", {
                          count: role.actions.length,
                        })}
                      </Typography>
                      <Box
                        component="ul"
                        sx={{ m: 0, pl: 2, fontSize: "0.75rem", lineHeight: 1.5 }}
                      >
                        {role.actions.map((act) => (
                          <li key={act}>
                            {actionCleanNamesMap.get(act) ??
                              (i18n.exists(`actions:action_names.${act}`)
                                ? t(`actions:action_names.${act}`)
                                : i18n.exists(`roles:action_names.${act}`)
                                ? t(`roles:action_names.${act}`)
                                : act)}
                          </li>
                        ))}
                      </Box>
                    </Box>
                  );

                  return (
                    <TableRow
                      key={role.id}
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
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          {role.id.includes("-")
                            ? `${role.id.split("-")[0]}...`
                            : role.id}
                          <Tooltip
                            title={t("roles:copy")}
                            arrow
                            placement="top"
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleCopyId(role.id)}
                              aria-label={t("roles:copy")}
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
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {role.name || t("roles:empty_value", "-")}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <KeyBadge>{role.key}</KeyBadge>
                      </TableCell>
                      <TableCell>
                        {role.actions && role.actions.length > 0 ? (
                          <ActionsWrapper>
                            {visibleActions.map((actionKey) => {
                              const label =
                                actionCleanNamesMap.get(actionKey) ??
                                (i18n.exists(`actions:action_names.${actionKey}`)
                                  ? t(`actions:action_names.${actionKey}`)
                                  : i18n.exists(`roles:action_names.${actionKey}`)
                                  ? t(`roles:action_names.${actionKey}`)
                                  : actionKey);
                              const category = actionKey.split(".")[0];
                              return (
                                <ActionTag
                                   key={actionKey}
                                  label={label}
                                  size="small"
                                  category={category}
                                />
                              );
                            })}
                            {overflowCount > 0 && (
                              <Tooltip
                                title={allActionsTooltip}
                                arrow
                                placement="top"
                              >
                                <MoreActionsChip
                                  label={t("roles:more_actions", {
                                    count: overflowCount,
                                  })}
                                  size="small"
                                />
                              </Tooltip>
                            )}
                          </ActionsWrapper>
                        ) : (
                          t("roles:empty_value")
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            role.isActive
                              ? t("roles:yes")
                              : t("roles:no")
                          }
                          color={role.isActive ? "success" : "error"}
                          size="small"
                          variant={role.isActive ? "filled" : "outlined"}
                          sx={
                            role.isActive
                              ? { color: "success.contrastText" }
                              : {}
                          }
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label={t("roles:table.row_actions")}
                          disabled={isLoading || isFetching || isMutating}
                          onClick={(e) => handleOpenActionMenu(e, role)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalItems}
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
          <ListItemText primary={t("roles:actions_menu.update")} />
        </MenuItem>
        {actionRole && (
          <MenuItem
            onClick={() => handleRequestToggleActive(actionRole)}
            sx={{ borderRadius: 1 }}
          >
            <ListItemIcon>
              {actionRole.isActive ? (
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
                actionRole.isActive
                  ? t("roles:deactivate")
                  : t("roles:activate")
              }
            />
          </MenuItem>
        )}
      </Menu>

      {/* Role Create / Edit Modal */}
      <RoleModal
        open={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onSubmit={handleSaveRole}
        initialData={selectedRoleForEdit}
        availableActions={availableActionOptions}
        isSubmitting={isMutating}
      />

      {/* Confirm Role Active/Inactive Dialog */}
      <ConfirmDialog
        open={isConfirmToggleOpen}
        onClose={handleCloseConfirmToggle}
        onConfirm={handleConfirmToggleActive}
        isLoading={isMutating}
        title={
          roleToToggle?.isActive
            ? t("roles:confirm_deactivate_title")
            : t("roles:confirm_activate_title")
        }
        message={
          roleToToggle?.isActive
            ? t("roles:confirm_deactivate_message", {
                name: roleToToggle?.key,
              })
            : t("roles:confirm_activate_message", {
                name: roleToToggle?.key,
              })
        }
      />
    </Box>
  );
};

export default Roles;
