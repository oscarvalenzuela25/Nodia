import { useEffect, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherNew from "../../../../../modules/teacher/pages/TeacherNew";
import type { CommandResult, Selection } from "../../../../../modules/teacher/infrastructure/schemas";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), ready: true, blocked: false, selectionAvailable: true, selectorMounts: 0 }));
const selection: Selection = { connection_id: "42", mode: "agentic", model_id: "fixture-discovered-model", effort_id: "fixture-effort" };
vi.mock("../../../../../hooks/useAuth", () => ({ default: () => ({ user: { id: "fixture-actor" }, sessionVersion: 1 }) }));
vi.mock("../../../../../modules/teacher/infrastructure/useServices", () => ({ useTeacherCommand: () => ({ execute: mocks.execute, blocked: mocks.blocked, uncertain: null }) }));
vi.mock("../../../../../modules/teacher/components/SelectionPanel", () => ({
  default: function FixtureSelection({ onSelectionChange }: { onSelectionChange: (state: { selection: Selection | null; ready: boolean }) => void }) {
    const [effort, setEffort] = useState(selection.effort_id ?? "");
    useEffect(() => { mocks.selectorMounts += 1; }, []);
    useEffect(() => onSelectionChange({ selection: mocks.selectionAvailable ? { ...selection, effort_id: effort } : null, ready: mocks.ready }), [onSelectionChange, effort]);
    return <label>Fixture AI effort<input value={effort} onChange={event => setEffort(event.target.value)} /></label>;
  },
}));

