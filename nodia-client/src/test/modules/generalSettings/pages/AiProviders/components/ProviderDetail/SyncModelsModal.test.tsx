import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sileo } from "sileo";
import { AxiosError } from "axios";
import type { ReactElement } from "react";
import SyncModelsModal from "../../../../../../../modules/generalSettings/pages/AiProviders/components/ProviderDetail/components/SyncModelsModal/SyncModelsModal";
import * as aiServices from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";
import type {
  AiProviderEntity,
  SyncModelsResult,
} from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";

vi.mock(
  "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services",
  () => ({
    syncAiProviderModels: vi.fn(),
    updateAiProvider: vi.fn(),
  })
);

vi.mock("sileo", () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithClient = (ui: ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

const mockProvider: AiProviderEntity = {
  id: "prov-1",
  key: "gemini",
  name: "Google Gemini",
  is_active: true,
  mode: "web_session",
  fields: {
    available_models: [],
    selected_model: "",
  },
  created_at: "2026-09-20",
  updated_at: "2026-09-20",
};

const mockDiscovered: SyncModelsResult = {
  providerId: "prov-1",
  providerName: "Google Gemini",
  currentSelectedModel: null,
  isSelectedModelAvailable: false,
  models: [
    {
      id: "gemini-flash-lite",
      name: "gemini-flash-lite",
      displayName: "3.5 Flash-Lite",
      description: "Respuestas más rápidas",
      contextWindow: 1000000,
      capabilities: ["text", "vision", "documents"],
      isRecommended: true,
      role: "ocr" as const,
    },
    {
      id: "gemini-flash",
      name: "gemini-flash",
      displayName: "3.8 Flash",
      description: "Asistencia general",
      contextWindow: 1000000,
      capabilities: ["text", "vision", "documents"],
      isRecommended: true,
      role: "multimodal" as const,
    },
    {
      id: "gemini-pro",
      name: "gemini-pro",
      displayName: "3.1 Pro",
      description: "Razonamiento avanzado",
      contextWindow: 2000000,
      capabilities: ["text", "vision", "reasoning"],
      isRecommended: false,
      role: "multimodal" as const,
    },
  ],
};

describe("SyncModelsModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiServices.syncAiProviderModels).mockResolvedValue(mockDiscovered);
    vi.mocked(aiServices.updateAiProvider).mockResolvedValue(mockProvider);
  });

  it("fetches live models on open and renders the list with selection", async () => {
    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={mockProvider}
        isOperational={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(aiServices.syncAiProviderModels).toHaveBeenCalledWith(
        "prov-1",
        false,
        "token_plan_web",
        "web"
      );
      expect(screen.getAllByText("3.5 Flash-Lite")[0]).toBeInTheDocument();
      expect(screen.getAllByText("3.8 Flash")[0]).toBeInTheDocument();
      expect(screen.getAllByText("3.1 Pro")[0]).toBeInTheDocument();
    });
  });

  it("submits curated models with primary and ocr selections", async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={mockProvider}
        isOperational={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("3.8 Flash")[0]).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: "Guardar Modelos" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(aiServices.updateAiProvider).toHaveBeenCalledWith(
        "prov-1",
        expect.objectContaining({
          fields: expect.objectContaining({
            available_models: expect.arrayContaining([
              expect.objectContaining({ id: "gemini-flash" }),
            ]),
            selected_model: expect.any(String),
          }),
        })
      );
      expect(handleClose).toHaveBeenCalled();
      expect(handleSuccess).toHaveBeenCalled();
    });
  });

  it("renders vertical role cards with default model required and OCR model optional starting in null", async () => {
    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={mockProvider}
        isOperational={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Asignación de roles de modelo")).toBeInTheDocument();
      expect(screen.getByText("Modelo Principal por Defecto")).toBeInTheDocument();
      expect(screen.getByText("Obligatorio")).toBeInTheDocument();
      expect(screen.getByText("Modelo Enfocado en OCR")).toBeInTheDocument();
      expect(screen.getByText("Opcional")).toBeInTheDocument();
    });

    // Default model is set (e.g. gemini-flash because isRecommended is true)
    // OCR model placeholder should be visible because it starts in null/empty
    expect(screen.getByText("Seleccionar modelo para OCR (Opcional)...")).toBeInTheDocument();
  });

  it("disables save button and displays warning when web session is not operational", async () => {
    const webProvider: AiProviderEntity = {
      ...mockProvider,
      mode: "web_session",
    };

    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={webProvider}
        isOperational={false}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Modo no operativo")).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: "Guardar Modelos" });
    expect(submitBtn).toBeDisabled();
  });

  it("blocks discovery and save for a legacy API key configuration", async () => {
    const apiKeyProvider: AiProviderEntity = {
      ...mockProvider,
      mode: "api_key",
    };

    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={apiKeyProvider}
        onClose={() => {}}
      />
    );

    expect(aiServices.syncAiProviderModels).not.toHaveBeenCalled();

    const submitBtn = screen.getByRole("button", { name: "Guardar Modelos" });
    expect(submitBtn).toBeDisabled();
  });

  it("calls syncAiProviderModels exactly once on open and does not loop on parent re-renders", async () => {
    const queryClient = createTestQueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <SyncModelsModal
          open={true}
          provider={{ ...mockProvider }}
          isOperational={true}
          onClose={() => {}}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(aiServices.syncAiProviderModels).toHaveBeenCalledTimes(1);
      expect(aiServices.syncAiProviderModels).toHaveBeenCalledWith(
        "prov-1",
        false,
        "token_plan_web",
        "web"
      );
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <SyncModelsModal
          open={true}
          provider={{ ...mockProvider, fields: { ...mockProvider.fields } }}
          isOperational={true}
          onClose={() => {}}
        />
      </QueryClientProvider>
    );

    expect(aiServices.syncAiProviderModels).toHaveBeenCalledTimes(1);
  });

  it("isolates agentic mode: queries agentic engine and saves models into fields.token_plan_agentic", async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={{
          ...mockProvider,
          default_mode: "token_plan_agentic",
          fields: {
            token_plan_web: {
              available_models: [{ id: "web-model-only" }],
              selected_model: "web-model-only",
            },
          },
        }}
        mode="token_plan_agentic"
        isOperational={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    await waitFor(() => {
      expect(aiServices.syncAiProviderModels).toHaveBeenCalledWith(
        "prov-1",
        false,
        "token_plan_agentic",
        "agentic"
      );
    });

    const submitBtn = screen.getByRole("button", { name: "Guardar Modelos" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(aiServices.updateAiProvider).toHaveBeenCalledWith(
        "prov-1",
        expect.objectContaining({
          fields: expect.objectContaining({
            token_plan_agentic: expect.objectContaining({
              available_models: expect.any(Array),
              selected_model: expect.any(String),
            }),
            token_plan_web: expect.objectContaining({
              selected_model: "web-model-only",
            }),
          }),
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("renders select all and deselect all as contained buttons", async () => {
    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={mockProvider}
        isOperational={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("3.8 Flash")[0]).toBeInTheDocument();
    });

    const selectAllBtn = screen.getByRole("button", { name: "Seleccionar todos" });
    const deselectAllBtn = screen.getByRole("button", { name: "Deseleccionar todos" });

    expect(selectAllBtn).toHaveClass("MuiButton-contained");
    expect(selectAllBtn).toHaveClass("MuiButton-colorPrimary");
    expect(deselectAllBtn).toHaveClass("MuiButton-contained");
    expect(deselectAllBtn).toHaveClass("MuiButton-colorPrimary");
  });

  it("filters models locally via InputSearch without calling syncAiProviderModels again", async () => {
    const user = userEvent.setup();

    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={mockProvider}
        isOperational={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("model-card-gemini-flash-lite")).toBeInTheDocument();
      expect(screen.getByTestId("model-card-gemini-flash")).toBeInTheDocument();
      expect(screen.getByTestId("model-card-gemini-pro")).toBeInTheDocument();
    });

    expect(aiServices.syncAiProviderModels).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByPlaceholderText("Buscar modelos por nombre, ID o capacidad...");
    await user.type(searchInput, "Pro");

    await waitFor(() => {
      expect(screen.getByTestId("model-card-gemini-pro")).toBeInTheDocument();
      expect(screen.queryByTestId("model-card-gemini-flash-lite")).not.toBeInTheDocument();
      expect(screen.queryByTestId("model-card-gemini-flash")).not.toBeInTheDocument();
    });

    // Verify it didn't call the endpoint again
    expect(aiServices.syncAiProviderModels).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when no models match the search query and restores on clear", async () => {
    const user = userEvent.setup();

    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={mockProvider}
        isOperational={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("3.8 Flash")[0]).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Buscar modelos por nombre, ID o capacidad...");
    await user.type(searchInput, "nonexistent-model-xyz");

    await waitFor(() => {
      expect(
        screen.getByText("No se encontraron modelos que coincidan con la búsqueda.")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("model-card-gemini-flash-lite")).not.toBeInTheDocument();
      expect(screen.queryByTestId("model-card-gemini-flash")).not.toBeInTheDocument();
      expect(screen.queryByTestId("model-card-gemini-pro")).not.toBeInTheDocument();
    });

    await user.clear(searchInput);

    await waitFor(() => {
      expect(screen.getByTestId("model-card-gemini-flash-lite")).toBeInTheDocument();
      expect(screen.getByTestId("model-card-gemini-flash")).toBeInTheDocument();
      expect(screen.getByTestId("model-card-gemini-pro")).toBeInTheDocument();
    });
  });

  it("selects and deselects only filtered models when search query is active", async () => {
    const user = userEvent.setup();

    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={mockProvider}
        isOperational={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("3.8 Flash")[0]).toBeInTheDocument();
    });

    // Deselect all models first
    const deselectAllBtn = screen.getByRole("button", { name: "Deseleccionar todos" });
    await user.click(deselectAllBtn);

    await waitFor(() => {
      expect(screen.getByText("0 seleccionados")).toBeInTheDocument();
    });

    // Filter by "Pro" (matches only gemini-pro)
    const searchInput = screen.getByPlaceholderText("Buscar modelos por nombre, ID o capacidad...");
    await user.type(searchInput, "Pro");

    await waitFor(() => {
      expect(screen.getByTestId("model-card-gemini-pro")).toBeInTheDocument();
      expect(screen.queryByTestId("model-card-gemini-flash-lite")).not.toBeInTheDocument();
    });

    // Click select all - should select only the filtered model (gemini-pro)
    const selectAllBtn = screen.getByRole("button", { name: "Seleccionar todos" });
    await user.click(selectAllBtn);

    await waitFor(() => {
      expect(screen.getByText("1 seleccionados")).toBeInTheDocument();
    });

    // Clear search to show all models
    await user.clear(searchInput);

    await waitFor(() => {
      expect(screen.getByText("1 seleccionados")).toBeInTheDocument();
      expect(screen.getByTestId("model-card-gemini-flash-lite")).toBeInTheDocument();
      expect(screen.getByTestId("model-card-gemini-flash")).toBeInTheDocument();
      expect(screen.getByTestId("model-card-gemini-pro")).toBeInTheDocument();
    });
  });
  it("preserves discovered selections and modal when saving fails", async () => {
    const onClose = vi.fn();
    const error = new AxiosError("request failed");
    Object.assign(error, { response: { data: { message: "Model unavailable" } } });
    vi.mocked(aiServices.updateAiProvider).mockRejectedValueOnce(error);
    renderWithClient(<SyncModelsModal open provider={mockProvider} isOperational onClose={onClose} />);
    await screen.findAllByText("3.8 Flash");
    await userEvent.click(screen.getByRole("button", { name: "Guardar Modelos" }));
    await waitFor(() => expect(sileo.error).toHaveBeenCalledWith(expect.objectContaining({ description: "Model unavailable" })));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar Modelos" })).toBeEnabled();
    expect(screen.getByText("3 seleccionados")).toBeInTheDocument();
  });
  it("does not discover or enable saving when engine availability is unknown", () => {
    renderWithClient(<SyncModelsModal open provider={mockProvider} onClose={() => {}} />);
    expect(aiServices.syncAiProviderModels).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar Modelos" })).toBeDisabled();
  });

});
