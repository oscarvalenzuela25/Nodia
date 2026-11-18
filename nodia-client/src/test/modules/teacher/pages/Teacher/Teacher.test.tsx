import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { expect, it, vi } from "vitest";
import Teacher from "../../../../../modules/teacher/pages/Teacher";
import { forgetRequest, pendingRequest, rememberRequest } from "../../../../../modules/teacher/infrastructure/recovery";
import { readTeacherData, readTeacherReceipt, sendTeacher } from "../../../../../modules/teacher/infrastructure/services";
import useAuthStore from "../../../../../store/authStore";

vi.mock("../../../../../modules/teacher/infrastructure/services", () => ({
  readTeacherData: vi.fn(), readTeacher: vi.fn(), readTeacherReceipt: vi.fn(), sendTeacher: vi.fn(),
}));

it("opens an existing plan while a missing receipt still protects the previous write", async () => {
  const auth = useAuthStore.getState();
  auth.login({ token: "synthetic-never-sent", expiresAt: Date.now() + 900_000, user: { id: "1", name: "Synthetic QA" } });
  const scope = `1:${useAuthStore.getState().sessionVersion}`;
  const key = "11111111-1111-4111-8111-111111111111";
  rememberRequest(scope, { requestKey: key, path: "sessions", method: "POST", body: {} });
  vi.mocked(readTeacherData).mockResolvedValue({
    data: [{ id: "fixture-plan", title: "Redes", topic: "DNS", objective: "Comprender DNS", state: "draft", revision: 1, updated_at: "2026-11-18T00:00:00.000Z" }],
    meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
  });
  vi.mocked(readTeacherReceipt).mockRejectedValue({ isAxiosError: true, response: { status: 404, data: { code: "not_found" } } });
  const client = new QueryClient();
  const router = createMemoryRouter([
    { path: "/nodia-teacher", element: <Teacher /> },
    { path: "/nodia-teacher/:sessionId", element: <h1>Plan abierto</h1> },
  ], { initialEntries: ["/nodia-teacher"] });
  const view = render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  try {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Consultar guardado" }));
    expect(await screen.findByRole("button", { name: "Cerrar solicitud pendiente" })).toBeEnabled();
    await user.click(screen.getByRole("link", { name: "Abrir plan" }));
    expect(await screen.findByRole("heading", { name: "Plan abierto" })).toBeInTheDocument();
    expect(pendingRequest(scope)?.requestKey).toBe(key);
    expect(sendTeacher).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    router.dispose();
    client.clear();
    forgetRequest();
  }
});
