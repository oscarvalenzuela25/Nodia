import type { FC, MouseEvent } from "react";
import { useState, useMemo, useCallback } from "react";
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
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import AddModeratorOutlinedIcon from "@mui/icons-material/AddModeratorOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import RoleModal from "./components/RoleModal";
import type { RoleItem, RoleFormData, ActionOption } from "./types";
import {
  PageHeader,
  PageTitleContainer,
  PageTitle,
  PageSubtitle,
  FilterRow,
  ActiveFilters,
  TableTopBar,
  RoleInfo,
  StyledTableContainer,
  KeyBadge,
  ActionsWrapper,
  ActionTag,
  MoreActionsChip,
} from "./styles";

const AVAILABLE_ACTION_KEYS = [
  "users.create",
  "users.read",
  "users.update",
  "users.delete",
  "roles.manage",
  "reports.view",
  "settings.edit",
  "audit.logs",
];

const INITIAL_ROLES: RoleItem[] = [
  {
    id: "123e4567-e89b-12d3-a456-426614174001",
    key: "admin",
    nameTranslations: {
      es: "Super Administrador",
      en: "Super Administrator",
    },
    actions: [
      "users.create",
      "users.read",
      "users.update",
      "users.delete",
      "roles.manage",
      "reports.view",
      "settings.edit",
      "audit.logs",
    ],
    isActive: true,
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174002",
    key: "manager",
    nameTranslations: {
      es: "Gerente de Operaciones",
      en: "Operations Manager",
    },
    actions: ["users.read", "users.update", "reports.view", "settings.edit"],
    isActive: true,
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174003",
    key: "editor",
    nameTranslations: {
      es: "Editor de Recursos",
      en: "Resource Editor",
    },
    actions: ["users.read", "reports.view"],
    isActive: true,
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174004",
    key: "support",
    nameTranslations: {
      es: "Soporte Técnico",
      en: "Technical Support",
    },
    actions: ["users.read", "audit.logs"],
    isActive: false,
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174005",
    key: "viewer",
    nameTranslations: {
      es: "Auditor de Consulta",
      en: "Read-Only Auditor",
    },
    actions: ["users.read", "reports.view", "audit.logs"],
    isActive: true,
  },
];

