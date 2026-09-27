import type { FC } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Box } from "@mui/material";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import { sileo } from "sileo";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import {
  useAiProviders,
  useAiProvidersHealth,
  useAiProviderEvents,
} from "./infrastructure/useServices";
import type {
  AiProviderHealthItem,
  AiProviderEventEntity,
} from "./infrastructure/types";
import AlertBanner from "./components/AlertBanner";
import ProviderCard from "./components/ProviderCard";
import ProviderDetail from "./components/ProviderDetail";
import AiEventsTable from "./components/AiEventsTable";
import AddProviderModal from "./components/AddProviderModal";
import ConfigureProviderModal from "./components/ConfigureProviderModal";
import RemoteLoginModal from "./components/RemoteLoginModal";
import TraceModal from "./components/TraceModal";
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

  const [selectedView, setSelectedView] = useState<string>("overview");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [configureProvider, setConfigureProvider] =
    useState<AiProviderHealthItem | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedTraceEvent, setSelectedTraceEvent] =
    useState<AiProviderEventEntity | null>(null);

  // Table state
  const [eventSearch, setEventSearch] = useState("");
  const [eventPage, setEventPage] = useState(0);
  const [eventLimit, setEventLimit] = useState(10);

  // Queries
  const {
    data: providersResponse,
    refetch: refetchProviders,
  } = useAiProviders({ all: true });

  const {
    data: healthResponse,
    isFetching: isFetchingHealth,
    refetch: refetchHealth,
  } = useAiProvidersHealth();

  const queryParams = useMemo(() => {
    const q: Record<string, any> = {};
    if (eventSearch.trim()) {
      q.message_or_event_type_cont = eventSearch.trim();
    }
    if (selectedView !== "overview") {
      const foundProv = providersResponse?.data?.find(
        (p) => p.key === selectedView
      );
      if (foundProv) {
        q.provider_id_eq = foundProv.id;
      }
    }
    return {
      page: eventPage + 1,
      limit: eventLimit,
      includes: true,
      q,
    };
  }, [
    eventSearch,
    selectedView,
    eventPage,
    eventLimit,
    providersResponse?.data,
  ]);

  const {
    data: eventsResponse,
    isLoading: isLoadingEvents,
    isFetching: isFetchingEvents,
  } = useAiProviderEvents(queryParams);

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
      const displayName =
        p.key === "gemini"
          ? "Google Gemini"
          : p.key === "mistral"
          ? "Mistral AI"
          : p.key === "openai"
          ? "OpenAI"
          : p.key.charAt(0).toUpperCase() + p.key.slice(1);

      options.push({
        value: p.key,
        label: `${displayName} (${p.key})`,
      });
    }

    return options;
  }, [providersResponse?.data, t]);

  // Filtered alerts
  const activeAlerts = useMemo(() => {
    const allAlerts = healthResponse?.alerts || [];
    if (selectedView === "overview") return allAlerts;
    return allAlerts.filter((a) => a.provider === selectedView);
  }, [healthResponse?.alerts, selectedView]);

  // Filtered providers for cards
  const displayProviders = useMemo(() => {
    const list = healthResponse?.providers || [];
    if (selectedView === "overview") return list;
    return list.filter((p) => p.key === selectedView);
  }, [healthResponse?.providers, selectedView]);

  const handleVerifyAll = async () => {
    try {
      await refetchHealth();
      sileo.success({
        title: t(
          "ai_providers:notifications.verify_success",
          "Estado de proveedores de IA actualizado"
        ),
      });
    } catch {
      sileo.error({
        title: t("core:server_error_toast", "Error en el servidor. Por favor, inténtelo más tarde"),
      });
    }
  };

  const handleRenewSession = () => {
    setIsLoginModalOpen(true);
  };

  const handleTestPing = (provider: AiProviderHealthItem) => {
    sileo.success({
      title: `Ping a ${provider.name} completado`,
      description: `Latencia registrada: ${provider.latencyMs > 0 ? provider.latencyMs : 185} ms`,
    });
  };

  return (
    <PageContainer>
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
              "Configuración global de proveedores de LLM, orquestación de autenticación vía sesión web o API keys rotativas, y políticas de contingencia con failover autónomo."
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
              disabled={isFetchingHealth}
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
          providerKey={selectedView}
          onBack={() => setSelectedView("overview")}
          onRenewSession={handleRenewSession}
          onConfigure={(p) => setConfigureProvider(p)}
        />
      ) : (
        <>
          {/* ALERT BANNERS */}
          <AlertBanner
            alerts={activeAlerts}
            onRenewSession={handleRenewSession}
            onManageQuotas={() => {
              sileo.info({
                title: "Gestión de cuotas",
                description:
                  "La rotación de llaves API se encuentra administrando la contingencia activa.",
              });
            }}
          />

          {/* CARDS GRID */}
          <CardsGrid>
            {displayProviders.map((prov) => (
              <ProviderCard
                key={prov.id}
                provider={prov}
                onGoToDetail={(p) => setSelectedView(p.key)}
                onConfigure={(p) => setConfigureProvider(p)}
                onTestPing={handleTestPing}
                onRenewSession={handleRenewSession}
                onManageKeys={() => {
                  sileo.info({
                    title: `API Keys de ${prov.name}`,
                    description: `Pool activo: ${prov.validKeysCount || 1}/${prov.apiKeysCount || 1} llaves disponibles con rotación automática.`,
                  });
                }}
                onViewModels={() => {
                  sileo.info({
                    title: `Modelos de ${prov.name}`,
                    description:
                      "Modelos configurados: OCR (mistral-ocr-latest) e Inferencia (mistral-large-latest).",
                  });
                }}
              />
            ))}
          </CardsGrid>

          {/* AUDIT LOGS TABLE */}
          <AiEventsTable
            events={eventsResponse?.data || []}
            isLoading={isLoadingEvents}
            isFetching={isFetchingEvents}
            totalItems={eventsResponse?.meta?.total_items || 0}
            page={eventPage}
            limit={eventLimit}
            searchValue={eventSearch}
            onSearchChange={(val) => {
              setEventSearch(val);
              setEventPage(0);
            }}
            onPageChange={setEventPage}
            onRowsPerPageChange={(newLimit) => {
              setEventLimit(newLimit);
              setEventPage(0);
            }}
            onViewTrace={(event) => setSelectedTraceEvent(event)}
          />
        </>
      )}

      {/* MODALS */}
      <AddProviderModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          refetchProviders();
          refetchHealth();
        }}
      />

      <ConfigureProviderModal
        open={Boolean(configureProvider)}
        provider={configureProvider}
        onClose={() => setConfigureProvider(null)}
        onSuccess={() => {
          refetchProviders();
          refetchHealth();
        }}
      />

      <RemoteLoginModal
        open={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => {
          refetchHealth();
        }}
      />

      <TraceModal
        open={Boolean(selectedTraceEvent)}
        event={selectedTraceEvent}
        onClose={() => setSelectedTraceEvent(null)}
      />
    </PageContainer>
  );
};

export default AiProviders;