const routers: ReturnType<typeof createMemoryRouter>[] = [];
function openPage() {
  const router = createMemoryRouter([
    { path: "/nodia-teacher/new", element: <TeacherNew /> },
    { path: "/nodia-teacher", element: <p>My plans destination</p> },
    { path: "/nodia-teacher/:sessionId", element: <p>Created session</p> },
  ], { initialEntries: ["/nodia-teacher/new"] });
  routers.push(router);
  return { ...render(<RouterProvider router={router} />), router };
}
async function fillRequired() {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Tema*" }), " Redes ");
  await user.type(screen.getByRole("textbox", { name: "¿Qué es lo que quieres aprender?*" }), " Comprender DNS ");
  return user;
}
async function goToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(await screen.findByRole("heading", { name: "Cómo quieres organizarte" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  expect(await screen.findByRole("heading", { name: "Revisar y preparar" })).toBeInTheDocument();
}
beforeEach(() => {
  mocks.execute.mockReset();
  mocks.execute.mockResolvedValue(null);
  mocks.ready = true;
  mocks.blocked = false;
  mocks.selectionAvailable = true;
  mocks.selectorMounts = 0;
});
afterEach(() => { routers.splice(0).forEach(router => router.dispose()); });

describe("new Teacher study", () => {
  it("validates steps locally and creates one proposal with the exact selection only on the final action", async () => {
    mocks.execute.mockResolvedValue({ session_id: "fixture-session", job_id: "fixture-job" });
    openPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("heading", { name: "Qué quieres aprender" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tema*" })).toHaveFocus();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.selectorMounts).toBe(0);
    await fillRequired();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Cómo quieres organizarte" })).toHaveFocus();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.selectorMounts).toBe(0);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Revisar y preparar" })).toHaveFocus();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear propuesta" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledExactlyOnceWith("sessions", {
      topic: "Redes", objective: "Comprender DNS", title: undefined, declared_base: null, context: null,
      explanation_language: "es", organization: "teacher_suggests", day_count: null, selection, start_plan: true,
    }));
    expect(await screen.findByText("Created session")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserves fields, optional context and the selector draft when revisiting completed steps", async () => {
    openPage();
    const user = await fillRequired();
    await user.type(screen.getByRole("textbox", { name: "Título del plan de estudio (opcional)" }), "Mi estudio");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Añadir contexto (opcional)" }));
    await user.type(screen.getByRole("textbox", { name: "Contexto base (opcional)" }), "Diagnosticar mi red");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    const effort = screen.getByRole("textbox", { name: "Fixture AI effort" });
    await user.clear(effort);
    await user.type(effort, "fixture-chosen-effort");
    await user.click(screen.getByRole("button", { name: "Editar objetivo" }));
    expect(screen.getByRole("textbox", { name: "Tema*" })).toHaveValue(" Redes ");
    expect(screen.getByRole("textbox", { name: "Título del plan de estudio (opcional)" })).toHaveValue("Mi estudio");
    await goToReview(user);
    expect(screen.getByRole("textbox", { name: "Fixture AI effort" })).toHaveValue("fixture-chosen-effort");
    expect(mocks.selectorMounts).toBe(1);
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByRole("textbox", { name: "Contexto base (opcional)" })).toHaveValue("Diagnosticar mi red");
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("preserves the complete form after a rejected command and blocks another submit while in flight", async () => {
    let finish!: (value: CommandResult | null) => void;
    mocks.execute.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { container } = openPage();
    const user = await fillRequired();
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Crear propuesta" }));
    expect(screen.getByRole("button", { name: "Crear propuesta" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.submit(container.querySelector("form")!);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    await act(async () => finish(null));
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear propuesta" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Editar objetivo" }));
    expect(screen.getByRole("textbox", { name: "Tema*" })).toHaveValue(" Redes ");
    expect(screen.getByRole("textbox", { name: "¿Qué es lo que quieres aprender?*" })).toHaveValue(" Comprender DNS ");
    expect(screen.queryByText("Created session")).not.toBeInTheDocument();
  });

  it("blocks creation without current exact-selection readiness, including a form submit", async () => {
    mocks.ready = false;
    const { container } = openPage();
    const user = await fillRequired();
    await goToReview(user);
    expect(screen.getByRole("button", { name: "Crear propuesta" })).toBeDisabled();
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear propuesta" })).toBeDisabled());
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("can save a draft without an AI selection while plan generation remains disabled", async () => {
    mocks.ready = false;
    mocks.selectionAvailable = false;
    mocks.execute.mockResolvedValue({ session_id: "fixture-draft", revision: 1 });
    openPage();
    const user = await fillRequired();
    await goToReview(user);
    expect(screen.getByRole("button", { name: "Crear propuesta" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Guardar borrador y salir" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledExactlyOnceWith("sessions", {
      topic: "Redes", objective: "Comprender DNS", title: undefined, declared_base: null, context: null,
      explanation_language: "es", organization: "teacher_suggests", day_count: null, start_plan: false,
    }));
    expect(await screen.findByText("Created session")).toBeInTheDocument();
  });

  it("protects an incomplete form on SPA exit and preserves editing when leaving is cancelled", async () => {
    openPage();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Tema*" }), " Redes ");
    await user.click(screen.getByRole("link", { name: /Mis planes/ }));
    const dialog = await screen.findByRole("dialog", { name: "Tu estudio aún no está guardado" });
    expect(within(dialog).queryByRole("button", { name: "Guardar borrador y salir" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Seguir editando" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Tema*" })).toHaveValue(" Redes ");
    expect(mocks.execute).not.toHaveBeenCalled();
    await user.click(screen.getByRole("link", { name: /Mis planes/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Salir sin guardar" }));
    expect(await screen.findByText("My plans destination")).toBeInTheDocument();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("keeps the exit dialog and data after a failed draft save and leaves only after the server confirms", async () => {
    openPage();
    const user = await fillRequired();
    await user.click(screen.getByRole("link", { name: /Mis planes/ }));
    const dialog = await screen.findByRole("dialog", { name: "Tu estudio aún no está guardado" });
    await user.click(within(dialog).getByRole("button", { name: "Guardar borrador y salir" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("dialog", { name: "Tu estudio aún no está guardado" })).toBeInTheDocument();
    expect(screen.queryByText("My plans destination")).not.toBeInTheDocument();
    expect(mocks.execute.mock.calls[0]?.[1]).toMatchObject({ topic: "Redes", objective: "Comprender DNS", start_plan: false });
    mocks.execute.mockResolvedValue({ session_id: "fixture-draft", revision: 1 });
    await user.click(within(dialog).getByRole("button", { name: "Guardar borrador y salir" }));
    expect(await screen.findByText("My plans destination")).toBeInTheDocument();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Created session")).not.toBeInTheDocument();
  });

  it("allows a day-based proposal with no day count instead of imposing a new required field", async () => {
    mocks.execute.mockResolvedValue({ session_id: "fixture-session", job_id: "fixture-job" });
    openPage();
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Organización" }));
    await user.click(await screen.findByRole("option", { name: "Por jornadas" }));
    expect(await screen.findByRole("spinbutton", { name: "Cantidad de jornadas" })).toHaveValue(null);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Revisar y preparar" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear propuesta" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledExactlyOnceWith("sessions", {
      topic: "Redes", objective: "Comprender DNS", title: undefined, declared_base: null, context: null,
      explanation_language: "es", organization: "days", day_count: null, selection, start_plan: true,
    }));
    expect(await screen.findByText("Created session")).toBeInTheDocument();
  });

  it("reopens optional context and focuses its invalid field before allowing the review step", async () => {
    openPage();
    const user = await fillRequired();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    const contextToggle = screen.getByRole("button", { name: "Añadir contexto (opcional)" });
    await user.click(contextToggle);
    const context = screen.getByRole("textbox", { name: "Contexto base (opcional)" });
    fireEvent.change(context, { target: { value: "x".repeat(4001) } });
    await user.click(contextToggle);
    expect(contextToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("heading", { name: "Cómo quieres organizarte" })).toBeInTheDocument();
    expect(contextToggle).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(context).toHaveFocus());
    expect(context).toHaveValue("x".repeat(4001));
    expect(context).toHaveAttribute("aria-invalid", "true");
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.change(context, { target: { value: "Diagnosticar mi red" } });
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Revisar y preparar" })).toBeInTheDocument();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("warns before unloading an unsaved form and removes the listener when unmounted", async () => {
    const { unmount } = openPage();
    const untouched = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(untouched);
    expect(untouched.defaultPrevented).toBe(false);
    await fillRequired();
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    unmount();
    const afterUnmount = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });
});
