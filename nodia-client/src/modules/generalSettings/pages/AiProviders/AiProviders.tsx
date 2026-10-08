import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import { notifyHttpError } from "../../../../config/httpFeedback";
import type { FC } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Box, LinearProgress, Typography } from "@mui/material";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import { Skeleton } from "boneyard-js/react";
import { useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import {
  useAiProviders,
  useAiProvidersHealth,
  useGeminiEngines,
} from "./infrastructure/useServices";
import type { AiProviderHealthItem } from "./infrastructure/types";
import AlertBanner from "./components/AlertBanner";
import ProviderCard from "./components/ProviderCard";
import ProviderDetail from "./components/ProviderDetail";
import AddProviderModal from "./components/AddProviderModal";
import ConfigureProviderModal from "./components/ConfigureProviderModal";
import RemoteLoginModal from "./components/RemoteLoginModal";
import AgenticLoginModal from "./components/AgenticLoginModal";
import {
  PageContainer,
  HeaderPanel,
  HeaderTitleBox,
  PageTitleContainer,
  PageTitle,
  PageSubtitle,
  HeaderActionsBox,
  HeaderButtonsRow,
  CardsGrid,
} from "./styles";

const AiProviders: FC = () => {
  const { t } = useTranslation(["ai_providers", "core"]);
  const queryClient = useQueryClient();

  const [selectedView, setSelectedView] = useState<string>("overview");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [configureProvider, setConfigureProvider] =
    useState<AiProviderHealthItem | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAgenticLoginModalOpen, setIsAgenticLoginModalOpen] = useState(false);

  // Queries
  const {
    data: providersResponse,
    isLoading: isLoadingProviders,
    isError: providersError,
    isFetching: isFetchingProviders,
    refetch: refetchProviders,
  } = useAiProviders({ all: true });

  const {
    data: healthResponse,
    isLoading: isLoadingHealth,
    isError: healthError,
    isFetching: isFetchingHealth,
    refetch: refetchHealth,
  } = useAiProvidersHealth();

  const { data: geminiEnginesData, isError: enginesError, isFetching: isFetchingEngines } = useGeminiEngines();

  const isInitialLoading =
    isLoadingProviders ||
    isLoadingHealth ||
    (!healthResponse && isFetchingHealth);
  const isSoftLoading = (isFetchingHealth || isFetchingProviders) && !isInitialLoading;
  const isBusy = isInitialLoading || isFetchingHealth || isFetchingProviders || isFetchingEngines;

  // View options for SelectSingleInput
  const viewOptions = useMemo(() => {
    const options = [
      {
        value: "overview",
        label: t(
          "ai_providers:view_all_providers",
          "General (Todos los proveedores)"
        ),
      },
    ];

    const dbProviders = providersResponse?.data || [];
    for (const p of dbProviders) {
      const providerKey = p.catalog?.key || p.key || "";
      if (!providerKey) continue;

      const displayName =
        p.name ||
        (providerKey === "gemini"
          ? "Google Gemini"
          : providerKey === "mistral"
          ? "Mistral AI"
          : providerKey === "openai"
          ? "OpenAI"
          : providerKey.charAt(0).toUpperCase() + providerKey.slice(1));

      options.push({
        value: p.id,
        label: `${displayName} (${providerKey})${p.is_default ? ` (${t("ai_providers:default_badge", "Predeterminado")})` : ""}`,
      });
    }

    return options;
  }, [providersResponse?.data, t]);

  // Filtered providers for cards
  const displayProviders = useMemo(() => {
    const list = healthResponse?.providers || [];
    const dbProviders = providersResponse?.data || [];
    const merged = list.map((item) => {
      const dbMatch = dbProviders.find(
        (db) => db.id === item.id
      );
      return {
        ...item,
        is_default: Boolean(item.is_default ?? dbMatch?.is_default ?? false),
      };
    });
    if (selectedView === "overview") return merged;
    return merged.filter((p) => p.id === selectedView);
  }, [healthResponse?.providers, providersResponse?.data, selectedView]);

  // Filtered alerts
  const activeAlerts = useMemo(() => {
    const allAlerts = [...(healthResponse?.alerts || [])];

    const geminiProvider = displayProviders.find(
      (p) => p.key.toLowerCase() === "gemini"
    );

    if (geminiProvider?.use_token_plan_web) {
      if (geminiEnginesData?.web?.authenticated === false) {
        const hasWebAlert = allAlerts.some(
          (a) =>
            a.provider.toLowerCase() === "gemini" &&
            (a.id.includes("web-expired") || a.actionType === "renew_session")
        );
        if (!hasWebAlert) {
          allAlerts.unshift({
            id: `alert-${geminiProvider.id}-web-expired`,
            provider: "gemini",
            type: "incident",
            severity: "error",
            title: t("ai_providers:alerts.web_expired_title", { provider: geminiProvider.name }),
            message:
              t("ai_providers:alerts.web_expired_message"),
            timeAgo: t("ai_providers:alerts.recent"),
            actionType: "renew_session",
            actionLabel: t("ai_providers:alerts.renew_session_now", "Renovar Sesión Ahora"),
          });
        }
      }
    }

    if (selectedView === "overview") return allAlerts;
    const selected = displayProviders.find((p) => p.id === selectedView);
    return allAlerts.filter((a) => a.provider.toLowerCase() === selected?.key.toLowerCase());
  }, [
    healthResponse?.alerts,
    displayProviders,
    geminiEnginesData?.web?.authenticated,
    selectedView,
    t,
  ]);


  const handleRefreshAllData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ai-enabled-web-providers"] }),
      queryClient.invalidateQueries({ queryKey: ["ai-selectable-models"] }),
    ]);
    await Promise.all([
      refetchHealth({ throwOnError: true }),
      refetchProviders({ throwOnError: true }),
    ]);
  };

  const handleVerifyAll = async () => {
    try {
      await refetchHealth({ throwOnError: true });
      sileo.success({
        title: t(
          "ai_providers:notifications.verify_success",
          "Estado de proveedores de IA actualizado"
        ),
      });
    } catch (error) {
      notifyHttpError(error);
    }
  };

  const handleRenewSession = () => {
    setIsLoginModalOpen(true);
  };

  return (
    <PageContainer>
      <QueryErrorAlert isError={providersError || healthError || enginesError} isFetching={isBusy} onRetry={() => Promise.all([refetchProviders(), refetchHealth()])} />
      {/* HEADER PANEL */}
      <HeaderPanel>
        <HeaderTitleBox>
          <PageTitleContainer>
            <SmartToyOutlinedIcon color="primary" sx={{ fontSize: 32 }} />
            <PageTitle>{t("ai_providers:title", "Proveedores de IA")}</PageTitle>
          </PageTitleContainer>
          <PageSubtitle>
            {t(
              "ai_providers:subtitle",
              "Configuración de conexiones, modelos y sesiones de los planes Web y Agentic."
            )}
          </PageSubtitle>
        </HeaderTitleBox>

        <HeaderActionsBox>
          <Box sx={{ width: "100%" }}>
            <SelectSingleInput
              options={viewOptions}
              value={selectedView}
              onChange={(val) => setSelectedView(val || "overview")}
              placeholder={t(
                "ai_providers:view_selector_placeholder",
                "Filtrar por proveedor..."
              )}
              clearable={false}
              dataTestId="provider-view-select"
            />
          </Box>

          <HeaderButtonsRow>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<SyncOutlinedIcon />}
              onClick={handleVerifyAll}
              disabled={isBusy}
              sx={{
                borderRadius: 2,
                px: 2,
                fontWeight: 600,
                textTransform: "none",
                whiteSpace: "nowrap",
              }}
            >
              {isFetchingHealth
                ? t("ai_providers:verifying", "Verificando...")
                : t("ai_providers:verify_all", "Verificar todos")}
            </Button>

            <Button
              variant="contained"
              color="primary"
              startIcon={<AddCircleOutlineOutlinedIcon />}
              onClick={() => setIsAddModalOpen(true)}
              disabled={isBusy}
              sx={{
                borderRadius: 2,
                px: 2.5,
                fontWeight: 600,
                textTransform: "none",
                whiteSpace: "nowrap",
              }}
            >
              {t("ai_providers:add_provider", "Añadir Proveedor")}
            </Button>
          </HeaderButtonsRow>
        </HeaderActionsBox>
      </HeaderPanel>

      {selectedView !== "overview" ? (
        <ProviderDetail
          key={selectedView}
          providerId={selectedView}
          onBack={() => setSelectedView("overview")}
          onRenewSession={handleRenewSession}
          onConfigure={(p) => setConfigureProvider(p)}
        />
      ) : (
        <>
          {/* ALERT BANNERS */}
          <AlertBanner
            alerts={activeAlerts}
            disabled={isBusy}
            onAuthenticateAgentic={(alert) => {
              if (alert.provider === "openai" && alert.providerId) setSelectedView(alert.providerId);
              else if (alert.provider === "gemini") setIsAgenticLoginModalOpen(true);
            }}
            onCheckStatus={handleVerifyAll}
            onRenewSession={handleRenewSession}
            onConfigure={(providerKey) => {
              const prov = displayProviders.find(
                (p) => p.key.toLowerCase() === providerKey.toLowerCase()
              );
              if (prov) {
                setConfigureProvider(prov);
              }
            }}
            onManageQuotas={() => {
              sileo.info({
                title: t("ai_providers:connection.quotas_title"),
                description:
                  t("ai_providers:connection.quotas_description"),
              });
            }}
          />

          {/* CARDS GRID */}
          <Box sx={{ position: "relative" }}>
            {isSoftLoading && (
              <LinearProgress
                sx={{
                  position: "absolute",
                  top: -8,
                  left: 0,
                  right: 0,
                  height: 2,
                  borderRadius: 1,
                }}
              />
            )}
            <Skeleton loading={isInitialLoading}>
              <CardsGrid>
                {displayProviders.length === 0 && !providersError && !healthError && <Typography color="text.secondary">{t("ai_providers:connection.empty")}</Typography>}
                {displayProviders.map((prov) => (
                  <ProviderCard
                    key={prov.id}
                    provider={prov}
                    totalProviders={providersResponse?.data?.length || healthResponse?.providers?.length || 0}
                    onGoToDetail={(p) => setSelectedView(p.id)}
                    onConfigure={(p) => setConfigureProvider(p)}
                    onRenewSession={handleRenewSession}
                    onViewModels={(p) => setSelectedView(p.id)}
                  />
                ))}
              </CardsGrid>
            </Skeleton>
          </Box>
        </>
      )}

      {/* MODALS */}
      <AddProviderModal
        totalProviders={providersResponse?.data?.length ?? healthResponse?.providers?.length}
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleRefreshAllData}
      />

      <ConfigureProviderModal
        open={Boolean(configureProvider)}
        provider={configureProvider}
        totalProviders={providersResponse?.data?.length || healthResponse?.providers?.length || 0}
        onClose={() => setConfigureProvider(null)}
        onSuccess={handleRefreshAllData}
      />

      <RemoteLoginModal
        open={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleRefreshAllData}
      />
      {isAgenticLoginModalOpen && <AgenticLoginModal onClose={() => setIsAgenticLoginModalOpen(false)} />}
    </PageContainer>
  );
};

export default AiProviders;