const Roles: FC = () => {
  const { t, i18n } = useTranslation(["roles", "core"]);

  const [roles, setRoles] = useState<RoleItem[]>(INITIAL_ROLES);
  const [searchTerm, setSearchTerm] = useState<string>("");

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

  // Action options with current language labels
  const availableActionOptions: ActionOption[] = useMemo(() => {
    return AVAILABLE_ACTION_KEYS.map((key) => ({
      value: key,
      label: t(`roles:action_names.${key}`, key),
      category: key.split(".")[0],
    }));
  }, [t]);

  const actionLabelsMap = useMemo(() => {
    const map = new Map<string, string>();
    availableActionOptions.forEach((opt) => map.set(opt.value, opt.label));
    return map;
  }, [availableActionOptions]);

  // Resolves the role name using translation or fallback
  const getRoleDisplayName = useCallback(
    (role: RoleItem): string => {
      const currentLang = i18n.language?.toLowerCase().startsWith("en")
        ? "en"
        : "es";

      // 1. Try translation key lookup
      if (i18n.exists(`roles:role_names.${role.key}`)) {
        return t(`roles:role_names.${role.key}`);
      }

      // 2. Try role's custom translations
      if (role.nameTranslations) {
        if (role.nameTranslations[currentLang]) {
          return role.nameTranslations[currentLang];
        }
        if (role.nameTranslations.es) {
          return role.nameTranslations.es;
        }
        if (role.nameTranslations.en) {
          return role.nameTranslations.en;
        }
      }

      return role.key;
    },
    [i18n, t]
  );

  // Role filter options for the filter modal
  const roleFilterOptions = useMemo(() => {
    return roles.map((role) => ({
      value: role.key,
      label: getRoleDisplayName(role),
    }));
  }, [roles, getRoleDisplayName]);

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
      setSelectedRoleForEdit({
        id: actionRole.id,
        key: actionRole.key,
        nameTranslations: actionRole.nameTranslations,
        actions: actionRole.actions,
        isActive: actionRole.isActive,
      });
      setIsRoleModalOpen(true);
    }
    handleCloseActionMenu();
  };

  const handleSaveRole = (data: RoleFormData) => {
    if (data.id) {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === data.id
            ? {
                ...r,
                key: data.key,
                nameTranslations: data.nameTranslations,
                actions: data.actions,
                isActive: data.isActive,
              }
            : r
        )
      );
    } else {
      const newRole: RoleItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : `rol-${Date.now()}`,
        key: data.key,
        nameTranslations: data.nameTranslations,
        actions: data.actions,
        isActive: data.isActive,
      };
      setRoles((prev) => [newRole, ...prev]);
    }
  };

  // Filter application
  const handleApplyFilters = () => {
    setAppliedFilterRoleKeys(draftFilterRoleKeys);
    setAppliedFilterActions(draftFilterActions);
    setAppliedFilterActive(draftFilterActive);
  };

  const handleClearFilters = () => {
    setDraftFilterRoleKeys([]);
    setDraftFilterActions([]);
    setDraftFilterActive(true);
    setAppliedFilterRoleKeys([]);
    setAppliedFilterActions([]);
    setAppliedFilterActive(null);
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
      const displayName = getRoleDisplayName(role).toLowerCase();
      const rawKey = role.key.toLowerCase();

      // 1. Search bar by name or key
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = displayName.includes(query);
        const matchesKey = rawKey.includes(query);
        if (!matchesName && !matchesKey) {
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
    getRoleDisplayName,
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
            label={t("roles:table.name")}
            options={roleFilterOptions}
            value={draftFilterRoleKeys}
            onChange={setDraftFilterRoleKeys}
            placeholder={t("roles:form.key_placeholder")}
          />

          <SelectMultipleInput
            label={t("roles:form.actions")}
            options={availableActionOptions}
            value={draftFilterActions}
            onChange={setDraftFilterActions}
            placeholder={t("roles:form.actions_placeholder")}
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
            const matchedRole = roles.find((r) => r.key === roleKey);
            const label = matchedRole ? getRoleDisplayName(matchedRole) : roleKey;
            return (
              <FilterChips
                key={`role-${roleKey}`}
                label={t("roles:filter_chips.role", { value: label })}
                onAction={() =>
                  setAppliedFilterRoleKeys((prev) =>
                    prev.filter((k) => k !== roleKey)
                  )
                }
              />
            );
          })}
          {appliedFilterActions.map((actionKey) => {
            const actionLabel = actionLabelsMap.get(actionKey) ?? actionKey;
            return (
              <FilterChips
                key={`action-${actionKey}`}
                label={t("roles:filter_chips.action", { value: actionLabel })}
                onAction={() =>
                  setAppliedFilterActions((prev) =>
                    prev.filter((a) => a !== actionKey)
                  )
                }
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
              onAction={() => setAppliedFilterActive(null)}
            />
          )}
        </ActiveFilters>
      )}

      <TableTopBar>
        <Box sx={{ width: { xs: "100%", sm: "340px" } }}>
          <InputSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t("roles:search_placeholder")}
            fullWidth
          />
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddModeratorOutlinedIcon />}
          onClick={handleOpenCreateModal}
          sx={(theme) => ({
            borderRadius: 2,
            color: theme.palette.primary.contrastText,
          })}
        >
          {t("roles:new_role")}
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
              {filteredRoles.length === 0 ? (
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
                filteredRoles.map((role) => {
                  const displayName = getRoleDisplayName(role);
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
                            {actionLabelsMap.get(act) ?? act}
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
                          {role.id.split("-")[0]}...
                          <Tooltip
                            title={t("roles:copy")}
                            arrow
                            placement="top"
                          >
                            <IconButton
                              size="small"
                              onClick={() =>
                                navigator.clipboard.writeText(role.id)
                              }
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
                        <RoleInfo>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "medium" }}
                          >
                            {displayName}
                          </Typography>
                        </RoleInfo>
                      </TableCell>
                      <TableCell>
                        <KeyBadge>{role.key}</KeyBadge>
                      </TableCell>
                      <TableCell>
                        {role.actions && role.actions.length > 0 ? (
                          <ActionsWrapper>
                            {visibleActions.map((actionKey) => {
                              const label =
                                actionLabelsMap.get(actionKey) ?? actionKey;
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
          <ListItemText primary={t("roles:actions_menu.update")} />
        </MenuItem>
      </Menu>

      {/* Role Create / Edit Modal */}
      <RoleModal
        open={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onSubmit={handleSaveRole}
        initialData={selectedRoleForEdit}
        availableActions={availableActionOptions}
      />
    </Box>
  );
};

export default Roles;
