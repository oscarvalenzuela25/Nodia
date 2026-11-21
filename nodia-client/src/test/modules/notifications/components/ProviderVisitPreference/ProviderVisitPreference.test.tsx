import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import ProviderVisitPreference from "../../../../../modules/notifications/components/ProviderVisitPreference";
import * as services from "../../../../../modules/notifications/infrastructure/services";
import useAuthStore from "../../../../../store/authStore";

vi.mock("../../../../../modules/notifications/infrastructure/services", () => ({
  readProviderVisitPreference: vi.fn(),
  saveProviderVisitPreference: vi.fn(),
}));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

function renderPreference() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProviderVisitPreference businessId="business-a" />
    </QueryClientProvider>,
  );
}

describe("provider visit preference", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({
      token: "synthetic-test-token",
      user: { id: "current-account", name: "Current account" },
      expiresAt: Date.now() + 60_000,
      sessionVersion: 12,
      sessionStatus: "authenticated",
    });
  });

  it("loads and changes the current user’s preference for the selected business", async () => {
    const actor = { userId: "current-account", sessionVersion: 12 };
    vi.mocked(services.readProviderVisitPreference).mockResolvedValue({ enabled: false });
    vi.mocked(services.saveProviderVisitPreference).mockResolvedValue({ enabled: true });
    const user = userEvent.setup();
    renderPreference();
    const control = screen.getByRole("switch", { name: "Avisos de visitas de este negocio" });
    expect(control).toBeDisabled();
    await waitFor(() => expect(control).toBeEnabled());
    expect(control).not.toBeChecked();
    await user.click(control);
    await waitFor(() => expect(control).toBeChecked());
    expect(services.readProviderVisitPreference).toHaveBeenCalledWith(actor, "business-a", expect.any(AbortSignal));
    expect(services.saveProviderVisitPreference).toHaveBeenCalledWith(actor, "business-a", true);
    expect(sileo.success).toHaveBeenCalledWith({ title: "Avisos de este negocio activados" });
  });

  it("hides the personal preference when a viewer lacks business membership", async () => {
    const error = new AxiosError("Forbidden");
    Object.assign(error, { response: { status: 403 } });
    vi.mocked(services.readProviderVisitPreference).mockRejectedValue(error);
    renderPreference();
    await waitFor(() => expect(screen.queryByRole("switch")).not.toBeInTheDocument());
    expect(services.saveProviderVisitPreference).not.toHaveBeenCalled();
  });
});
