import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import SyncModelsModal from "../../../../../../../modules/generalSettings/pages/AiProviders/components/ProviderDetail/components/SyncModelsModal/SyncModelsModal";
import * as aiServices from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";

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

const mockProvider = {
  id: "prov-1",
  key: "gemini",
  name: "Google Gemini",
  is_active: true,
  fields: {
    available_models: [],
    selected_model: "",
  },
  created_at: "2026-09-20",
  updated_at: "2026-09-20",
};

const mockDiscovered = {
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
    vi.mocked(aiServices.syncAiProviderModels).mockResolvedValue(mockDiscovered as any);
    vi.mocked(aiServices.updateAiProvider).mockResolvedValue({} as any);
  });

  it("fetches live models on open and renders the list with selection", async () => {
    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={mockProvider as any}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(aiServices.syncAiProviderModels).toHaveBeenCalledWith("prov-1", false);
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
        provider={mockProvider as any}
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

  it("shows error alert and allows retry if live discovery fails", async () => {
    vi.mocked(aiServices.syncAiProviderModels).mockRejectedValueOnce({
      response: { data: { message: "Sesión web expirada" } },
    });

    const user = userEvent.setup();
    renderWithClient(
      <SyncModelsModal
        open={true}
        provider={mockProvider as any}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("No se pudieron obtener los modelos")
      ).toBeInTheDocument();
      expect(screen.getByText("Sesión web expirada")).toBeInTheDocument();
    });

    // Retry
    vi.mocked(aiServices.syncAiProviderModels).mockResolvedValueOnce(mockDiscovered as any);
    const retryBtn = screen.getByRole("button", { name: "Reintentar" });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getAllByText("3.8 Flash")[0]).toBeInTheDocument();
    });
  });
});
