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
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import ActionModal from "./components/ActionModal";
import type { ActionItem, ActionFormData, ModuleOption } from "./types";
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
  ModuleTag,
  DescriptionTypography,
} from "./styles";

const AVAILABLE_MODULE_KEYS = ["users", "roles", "settings", "reports", "auth"];

const INITIAL_ACTIONS: ActionItem[] = [
  {
    id: "a1114567-e89b-12d3-a456-426614174001",
    key: "users.create",
    nameTranslations: {
      es: "Crear Usuarios",
      en: "Create Users",
    },
    description: "Permite registrar nuevos usuarios en la plataforma y asignarles credenciales.",
    moduleKey: "users",
    isActive: true,
  },
  {
    id: "a1114567-e89b-12d3-a456-426614174002",
    key: "users.read",
    nameTranslations: {
      es: "Ver Usuarios",
      en: "View Users",
    },
    description: "Permite visualizar el listado y el detalle de los usuarios registrados.",
    moduleKey: "users",
    isActive: true,
  },
  {
    id: "a1114567-e89b-12d3-a456-426614174003",
    key: "users.update",
    nameTranslations: {
      es: "Editar Usuarios",
      en: "Edit Users",
    },
    description: "Permite actualizar datos personales, roles y estados de los usuarios.",
    moduleKey: "users",
    isActive: true,
  },
  {
    id: "a1114567-e89b-12d3-a456-426614174004",
    key: "users.delete",
    nameTranslations: {
      es: "Eliminar Usuarios",
      en: "Delete Users",
    },
    description: "Permite la desactivación o borrado lógico de usuarios en el sistema.",
    moduleKey: "users",
    isActive: true,
  },
  {
    id: "a2224567-e89b-12d3-a456-426614174001",
    key: "roles.manage",
    nameTranslations: {
      es: "Gestionar Roles",
      en: "Manage Roles",
    },
    description: "Permite crear, editar identificadores y asignar acciones permitidas a roles.",
    moduleKey: "roles",
    isActive: true,
  },
  {
    id: "a3334567-e89b-12d3-a456-426614174001",
    key: "settings.edit",
    nameTranslations: {
      es: "Configuración General",
      en: "General Settings",
    },
    description: "Permite modificar parámetros globales y preferencias de la aplicación.",
    moduleKey: "settings",
    isActive: true,
  },
  {
    id: "a4444567-e89b-12d3-a456-426614174001",
    key: "reports.view",
    nameTranslations: {
      es: "Ver Reportes",
      en: "View Reports",
    },
    description: "Permite consultar estadísticas, gráficos y resúmenes de rendimiento.",
    moduleKey: "reports",
    isActive: true,
  },
  {
    id: "a4444567-e89b-12d3-a456-426614174002",
    key: "reports.export",
    nameTranslations: {
      es: "Exportar Reportes",
      en: "Export Reports",
    },
    description: "Generación y descarga de archivos de métricas en formatos CSV y PDF.",
    moduleKey: "reports",
    isActive: false,
  },
  {
    id: "a5554567-e89b-12d3-a456-426614174001",
    key: "audit.logs",
    nameTranslations: {
      es: "Auditoría y Logs",
      en: "Audit & Logs",
    },
    description: "Permite consultar el registro histórico de eventos y cambios de seguridad.",
    moduleKey: null,
    isActive: true,
  },
];

