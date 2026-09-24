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
  TablePagination,
  Alert,
  AlertTitle,
  LinearProgress,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";

import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import ModuleModal from "./components/ModuleModal";
import ModuleGroupModal from "./components/ModuleGroupModal";
import { getModuleIcon, getGroupIcon } from "../../../../store/generalSettings";
import type {
  ModuleEntity,
  ModuleFormData,
  ModuleGroupEntity,
  ModuleGroupFormData,
  ModuleGroupSummary,
} from "./types";
import {
  useModules,
  useCreateModule,
  useUpdateModule,
  useModuleGroups,
  useCreateModuleGroup,
  useUpdateModuleGroup,
} from "./infrastructure/useServices";
import {
  PageHeader,
  PageTitleContainer,
  PageTitle,
  PageSubtitle,
  HeaderRow,
  ViewModeContainer,
  GroupsSectionCard,
  GroupsSectionHeader,
  GroupsHeaderInfo,
  GroupsHeaderActions,
  FilterRow,
  ActiveFilters,
  TableTopBar,
  StyledTableContainer,
  KeyBadge,
} from "./styles";

type ViewMode = "split" | "modules" | "groups";

const Modules: FC = () => {
  const { t, i18n } = useTranslation(["modules", "core"]);

  // Perspective view mode: split, modules, groups
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isGroupsExpanded, setIsGroupsExpanded] = useState<boolean>(true);

  // Search and Pagination for Modules
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Search and Pagination for Module Groups
  const [searchTermGroups, setSearchTermGroups] = useState<string>("");
  const [pageGroups, setPageGroups] = useState<number>(0);
  const [rowsPerPageGroups, setRowsPerPageGroups] = useState<number>(5);

  // Filter modal draft state for Modules
  const [draftFilterKeys, setDraftFilterKeys] = useState<string[]>([]);
  const [draftFilterGroupIds, setDraftFilterGroupIds] = useState<string[]>([]);
  const [draftFilterActive, setDraftFilterActive] = useState<boolean>(true);

  // Applied filter state for Modules
  const [appliedFilterKeys, setAppliedFilterKeys] = useState<string[]>([]);
  const [appliedFilterGroupIds, setAppliedFilterGroupIds] = useState<string[]>([]);
  const [appliedFilterActive, setAppliedFilterActive] = useState<boolean | null>(null);

  // Module Create / Edit Modal state
  const [isModuleModalOpen, setIsModuleModalOpen] = useState<boolean>(false);
  const [selectedModuleForEdit, setSelectedModuleForEdit] =
    useState<ModuleFormData | null>(null);

  // Module Group Create / Edit Modal state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [selectedGroupForEdit, setSelectedGroupForEdit] =
    useState<ModuleGroupFormData | null>(null);

  // Module row actions menu
  const [actionMenuAnchor, setActionMenuAnchor] =
    useState<HTMLButtonElement | null>(null);
  const [targetModule, setTargetModule] = useState<ModuleEntity | null>(null);

  // Group row actions menu
  const [groupActionMenuAnchor, setGroupActionMenuAnchor] =
    useState<HTMLButtonElement | null>(null);
  const [targetGroup, setTargetGroup] = useState<ModuleGroupEntity | null>(null);

  // Confirm Active / Inactive Dialog state for Module
  const [moduleToToggle, setModuleToToggle] = useState<ModuleEntity | null>(null);
  const [isConfirmToggleOpen, setIsConfirmToggleOpen] = useState<boolean>(false);

  // Confirm Active / Inactive Dialog state for Group
  const [groupToToggle, setGroupToToggle] = useState<ModuleGroupEntity | null>(null);
  const [isConfirmToggleGroupOpen, setIsConfirmToggleGroupOpen] =
    useState<boolean>(false);

  // Helper: resolves translated name for a module
  const getModuleDisplayName = useCallback(
    (keyOrModule: string | ModuleEntity): string => {
      if (typeof keyOrModule === "object" && keyOrModule) {
        const lang = i18n.language?.startsWith("en") ? "en" : "es";
        const altLang = lang === "en" ? "es" : "en";
        const keyTrans = keyOrModule.translates?.find((tr) => tr.key === "key");
        const translated = keyTrans?.[lang] || keyTrans?.[altLang];
        if (translated) return translated;
      }
      const key =
        typeof keyOrModule === "string" ? keyOrModule : keyOrModule.key;

      if (i18n.exists(`modules:module_names.${key}`)) {
        return t(`modules:module_names.${key}`);
      }

      return t("modules:empty_value", "-");
    },
    [i18n, t]
  );

  // Helper: resolves translated name for a module group
  const getGroupDisplayName = useCallback(
    (group?: ModuleGroupSummary | ModuleGroupEntity | null): string => {
      if (!group) return t("modules:empty_value", "-");
      const lang = i18n.language?.startsWith("en") ? "en" : "es";
      const altLang = lang === "en" ? "es" : "en";
      const keyTrans = group.translates?.find((tr) => tr.key === "key");
      const translated = keyTrans?.[lang] || keyTrans?.[altLang];
      if (translated) return translated;
      return group.key || t("modules:empty_value", "-");
    },
    [i18n, t]
  );

  // Query: All modules for filter dropdowns (all=true, includes=false)
  const {
    data: allModulesResponse,
    isLoading: isLoadingAllModules,
    isFetching: isFetchingAllModules,
  } = useModules({ all: true, includes: false });

  // Query: All module groups for filter dropdowns
  const {
    data: allGroupsResponse,
    isLoading: isLoadingAllGroups,
    isFetching: isFetchingAllGroups,
  } = useModuleGroups({ all: true });

  const allModulesData = allModulesResponse?.data;
  // Key filter options for modules
  const keyFilterOptions = useMemo(() => {
    if (!allModulesData) return [];
    return allModulesData.map((m) => {
      const name = getModuleDisplayName(m);
      return {
        value: m.key,
        label: name !== "-" ? `${name} (${m.key})` : m.key,
      };
    });
  }, [allModulesData, getModuleDisplayName]);

  const allGroupsData = allGroupsResponse?.data;
  // Group filter options for modules formatted as Translate (key)
  const groupFilterOptions = useMemo(() => {
    if (!allGroupsData) return [];
    return allGroupsData.map((g) => {
      const name = getGroupDisplayName(g);
      return {
        value: g.id,
        label: name !== "-" && name !== g.key ? `${name} (${g.key})` : g.key,
      };
    });
  }, [allGroupsData, getGroupDisplayName]);

  // Ransack query for paginated modules table
  const ransackQueryModules = useMemo(() => {
    const q: Record<string, unknown> = {};

    if (searchTerm.trim()) {
      q.key_cont = searchTerm.trim();
    }
    if (appliedFilterKeys.length > 0) {
      q.key_in = appliedFilterKeys;
    }
    if (appliedFilterGroupIds.length > 0) {
      q.module_group_id_in = appliedFilterGroupIds;
    }
    if (appliedFilterActive !== null) {
      q.is_active_eq = appliedFilterActive;
    }

    return Object.keys(q).length > 0 ? q : undefined;
  }, [
    searchTerm,
    appliedFilterKeys,
    appliedFilterGroupIds,
    appliedFilterActive,
  ]);

  // Query: Paginated modules for table (with includes=true)
  const {
    data: modulesResponse,
    isLoading: isLoadingModules,
    isFetching: isFetchingModules,
    isError: isErrorModules,
    error: modulesError,
    refetch: refetchModules,
  } = useModules({
    page: page + 1,
    size: rowsPerPage,
    includes: true,
    q: ransackQueryModules,
  });

  // Ransack query for paginated module groups
  const ransackQueryGroups = useMemo(() => {
    const q: Record<string, unknown> = {};
    if (searchTermGroups.trim()) {
      q.key_cont = searchTermGroups.trim();
    }
    return Object.keys(q).length > 0 ? q : undefined;
  }, [searchTermGroups]);

  // Query: Paginated module groups
  const {
    data: groupsResponse,
    isLoading: isLoadingGroups,
    isFetching: isFetchingGroups,
    isError: isErrorGroups,
    error: groupsError,
    refetch: refetchGroups,
  } = useModuleGroups({
    page: pageGroups + 1,
    limit: rowsPerPageGroups,
    q: ransackQueryGroups,
  });

  // Module Mutations
  const createModuleMutation = useCreateModule();
  const updateModuleMutation = useUpdateModule();
  const isMutatingModule =
    createModuleMutation.isPending || updateModuleMutation.isPending;
  const isBusyModules =
    isLoadingModules || isFetchingModules || isMutatingModule;

  // Group Mutations
  const createGroupMutation = useCreateModuleGroup();
  const updateGroupMutation = useUpdateModuleGroup();
  const isMutatingGroup =
    createGroupMutation.isPending || updateGroupMutation.isPending;
  const isBusyGroups =
    isLoadingGroups || isFetchingGroups || isMutatingGroup;

  const modulesList: ModuleEntity[] = useMemo(
    () => modulesResponse?.data ?? [],
    [modulesResponse?.data]
  );
  const totalModulesCount = modulesResponse?.meta?.total_items ?? 0;

  const groupsList: ModuleGroupEntity[] = useMemo(
    () => groupsResponse?.data ?? [],
    [groupsResponse?.data]
  );
  const totalGroupsCount = groupsResponse?.meta?.total_items ?? 0;

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    sileo.info({
      title: t("modules:copy"),
      description: t("modules:copied"),
    });
  };

  const domain =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost:5173";

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    sileo.info({
      title: t("modules:notifications.link_copied_title", "Enlace copiado"),
      description: t(
        "modules:notifications.link_copied_desc",
        "La URL del módulo ha sido copiada al portapapeles."
      ),
    });
  };

  const getModuleFullUrl = (link?: string): string => {
    if (!link) return "";
    if (link.startsWith("http://") || link.startsWith("https://")) {
      return link;
    }
    return `${domain}${link.startsWith("/") ? link : `/${link}`}`;
  };

  // Module Row Actions
  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    item: ModuleEntity
  ) => {
    setActionMenuAnchor(e.currentTarget);
    setTargetModule(item);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
    setTargetModule(null);
  };

  const handleOpenCreateModal = () => {
    setSelectedModuleForEdit(null);
    setIsModuleModalOpen(true);
  };

  const handleOpenEditModal = () => {
    if (targetModule) {
      const transItem = targetModule.translates?.find((tr) => tr.key === "key");
      setSelectedModuleForEdit({
        id: targetModule.id,
        key: targetModule.key,
        link: targetModule.link || "",
        icon: targetModule.icon || null,
        module_group_id:
          targetModule.module_group_id ||
          targetModule.module_group?.id ||
          "",
        nameTranslations: {
          es: transItem?.es || "",
          en: transItem?.en || "",
        },
        isActive: targetModule.is_active ?? true,
      });
      setIsModuleModalOpen(true);
    }
    handleCloseActionMenu();
  };

  const handleRequestToggleActive = (item: ModuleEntity) => {
    setModuleToToggle(item);
    setIsConfirmToggleOpen(true);
    handleCloseActionMenu();
  };

  const handleCloseConfirmToggle = () => {
    setIsConfirmToggleOpen(false);
    setModuleToToggle(null);
  };

  const handleConfirmToggleActive = async () => {
    if (!moduleToToggle) return;
    try {
      await updateModuleMutation.mutateAsync({
        moduleId: moduleToToggle.id,
        payload: {
          is_active: !(moduleToToggle.is_active ?? true),
        },
      });
      setIsConfirmToggleOpen(false);
      setModuleToToggle(null);
    } catch {
      // Toast handled by onError in hook
    }
  };

  const handleSaveModule = async (data: ModuleFormData) => {
    try {
      if (data.id) {
        await updateModuleMutation.mutateAsync({
          moduleId: data.id,
          payload: {
            key: data.key,
            module_group_id: data.module_group_id,
            link: data.link,
            icon: data.icon,
            is_active: data.isActive,
            translates: data.translates,
          },
        });
      } else {
        await createModuleMutation.mutateAsync({
          key: data.key,
          module_group_id: data.module_group_id,
          link: data.link,
          icon: data.icon,
          is_active: data.isActive,
          translates: data.translates,
        });
      }
      setIsModuleModalOpen(false);
      setSelectedModuleForEdit(null);
    } catch {
      // Toast handled by onError in hook
    }
  };

  // Group Row Actions
  const handleOpenGroupActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    group: ModuleGroupEntity
  ) => {
    setGroupActionMenuAnchor(e.currentTarget);
    setTargetGroup(group);
  };

  const handleCloseGroupActionMenu = () => {
    setGroupActionMenuAnchor(null);
    setTargetGroup(null);
  };

  const handleOpenCreateGroupModal = () => {
    setSelectedGroupForEdit(null);
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroupModal = () => {
    if (targetGroup) {
      const transItem = targetGroup.translates?.find((tr) => tr.key === "key");
      setSelectedGroupForEdit({
        id: targetGroup.id,
        key: targetGroup.key,
        icon: targetGroup.icon || null,
        nameTranslations: {
          es: transItem?.es || "",
          en: transItem?.en || "",
        },
        isActive: targetGroup.is_active ?? true,
      });
      setIsGroupModalOpen(true);
    }
    handleCloseGroupActionMenu();
  };

  const handleRequestToggleActiveGroup = (group: ModuleGroupEntity) => {
    setGroupToToggle(group);
    setIsConfirmToggleGroupOpen(true);
    handleCloseGroupActionMenu();
  };

  const handleCloseConfirmToggleGroup = () => {
    setIsConfirmToggleGroupOpen(false);
    setGroupToToggle(null);
  };

  const handleConfirmToggleActiveGroup = async () => {
    if (!groupToToggle) return;
    try {
      await updateGroupMutation.mutateAsync({
        groupId: groupToToggle.id,
        payload: {
          is_active: !(groupToToggle.is_active ?? true),
        },
      });
      setIsConfirmToggleGroupOpen(false);
      setGroupToToggle(null);
    } catch {
      // Toast handled by onError in hook
    }
  };

  const handleSaveGroup = async (data: ModuleGroupFormData) => {
    try {
      if (data.id) {
        await updateGroupMutation.mutateAsync({
          groupId: data.id,
          payload: {
            key: data.key,
            icon: data.icon,
            is_active: data.isActive,
            translates: data.translates,
          },
        });
      } else {
        await createGroupMutation.mutateAsync({
          key: data.key,
          icon: data.icon,
          is_active: data.isActive,
          translates: data.translates,
        });
      }
      setIsGroupModalOpen(false);
      setSelectedGroupForEdit(null);
    } catch {
      // Toast handled by onError in hook
    }
  };

  // Quick filter modules by group from groups table row
  const handleQuickFilterByGroup = (groupId: string) => {
    setAppliedFilterGroupIds([groupId]);
    setPage(0);
    if (viewMode === "groups") {
      setViewMode("split");
    }
  };

  // Module filter application
  const handleApplyFilters = () => {
    setAppliedFilterKeys(draftFilterKeys);
    setAppliedFilterGroupIds(draftFilterGroupIds);
    setAppliedFilterActive(draftFilterActive);
    setPage(0);
  };

  const handleClearFilters = () => {
    setDraftFilterKeys([]);
    setDraftFilterGroupIds([]);
    setDraftFilterActive(true);
    setAppliedFilterKeys([]);
    setAppliedFilterGroupIds([]);
    setAppliedFilterActive(null);
    setPage(0);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterKeys.length > 0) count += appliedFilterKeys.length;
    if (appliedFilterGroupIds.length > 0) count += appliedFilterGroupIds.length;
    if (appliedFilterActive !== null) count += 1;
    return count;
  }, [appliedFilterKeys, appliedFilterGroupIds, appliedFilterActive]);

  const showGroups = viewMode === "split" || viewMode === "groups";
  const showModules = viewMode === "split" || viewMode === "modules";

  return (
    <Box>
      <HeaderRow>
        <PageHeader>
          <PageTitleContainer>
            <ViewModuleOutlinedIcon color="primary" fontSize="large" />
            <PageTitle>{t("modules:title")}</PageTitle>
          </PageTitleContainer>
          <PageSubtitle>{t("modules:subtitle")}</PageSubtitle>
        </PageHeader>

        <ViewModeContainer>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode: ViewMode | null) => {
              if (newMode) setViewMode(newMode);
            }}
            size="small"
            aria-label="perspective-view-modes"
            sx={{
              "& .MuiToggleButton-root": {
                border: 0,
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.8125rem",
                gap: 0.75,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": {
                    bgcolor: "primary.dark",
                  },
                },
              },
            }}
          >
            <ToggleButton value="split" aria-label={t("modules:views.split")}>
              <ViewAgendaOutlinedIcon fontSize="small" />
              {t("modules:views.split", "Vista Conjunta")}
            </ToggleButton>
            <ToggleButton value="modules" aria-label={t("modules:views.modules")}>
              <ViewModuleOutlinedIcon fontSize="small" />
              {t("modules:views.modules", "Solo Módulos")}
            </ToggleButton>
            <ToggleButton value="groups" aria-label={t("modules:views.groups")}>
              <CategoryOutlinedIcon fontSize="small" />
              {t("modules:views.groups", "Solo Grupos")}
            </ToggleButton>
          </ToggleButtonGroup>
        </ViewModeContainer>
      </HeaderRow>

      {/* ========================================================================= */}
      {/* MODULE GROUPS SECTION                                                     */}
      {/* ========================================================================= */}
      {showGroups && (
        <GroupsSectionCard elevation={0}>
          <GroupsSectionHeader>
            <GroupsHeaderInfo>
              <CategoryOutlinedIcon color="primary" />
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                    {t("modules:groups.title", "Grupos de Módulos")}
                  </Typography>
                  <Chip
                    label={totalGroupsCount}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.75rem", fontWeight: "bold" }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    "modules:groups.subtitle",
                    "Administra los grupos lógicos para clasificar y organizar los módulos del sistema."
                  )}
                </Typography>
              </Box>
            </GroupsHeaderInfo>

            <GroupsHeaderActions>
              <Box sx={{ width: { xs: "100%", sm: "240px" } }}>
                <InputSearch
                  value={searchTermGroups}
                  onChange={(val) => {
                    setSearchTermGroups(val);
                    setPageGroups(0);
                  }}
                  placeholder={t(
                    "modules:groups.search_placeholder",
                    "Buscar grupo..."
                  )}
                  fullWidth
                  disabled={isLoadingGroups || isMutatingGroup}
                />
              </Box>
              <Button
                variant="contained"
                size="small"
                color="primary"
                startIcon={<AddCircleOutlinedIcon />}
                onClick={handleOpenCreateGroupModal}
                disabled={isBusyGroups}
                sx={(theme) => ({
                  borderRadius: 2,
                  color: theme.palette.primary.contrastText,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                })}
              >
                {t("modules:groups.new_group", "Nuevo Grupo")}
              </Button>
              {viewMode === "split" && (
                <Tooltip
                  title={
                    isGroupsExpanded
                      ? t("modules:views.collapse_groups", "Colapsar grupos")
                      : t("modules:views.expand_groups", "Expandir grupos")
                  }
                >
                  <IconButton
                    size="small"
                    onClick={() => setIsGroupsExpanded((prev) => !prev)}
                    aria-label="toggle-groups-collapse"
                  >
                    {isGroupsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Tooltip>
              )}
            </GroupsHeaderActions>
          </GroupsSectionHeader>

          <Collapse in={viewMode === "groups" || isGroupsExpanded}>
            {isErrorGroups && (
              <Box sx={{ p: 2 }}>
                <Alert
                  severity="error"
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => refetchGroups()}
                    >
                      {t("core:retry", "Reintentar")}
                    </Button>
                  }
                >
                  <AlertTitle>
                    {t(
                      "modules:groups.notifications.created_error",
                      "Error al cargar grupos de módulos"
                    )}
                  </AlertTitle>
                  {groupsError instanceof Error
                    ? groupsError.message
                    : t("core:server_error_toast")}
                </Alert>
              </Box>
            )}

            <Skeleton loading={isLoadingGroups} name="module-groups-table">
              {isFetchingGroups && !isLoadingGroups && (
                <LinearProgress sx={{ height: 2 }} />
              )}
              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableHead
                    sx={{
                      bgcolor: "action.hover",
                      "& th": {
                        fontWeight: "bold",
                        color: "text.primary",
                      },
                    }}
                  >
                    <TableRow>
                      <TableCell>{t("modules:groups.table.id", "Id")}</TableCell>
                      <TableCell align="center">
                        {t("modules:groups.table.icon", "Ícono")}
                      </TableCell>
                      <TableCell>
                        {t("modules:groups.table.name", "Nombre del Grupo")}
                      </TableCell>
                      <TableCell>
                        {t("modules:groups.table.key", "Identificador")}
                      </TableCell>
                      <TableCell>
                        {t("modules:groups.table.active", "Activo")}
                      </TableCell>
                      <TableCell align="center">
                        {t("modules:groups.table.actions", "Acciones")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoadingGroups && groupsList.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          align="center"
                          sx={{ py: 4, color: "text.secondary" }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <CategoryOutlinedIcon
                              sx={{ fontSize: 36, color: "text.disabled" }}
                            />
                            <Typography variant="body1" color="text.secondary">
                              {t(
                                "modules:groups.empty_state.title",
                                "No hay grupos de módulos disponibles"
                              )}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.disabled"
                              sx={{ maxWidth: 360 }}
                            >
                              {t(
                                "modules:groups.empty_state.description",
                                "No se encontraron grupos actualmente. Comience agregando uno nuevo."
                              )}
                            </Typography>
                            <Button
                              variant="contained"
                              size="small"
                              color="primary"
                              startIcon={<AddCircleOutlinedIcon />}
                              onClick={handleOpenCreateGroupModal}
                              disabled={isBusyGroups}
                              sx={(theme) => ({
                                mt: 0.5,
                                borderRadius: 2,
                                color: theme.palette.primary.contrastText,
                              })}
                            >
                              {t(
                                "modules:groups.empty_state.cta",
                                "Crear primer grupo"
                              )}
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupsList.map((g) => {
                        const displayName = getGroupDisplayName(g);
                        const isRowActive = g.is_active ?? true;
                        const isFiltered = appliedFilterGroupIds.includes(g.id);

                        return (
                          <TableRow
                            key={g.id}
                            hover
                            sx={{
                              bgcolor: isFiltered
                                ? "action.selected"
                                : "inherit",
                              "&:last-child td, &:last-child th": { border: 0 },
                            }}
                          >
                            <TableCell
                              sx={{
                                color: "text.secondary",
                                fontSize: "0.8125rem",
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
                                {g.id.includes("-")
                                  ? `${g.id.split("-")[0]}...`
                                  : g.id}
                                <Tooltip
                                  title={t("modules:copy")}
                                  arrow
                                  placement="top"
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCopyId(g.id)}
                                    aria-label={t("modules:copy")}
                                    disabled={isBusyGroups}
                                  >
                                    <ContentCopyIcon
                                      fontSize="small"
                                      sx={{ fontSize: "0.95rem" }}
                                    />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip
                                title={
                                  g.icon
                                    ? `${g.icon}`
                                    : t("modules:form.default_icon", "Ícono por defecto")
                                }
                                arrow
                                placement="top"
                              >
                                <Box
                                  sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "primary.main",
                                  }}
                                  data-testid={`group-icon-${g.key}`}
                                >
                                  {getGroupIcon(g.key, g.icon)}
                                </Box>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: "medium" }}
                                >
                                  {displayName}
                                </Typography>
                                {showModules && (
                                  <Tooltip
                                    title={
                                      isFiltered
                                        ? t(
                                            "modules:groups.view_all",
                                            "Ver todos"
                                          )
                                        : t(
                                            "modules:groups.filter_by_group",
                                            "Filtrar módulos de este grupo"
                                          )
                                    }
                                  >
                                    <IconButton
                                      size="small"
                                      color={isFiltered ? "primary" : "default"}
                                      onClick={() => {
                                        if (isFiltered) {
                                          setAppliedFilterGroupIds((prev) =>
                                            prev.filter((id) => id !== g.id)
                                          );
                                        } else {
                                          handleQuickFilterByGroup(g.id);
                                        }
                                      }}
                                      sx={{ p: 0.25 }}
                                    >
                                      <FilterAltOutlinedIcon
                                        sx={{ fontSize: "1rem" }}
                                      />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <KeyBadge>{g.key}</KeyBadge>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={
                                  isRowActive
                                    ? t("modules:yes")
                                    : t("modules:no")
                                }
                                color={isRowActive ? "success" : "error"}
                                size="small"
                                variant={isRowActive ? "filled" : "outlined"}
                                sx={
                                  isRowActive
                                    ? { color: "success.contrastText" }
                                    : {}
                                }
                              />
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="primary"
                                aria-label={t("modules:groups.table.actions")}
                                onClick={(e) => handleOpenGroupActionMenu(e, g)}
                                disabled={isBusyGroups}
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
                count={totalGroupsCount}
                page={pageGroups}
                onPageChange={(_, newPage) => setPageGroups(newPage)}
                rowsPerPage={rowsPerPageGroups}
                onRowsPerPageChange={(e) => {
                  setRowsPerPageGroups(parseInt(e.target.value, 10));
                  setPageGroups(0);
                }}
                rowsPerPageOptions={[5, 10, 20]}
                disabled={isBusyGroups}
                labelRowsPerPage={t("core:pagination.rows_per_page")}
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} ${t("core:pagination.of")} ${
                    count !== -1
                      ? count
                      : `${t("core:pagination.more_than")} ${to}`
                  }`
                }
              />
            </Skeleton>
          </Collapse>
        </GroupsSectionCard>
      )}

      {/* ========================================================================= */}
      {/* MODULES TABLE SECTION                                                     */}
      {/* ========================================================================= */}
      {showModules && (
        <Box>
          <FilterRow>
            <Filter
              onFilter={handleApplyFilters}
              onClear={handleClearFilters}
              activeCount={activeFiltersCount}
              title={t("modules:filter_modal_title")}
              subtitle={t("modules:filter_modal_subtitle")}
            >
              <SelectMultipleInput
                label={t("modules:table.key")}
                options={keyFilterOptions}
                value={draftFilterKeys}
                onChange={setDraftFilterKeys}
                placeholder={t("modules:form.key_placeholder")}
                disabled={isBusyModules || isLoadingAllModules || isFetchingAllModules}
              />

              <SelectMultipleInput
                label={t("modules:form.group", "Grupo")}
                options={groupFilterOptions}
                value={draftFilterGroupIds}
                onChange={setDraftFilterGroupIds}
                placeholder={t("modules:form.group_placeholder")}
                disabled={isBusyModules || isLoadingAllGroups || isFetchingAllGroups}
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
                      disabled={isBusyModules}
                    />
                  }
                  label={t("modules:form.active")}
                  labelPlacement="start"
                  sx={{ m: 0, width: "100%", justifyContent: "space-between" }}
                />
              </Box>
            </Filter>
          </FilterRow>

          {activeFiltersCount > 0 && (
            <ActiveFilters>
              {appliedFilterKeys.map((key) => {
                const matched = allModulesResponse?.data?.find(
                  (m) => m.key === key
                );
                const label = matched ? getModuleDisplayName(matched) : key;
                return (
                  <FilterChips
                    key={`mod-key-${key}`}
                    label={t("modules:filter_chips.key", {
                      value: label !== "-" ? `${label} (${key})` : key,
                    })}
                    onAction={() => {
                      setAppliedFilterKeys((prev) =>
                        prev.filter((k) => k !== key)
                      );
                      setPage(0);
                    }}
                  />
                );
              })}
              {appliedFilterGroupIds.map((groupId) => {
                const matched = allGroupsResponse?.data?.find(
                  (g) => g.id === groupId
                );
                const groupName = matched ? getGroupDisplayName(matched) : groupId;
                const displayLabel =
                  matched && groupName !== "-" && groupName !== matched.key
                    ? `${groupName} (${matched.key})`
                    : groupName;

                return (
                  <FilterChips
                    key={`mod-group-${groupId}`}
                    label={t("modules:filter_chips.group", {
                      value: displayLabel,
                    })}
                    onAction={() => {
                      setAppliedFilterGroupIds((prev) =>
                        prev.filter((id) => id !== groupId)
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
                      ? t("modules:filter_chips.active_only")
                      : t("modules:no")
                  }
                  onAction={() => {
                    setAppliedFilterActive(null);
                    setPage(0);
                  }}
                />
              )}
            </ActiveFilters>
          )}

          {isErrorModules && (
            <Box sx={{ mb: 2.5 }}>
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => refetchModules()}
                  >
                    {t("core:retry", "Reintentar")}
                  </Button>
                }
              >
                <AlertTitle>
                  {t("modules:error_state.title", "Error al cargar los módulos")}
                </AlertTitle>
                {modulesError instanceof Error
                  ? modulesError.message
                  : t(
                      "modules:error_state.description",
                      "No se pudo obtener el listado de módulos desde el servidor."
                    )}
              </Alert>
            </Box>
          )}

          <TableTopBar>
            <Box sx={{ width: { xs: "100%", sm: "360px" } }}>
              <InputSearch
                value={searchTerm}
                onChange={(val) => {
                  setSearchTerm(val);
                  setPage(0);
                }}
                placeholder={t("modules:search_placeholder")}
                fullWidth
                disabled={isLoadingModules || isMutatingModule}
              />
            </Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddCircleOutlinedIcon />}
              onClick={handleOpenCreateModal}
              disabled={isBusyModules}
              sx={(theme) => ({
                borderRadius: 2,
                color: theme.palette.primary.contrastText,
              })}
            >
              {t("modules:new_module")}
            </Button>
          </TableTopBar>

          <Skeleton loading={isLoadingModules} name="modules-table">
            <StyledTableContainer>
              {isFetchingModules && !isLoadingModules && (
                <LinearProgress sx={{ height: 3 }} />
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
                      <TableCell>{t("modules:table.id")}</TableCell>
                      <TableCell align="center">
                        {t("modules:table.icon", "Ícono")}
                      </TableCell>
                      <TableCell>{t("modules:table.name")}</TableCell>
                      <TableCell>{t("modules:table.key")}</TableCell>
                      <TableCell>{t("modules:table.link", "Ruta")}</TableCell>
                      <TableCell>{t("modules:table.group_name")}</TableCell>
                      <TableCell>{t("modules:table.group_key")}</TableCell>
                      <TableCell>{t("modules:table.active")}</TableCell>
                      <TableCell align="center">
                        {t("modules:table.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoadingModules && modulesList.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
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
                            <ViewModuleOutlinedIcon
                              sx={{ fontSize: 48, color: "text.disabled" }}
                            />
                            <Typography variant="h6" color="text.secondary">
                              {t(
                                "modules:empty_state.title",
                                "No hay módulos disponibles"
                              )}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.disabled"
                              sx={{ maxWidth: 400 }}
                            >
                              {t(
                                "modules:empty_state.description",
                                "No se encontraron módulos actualmente. Comience agregando uno nuevo."
                              )}
                            </Typography>
                            <Button
                              variant="contained"
                              size="small"
                              color="primary"
                              startIcon={<AddCircleOutlinedIcon />}
                              onClick={handleOpenCreateModal}
                              disabled={isBusyModules}
                              sx={(theme) => ({
                                mt: 1,
                                borderRadius: 2,
                                color: theme.palette.primary.contrastText,
                              })}
                            >
                              {t("modules:empty_state.cta", "Crear primer módulo")}
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      modulesList.map((m) => {
                        const displayName = getModuleDisplayName(m);
                        const groupName = getGroupDisplayName(m.module_group);
                        const groupKey = m.module_group?.key || null;
                        const isRowActive = m.is_active ?? true;

                        return (
                          <TableRow
                            key={m.id}
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
                                {m.id.includes("-")
                                  ? `${m.id.split("-")[0]}...`
                                  : m.id}
                                <Tooltip
                                  title={t("modules:copy")}
                                  arrow
                                  placement="top"
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCopyId(m.id)}
                                    aria-label={t("modules:copy")}
                                    disabled={isBusyModules}
                                  >
                                    <ContentCopyIcon
                                      fontSize="small"
                                      sx={{ fontSize: "1rem" }}
                                    />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip
                                title={
                                  m.icon
                                    ? `${m.icon}`
                                    : t("modules:form.default_icon", "Ícono por defecto")
                                }
                                arrow
                                placement="top"
                              >
                                <Box
                                  sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "primary.main",
                                  }}
                                  data-testid={`module-icon-${m.key}`}
                                >
                                  {getModuleIcon(m.key, m.icon)}
                                </Box>
                              </Tooltip>
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
                              <KeyBadge>{m.key}</KeyBadge>
                            </TableCell>
                            <TableCell>
                              {m.link ? (
                                <Box
                                  sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                  }}
                                >
                                  <Typography
                                    component="a"
                                    href={getModuleFullUrl(m.link)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="body2"
                                    sx={{
                                      color: "primary.main",
                                      textDecoration: "none",
                                      "&:hover": {
                                        textDecoration: "underline",
                                      },
                                      fontFamily: "monospace",
                                      fontSize: "0.8125rem",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 0.5,
                                      maxWidth: 220,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                    title={getModuleFullUrl(m.link)}
                                  >
                                    <LinkOutlinedIcon
                                      sx={{
                                        fontSize: "0.95rem",
                                        flexShrink: 0,
                                      }}
                                    />
                                    {getModuleFullUrl(m.link)}
                                  </Typography>
                                  <Tooltip
                                    title={t(
                                      "modules:copy_link",
                                      "Copiar enlace"
                                    )}
                                    arrow
                                    placement="top"
                                  >
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        handleCopyLink(getModuleFullUrl(m.link))
                                      }
                                      aria-label={t(
                                        "modules:copy_link",
                                        "Copiar enlace"
                                      )}
                                      sx={{ p: 0.25 }}
                                    >
                                      <ContentCopyIcon
                                        sx={{ fontSize: "0.875rem" }}
                                      />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              ) : (
                                t("modules:empty_value", "-")
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 500 }}
                              >
                                {groupName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {groupKey ? (
                                <Chip
                                  label={groupKey}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                />
                              ) : (
                                t("modules:empty_value")
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={
                                  isRowActive
                                    ? t("modules:yes")
                                    : t("modules:no")
                                }
                                color={isRowActive ? "success" : "error"}
                                size="small"
                                variant={isRowActive ? "filled" : "outlined"}
                                sx={
                                  isRowActive
                                    ? { color: "success.contrastText" }
                                    : {}
                                }
                              />
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="primary"
                                aria-label={t("modules:table.actions")}
                                onClick={(e) => handleOpenActionMenu(e, m)}
                                disabled={isBusyModules}
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
                count={totalModulesCount}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
                disabled={isBusyModules}
                labelRowsPerPage={t("core:pagination.rows_per_page")}
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} ${t("core:pagination.of")} ${
                    count !== -1
                      ? count
                      : `${t("core:pagination.more_than")} ${to}`
                  }`
                }
              />
            </StyledTableContainer>
          </Skeleton>
        </Box>
      )}

      {/* Module Row Actions Menu */}
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
        <MenuItem
          onClick={handleOpenEditModal}
          sx={{ borderRadius: 1 }}
          disabled={isBusyModules}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("modules:actions_menu.update")} />
        </MenuItem>
        {targetModule && (
          <MenuItem
            onClick={() => handleRequestToggleActive(targetModule)}
            sx={{ borderRadius: 1 }}
            disabled={isBusyModules}
          >
            <ListItemIcon>
              {targetModule.is_active ?? true ? (
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
                targetModule.is_active ?? true
                  ? t("modules:deactivate")
                  : t("modules:activate")
              }
            />
          </MenuItem>
        )}
      </Menu>

      {/* Module Group Row Actions Menu */}
      <Menu
        anchorEl={groupActionMenuAnchor}
        open={Boolean(groupActionMenuAnchor)}
        onClose={handleCloseGroupActionMenu}
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
        <MenuItem
          onClick={handleOpenEditGroupModal}
          sx={{ borderRadius: 1 }}
          disabled={isBusyGroups}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("modules:actions_menu.update")} />
        </MenuItem>
        {targetGroup && (
          <MenuItem
            onClick={() => handleRequestToggleActiveGroup(targetGroup)}
            sx={{ borderRadius: 1 }}
            disabled={isBusyGroups}
          >
            <ListItemIcon>
              {targetGroup.is_active ?? true ? (
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
                targetGroup.is_active ?? true
                  ? t("modules:deactivate")
                  : t("modules:activate")
              }
            />
          </MenuItem>
        )}
      </Menu>

      {/* Confirm Toggle Active Dialog for Module */}
      <ConfirmDialog
        open={isConfirmToggleOpen}
        onClose={handleCloseConfirmToggle}
        onConfirm={handleConfirmToggleActive}
        isLoading={isMutatingModule}
        title={
          moduleToToggle?.is_active ?? true
            ? t("modules:confirm_deactivate_title")
            : t("modules:confirm_activate_title")
        }
        message={
          moduleToToggle?.is_active ?? true
            ? t("modules:confirm_deactivate_message", {
                name: moduleToToggle?.key,
              })
            : t("modules:confirm_activate_message", {
                name: moduleToToggle?.key,
              })
        }
        confirmText={
          moduleToToggle?.is_active ?? true
            ? t("modules:deactivate")
            : t("modules:activate")
        }
        cancelText={t("core:cancel")}
      />

      {/* Confirm Toggle Active Dialog for Module Group */}
      <ConfirmDialog
        open={isConfirmToggleGroupOpen}
        onClose={handleCloseConfirmToggleGroup}
        onConfirm={handleConfirmToggleActiveGroup}
        isLoading={isMutatingGroup}
        title={
          groupToToggle?.is_active ?? true
            ? t("modules:groups.confirm_deactivate_title")
            : t("modules:groups.confirm_activate_title")
        }
        message={
          groupToToggle?.is_active ?? true
            ? t("modules:groups.confirm_deactivate_message", {
                name: groupToToggle?.key,
              })
            : t("modules:groups.confirm_activate_message", {
                name: groupToToggle?.key,
              })
        }
        confirmText={
          groupToToggle?.is_active ?? true
            ? t("modules:deactivate")
            : t("modules:activate")
        }
        cancelText={t("core:cancel")}
      />

      {/* Module Create / Edit Modal */}
      <ModuleModal
        open={isModuleModalOpen}
        onClose={() => {
          setIsModuleModalOpen(false);
          setSelectedModuleForEdit(null);
        }}
        onSubmit={handleSaveModule}
        initialData={selectedModuleForEdit}
        isSubmitting={isMutatingModule}
      />

      {/* Module Group Create / Edit Modal */}
      <ModuleGroupModal
        open={isGroupModalOpen}
        onClose={() => {
          setIsGroupModalOpen(false);
          setSelectedGroupForEdit(null);
        }}
        onSubmit={handleSaveGroup}
        initialData={selectedGroupForEdit}
        isSubmitting={isMutatingGroup}
      />
    </Box>
  );
};

export default Modules;
