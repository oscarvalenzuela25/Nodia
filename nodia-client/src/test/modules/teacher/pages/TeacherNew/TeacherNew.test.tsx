import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeacherNew from "../../../../../modules/teacher/pages/TeacherNew";
import type { CommandResult, Selection } from "../../../../../modules/teacher/infrastructure/schemas";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), ready: true, blocked: false, selectionAvailable: true }));
const selection: Selection = { connection_id: "42", mode: "agentic", model_id: "fixture-discovered-model", effort_id: "fixture-effort" };
vi.mock("../../../../../hooks/useAuth", () => ({ default: () => ({ user: { id: "fixture-actor" }, sessionVersion: 1 }) }));
vi.mock("../../../../../modules/teacher/infrastructure/useServices", () => ({ useTeacherCommand: () => ({ execute: mocks.execute, blocked: mocks.blocked, uncertain: null }) }));
vi.mock("../../../../../modules/teacher/components/SelectionPanel", () => ({
  default: function FixtureSelection({ onSelectionChange }: { onSelectionChange: (state: { selection: Selection | null; ready: boolean }) => void }) {
    useEffect(() => onSelectionChange({ selection: mocks.selectionAvailable ? selection : null, ready: mocks.ready }), [onSelectionChange]);
    return <p>Fixture AI selector</p>;
  },
}));

function openPage() {
  return render(<MemoryRouter initialEntries={["/nodia-teacher/new"]}><Routes>
    <Route path="/nodia-teacher/new" element={<TeacherNew />} />
    <Route path="/nodia-teacher/:sessionId" element={<p>Created session</p>} />
  </Routes></MemoryRouter>);
}
async function fillRequired() {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Tema*" }), " Redes ");
  await user.type(screen.getByRole("textbox", { name: "¿Qué es lo que quieres aprender?*" }), " Comprender DNS ");
  return user;
}
beforeEach(() => { mocks.execute.mockReset(); mocks.execute.mockResolvedValue(null); mocks.ready = true; mocks.blocked = false; mocks.selectionAvailable = true; });

describe("new Teacher plan", () => {
  it("creates and queues through one command with the exact selection, then opens its session", async () => {
    mocks.execute.mockResolvedValue({ session_id: "fixture-session", job_id: "fixture-job" });
    openPage(); const user = await fillRequired();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear plan" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledExactlyOnceWith("sessions", {
      topic: "Redes", objective: "Comprender DNS", title: undefined, declared_base: null, context: null,
      explanation_language: "es", organization: "teacher_suggests", day_count: null, selection, start_plan: true,
    }));
    expect(await screen.findByText("Created session")).toBeInTheDocument();
  });
  it("preserves the complete form after a rejected command and blocks another submit while in flight", async () => {
    let finish!: (value: CommandResult | null) => void;
    mocks.execute.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    openPage(); const user = await fillRequired();
    await user.type(screen.getByRole("textbox", { name: "Contexto base (opcional)" }), "Diagnosticar mi red");
    await user.click(screen.getByRole("button", { name: "Crear plan" }));
    expect(screen.getByRole("button", { name: "Crear plan" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Tema*" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Crear plan" }));
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    finish(null);
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear plan" })).toBeEnabled());
    expect(screen.getByRole("textbox", { name: "Tema*" })).toHaveValue(" Redes ");
    expect(screen.getByRole("textbox", { name: "Contexto base (opcional)" })).toHaveValue("Diagnosticar mi red");
  });
  it("blocks creation without current exact-selection readiness, including a form submit", async () => {
    mocks.ready = false;
    const { container } = openPage(); await fillRequired();
    expect(screen.getByRole("button", { name: "Crear plan" })).toBeDisabled();
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear plan" })).toBeDisabled());
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("can save a draft without an AI selection while plan generation remains disabled", async () => {
    mocks.ready = false; mocks.selectionAvailable = false;
    mocks.execute.mockResolvedValue({ session_id: "fixture-draft", revision: 1 });
    openPage(); const user = await fillRequired();
    expect(screen.getByRole("button", { name: "Crear plan" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledExactlyOnceWith("sessions", {
      topic: "Redes", objective: "Comprender DNS", title: undefined, declared_base: null, context: null,
      explanation_language: "es", organization: "teacher_suggests", day_count: null, start_plan: false,
    }));
    expect(await screen.findByText("Created session")).toBeInTheDocument();
  });
  it("warns before leaving an unsaved form and removes the listener when unmounted", async () => {
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