const Actions: FC = () => {
  const { t, i18n } = useTranslation(["actions", "core"]);

  const [actions, setActions] = useState<ActionItem[]>(INITIAL_ACTIONS);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Filter modal draft state
  const [draftFilterActionKeys, setDraftFilterActionKeys] = useState<string[]>(
    []
  );
  const [draftFilterModuleKeys, setDraftFilterModuleKeys] = useState<string[]>(
    []
  );
  const [draftFilterActive, setDraftFilterActive] = useState<boolean>(true);

  // Applied filter state
  const [appliedFilterActionKeys, setAppliedFilterActionKeys] = useState<
    string[]
  >([]);
  const [appliedFilterModuleKeys, setAppliedFilterModuleKeys] = useState<
    string[]
  >([]);
  const [appliedFilterActive, setAppliedFilterActive] = useState<
    boolean | null
  >(null);

  // Action Create / Edit Modal state
  const [isActionModalOpen, setIsActionModalOpen] = useState<boolean>(false);
  const [selectedActionForEdit, setSelectedActionForEdit] =
    useState<ActionFormData | null>(null);

  // Table row actions menu
  const [actionMenuAnchor, setActionMenuAnchor] =
    useState<HTMLButtonElement | null>(null);
  const [targetAction, setTargetAction] = useState<ActionItem | null>(null);

  // Module options with translated labels
  const availableModuleOptions: ModuleOption[] = useMemo(() => {
    return AVAILABLE_MODULE_KEYS.map((key) => ({
      value: key,
      label: t(`actions:module_names.${key}`, key),
      category: key,
    }));
  }, [t]);

  const moduleLabelsMap = useMemo(() => {
    const map = new Map<string, string>();
    availableModuleOptions.forEach((opt) => map.set(opt.value, opt.label));
    return map;
  }, [availableModuleOptions]);

  const getModuleDisplayName = useCallback(
    (moduleKey: string | null): string => {
      if (!moduleKey) {
        return t("actions:no_module", "Sin módulo asociado");
      }
      if (i18n.exists(`actions:module_names.${moduleKey}`)) {
        return t(`actions:module_names.${moduleKey}`);
      }
      return moduleLabelsMap.get(moduleKey) ?? moduleKey;
    },
    [i18n, t, moduleLabelsMap]
  );

  // Resolves the action name using translation or fallback
  const getActionDisplayName = useCallback(
    (action: ActionItem): string => {
      const currentLang = i18n.language?.toLowerCase().startsWith("en")
        ? "en"
        : "es";

      // 1. Try translation key lookup
      if (i18n.exists(`actions:action_names.${action.key}`)) {
        return t(`actions:action_names.${action.key}`);
      }

      // 2. Try action's custom translations
      if (action.nameTranslations) {
        if (action.nameTranslations[currentLang]) {
          return action.nameTranslations[currentLang];
        }
        if (action.nameTranslations.es) {
          return action.nameTranslations.es;
        }
        if (action.nameTranslations.en) {
          return action.nameTranslations.en;
        }
      }

      return action.key;
    },
    [i18n, t]
  );

  // Action filter options for the filter modal
  const actionFilterOptions = useMemo(() => {
    return actions.map((act) => ({
      value: act.key,
      label: getActionDisplayName(act),
    }));
  }, [actions, getActionDisplayName]);

  // Module filter options for the filter modal (including 'none')
  const moduleFilterOptions = useMemo(() => {
    const list: ModuleOption[] = [...availableModuleOptions];
    list.push({
      value: "none",
      label: t("actions:no_module", "Sin módulo asociado"),
    });
    return list;
  }, [availableModuleOptions, t]);

  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    action: ActionItem
  ) => {
    setActionMenuAnchor(e.currentTarget);
    setTargetAction(action);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
    setTargetAction(null);
  };

  const handleOpenCreateModal = () => {
    setSelectedActionForEdit(null);
    setIsActionModalOpen(true);
  };

  const handleOpenEditModal = () => {
    if (targetAction) {
      setSelectedActionForEdit({
        id: targetAction.id,
        key: targetAction.key,
        nameTranslations: targetAction.nameTranslations,
        description: targetAction.description,
        moduleKey: targetAction.moduleKey,
        isActive: targetAction.isActive,
      });
      setIsActionModalOpen(true);
    }
    handleCloseActionMenu();
  };

  const handleSaveAction = (data: ActionFormData) => {
    if (data.id) {
      setActions((prev) =>
        prev.map((a) =>
          a.id === data.id
            ? {
                ...a,
                key: data.key,
                nameTranslations: data.nameTranslations,
                description: data.description,
                moduleKey: data.moduleKey,
                isActive: data.isActive,
              }
            : a
        )
      );
    } else {
      const newAction: ActionItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : `act-${Date.now()}`,
        key: data.key,
        nameTranslations: data.nameTranslations,
        description: data.description,
        moduleKey: data.moduleKey,
        isActive: data.isActive,
      };
      setActions((prev) => [newAction, ...prev]);
    }
  };

  // Filter application
  const handleApplyFilters = () => {
    setAppliedFilterActionKeys(draftFilterActionKeys);
    setAppliedFilterModuleKeys(draftFilterModuleKeys);
    setAppliedFilterActive(draftFilterActive);
  };

  const handleClearFilters = () => {
    setDraftFilterActionKeys([]);
    setDraftFilterModuleKeys([]);
    setDraftFilterActive(true);
    setAppliedFilterActionKeys([]);
    setAppliedFilterModuleKeys([]);
    setAppliedFilterActive(null);
  };

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterActionKeys.length > 0)
      count += appliedFilterActionKeys.length;
    if (appliedFilterModuleKeys.length > 0)
      count += appliedFilterModuleKeys.length;
    if (appliedFilterActive !== null) count += 1;
    return count;
  }, [appliedFilterActionKeys, appliedFilterModuleKeys, appliedFilterActive]);

  // Filtered actions list
  const filteredActions = useMemo(() => {
    return actions.filter((act) => {
      const displayName = getActionDisplayName(act).toLowerCase();
      const rawKey = act.key.toLowerCase();
      const desc = act.description?.toLowerCase() ?? "";
      const moduleName = act.moduleKey
        ? getModuleDisplayName(act.moduleKey).toLowerCase()
        : "";

      // 1. Search bar by name, key, description, or module
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matches =
          displayName.includes(query) ||
          rawKey.includes(query) ||
          desc.includes(query) ||
          moduleName.includes(query);
        if (!matches) {
          return false;
        }
      }

      // 2. Modal filter by Action Key
      if (appliedFilterActionKeys.length > 0) {
        if (!appliedFilterActionKeys.includes(act.key)) {
          return false;
        }
      }

      // 3. Modal filter by Module
      if (appliedFilterModuleKeys.length > 0) {
        const actModKey = act.moduleKey ?? "none";
        if (!appliedFilterModuleKeys.includes(actModKey)) {
          return false;
        }
      }

      // 4. Modal filter by Active
      if (appliedFilterActive !== null) {
        if (act.isActive !== appliedFilterActive) {
          return false;
        }
      }

      return true;
    });
  }, [
    actions,
    searchTerm,
    appliedFilterActionKeys,
    appliedFilterModuleKeys,
    appliedFilterActive,
    getActionDisplayName,
    getModuleDisplayName,
  ]);

  return (
    <Box>
      <PageHeader>
        <PageTitleContainer>
          <BoltOutlinedIcon color="primary" fontSize="large" />
          <PageTitle>{t("actions:title")}</PageTitle>
        </PageTitleContainer>
        <PageSubtitle>{t("actions:subtitle")}</PageSubtitle>
      </PageHeader>

      <FilterRow>
        <Filter
          onFilter={handleApplyFilters}
          onClear={handleClearFilters}
          activeCount={activeFiltersCount}
          title={t("actions:filter_modal_title")}
          subtitle={t("actions:filter_modal_subtitle")}
        >
          <SelectMultipleInput
            label={t("actions:table.name")}
            options={actionFilterOptions}
            value={draftFilterActionKeys}
            onChange={setDraftFilterActionKeys}
            placeholder={t("actions:form.key_placeholder")}
          />

          <SelectMultipleInput
            label={t("actions:table.module")}
            options={moduleFilterOptions}
            value={draftFilterModuleKeys}
            onChange={setDraftFilterModuleKeys}
            placeholder={t("actions:form.module_placeholder")}
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
              label={t("actions:form.active")}
              labelPlacement="start"
              sx={{ m: 0, width: "100%", justifyContent: "space-between" }}
            />
          </Box>
        </Filter>
      </FilterRow>

      {activeFiltersCount > 0 && (
        <ActiveFilters>
          {appliedFilterActionKeys.map((actionKey) => {
            const matchedAction = actions.find((a) => a.key === actionKey);
            const label = matchedAction
              ? getActionDisplayName(matchedAction)
              : actionKey;
            return (
              <FilterChips
                key={`action-${actionKey}`}
                label={t("actions:filter_chips.action", { value: label })}
                onAction={() =>
                  setAppliedFilterActionKeys((prev) =>
                    prev.filter((k) => k !== actionKey)
                  )
                }
              />
            );
          })}
          {appliedFilterModuleKeys.map((moduleKey) => {
            const label =
              moduleKey === "none"
                ? t("actions:no_module", "Sin módulo asociado")
                : getModuleDisplayName(moduleKey);
            return (
              <FilterChips
                key={`mod-${moduleKey}`}
                label={t("actions:filter_chips.module", { value: label })}
                onAction={() =>
                  setAppliedFilterModuleKeys((prev) =>
                    prev.filter((m) => m !== moduleKey)
                  )
                }
              />
            );
          })}
          {appliedFilterActive !== null && (
            <FilterChips
              label={
                appliedFilterActive
                  ? t("actions:filter_chips.active_only")
                  : t("actions:no")
              }
              onAction={() => setAppliedFilterActive(null)}
            />
          )}
        </ActiveFilters>
      )}

      <TableTopBar>
        <Box sx={{ width: { xs: "100%", sm: "360px" } }}>
          <InputSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t("actions:search_placeholder")}
            fullWidth
          />
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlinedIcon />}
          onClick={handleOpenCreateModal}
          sx={(theme) => ({
            borderRadius: 2,
            color: theme.palette.primary.contrastText,
          })}
        >
          {t("actions:new_action")}
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
                <TableCell>{t("actions:table.id")}</TableCell>
                <TableCell>{t("actions:table.name")}</TableCell>
                <TableCell>{t("actions:table.key")}</TableCell>
                <TableCell>{t("actions:table.description")}</TableCell>
                <TableCell>{t("actions:table.module")}</TableCell>
                <TableCell>{t("actions:table.active")}</TableCell>
                <TableCell align="center">
                  {t("actions:table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredActions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    sx={{ py: 4, color: "text.secondary" }}
                  >
                    {t("core:no_options_found")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredActions.map((act) => {
                  const displayName = getActionDisplayName(act);
                  const moduleDisplayName = getModuleDisplayName(act.moduleKey);

                  return (
                    <TableRow
                      key={act.id}
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
                          {act.id.split("-")[0]}...
                          <Tooltip
                            title={t("actions:copy")}
                            arrow
                            placement="top"
                          >
                            <IconButton
                              size="small"
                              onClick={() =>
                                navigator.clipboard.writeText(act.id)
                              }
                              aria-label={t("actions:copy")}
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
                          {displayName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <KeyBadge>{act.key}</KeyBadge>
                      </TableCell>
                      <TableCell>
                        {act.description ? (
                          <DescriptionTypography>
                            {act.description}
                          </DescriptionTypography>
                        ) : (
                          t("actions:empty_value")
                        )}
                      </TableCell>
                      <TableCell>
                        <ModuleTag
                          hasModule={Boolean(act.moduleKey)}
                          moduleKey={act.moduleKey}
                          label={moduleDisplayName}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            act.isActive
                              ? t("actions:yes")
                              : t("actions:no")
                          }
                          color={act.isActive ? "success" : "error"}
                          size="small"
                          variant={act.isActive ? "filled" : "outlined"}
                          sx={
                            act.isActive
                              ? { color: "success.contrastText" }
                              : {}
                          }
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label={t("actions:table.actions")}
                          onClick={(e) => handleOpenActionMenu(e, act)}
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
          <ListItemText primary={t("actions:actions_menu.update")} />
        </MenuItem>
      </Menu>

      {/* Action Create / Edit Modal */}
      <ActionModal
        open={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        onSubmit={handleSaveAction}
        initialData={selectedActionForEdit}
        availableModules={availableModuleOptions}
      />
    </Box>
  );
};

export default Actions;
