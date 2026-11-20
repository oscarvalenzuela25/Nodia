import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BlockLearningTools from "../../../../../modules/teacher/components/AdaptiveWorkspace/BlockLearningTools";
import type { Session } from "../../../../../modules/teacher/infrastructure/schemas";
import type { useTeacherCommand } from "../../../../../modules/teacher/infrastructure/useServices";
import { mainInstance } from "../../../../../config/api";
const session = { id: "fixture-session", state: "active", revision: 1, active_attempts: [] } as unknown as Session;
const noReferences = { mainMarkdown: "Predict the result", hintMarkdown: null, solutionMarkdown: null, criteriaMarkdown: null, fields: [] };

function practiceProps(kind: string) {
  const execute = vi.fn<ReturnType<typeof useTeacherCommand>["execute"]>();
  return {
    execute,
    session,
    busy: false,
    command: { execute },
    onResult: vi.fn(),
    block: { id: "exercise", kind },
    contentVersionId: "version-one",
    history: [],
  };
}

describe("versioned lesson interaction continuity", () => {
  it("renders only the admitted version/block history with no secondary HTTP read", () => {
    const get = vi.spyOn(mainInstance, "get");
    render(<BlockLearningTools session={session} busy={false} command={{ execute: vi.fn() }} onResult={vi.fn()} contentVersionId="version-one" block={{ id: "prediction", kind: "prediction" }} practice={noReferences} history={[
      { id: "first", content_version_id: "version-one", block_id: "prediction", kind: "prediction", text: "My original prediction", created_at: "2026-11-11T00:00:00Z" },
      { id: "second", content_version_id: "version-two", block_id: "prediction", kind: "prediction", text: "Other version", created_at: "2026-11-11T00:00:00Z" },
    ]} />);
    expect(screen.getByText("My original prediction")).toBeInTheDocument();
    expect(screen.queryByText("Other version")).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    get.mockRestore();
  });
  it("keeps drafts bound to their original version when a new package arrives", () => {
    const props = { session, busy: false, command: { execute: vi.fn() }, onResult: vi.fn(), block: { id: "prediction", kind: "prediction" }, practice: noReferences, history: [] };
    const { rerender } = render(<BlockLearningTools {...props} contentVersionId="version-one" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Tu predicción" }), { target: { value: "Draft for version one" } });
    rerender(<BlockLearningTools {...props} contentVersionId="version-two" />);
    expect(screen.getByRole("textbox", { name: "Tu predicción" })).toHaveValue("");
    rerender(<BlockLearningTools {...props} contentVersionId="version-one" />);
    expect(screen.getByRole("textbox", { name: "Tu predicción" })).toHaveValue("Draft for version one");
  });
});

describe("formative feedback in a lesson block", () => {
  it("conceals references and checks only the current attempted fills without sending a command", async () => {
    const user = userEvent.setup();
    const props = practiceProps("guided_practice");
    const practice = { ...noReferences, hintMarkdown: "Piensa en cómo presentar un nombre.", solutionMarkdown: "name, two", fields: [
      { promptMarkdown: "My ___ is Veko.", answer: "name" },
      { promptMarkdown: "___ books.", answer: "two" },
    ] };
    render(<BlockLearningTools {...props} practice={practice} />);

    const first = screen.getByRole("textbox", { name: "Respuesta 1" });
    const second = screen.getByRole("textbox", { name: "Respuesta 2" });
    expect(first).toHaveAccessibleDescription("My ___ is Veko.");
    const check = screen.getByRole("button", { name: "Comprobar mis respuestas" });
    expect(check).toBeDisabled();
    expect(screen.queryByText("name, two")).not.toBeInTheDocument();
    expect(screen.queryByText(practice.hintMarkdown)).not.toBeInTheDocument();
    await user.type(first, "name");
    await user.type(second, "one");
    expect(second).toHaveAttribute("aria-invalid", "false");

    await user.click(check);
    expect(first).toHaveAccessibleDescription(/Coincide con la respuesta esperada/);
    expect(second).toHaveAttribute("aria-invalid", "true");
    expect(second).toHaveAccessibleDescription(/Revisa este espacio/);
    expect(screen.getByRole("status")).toHaveTextContent("Coinciden 1 de 2 respuestas");
    expect(screen.queryByText("name, two")).not.toBeInTheDocument();
    await user.clear(second);
    await user.type(second, "two");
    expect(second).toHaveAttribute("aria-invalid", "false");
    await user.click(check);
    expect(screen.getByRole("status")).toHaveTextContent("Todas tus respuestas coinciden");

    await user.click(screen.getByRole("button", { name: "Ver pista" }));
    expect(screen.getByText(practice.hintMarkdown)).toBeVisible();
    const reveal = screen.getByRole("button", { name: "Ver solución" });
    expect(reveal).toHaveAttribute("aria-expanded", "false");
    await user.click(reveal);
    expect(reveal).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("name, two")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Ocultar solución" }));
    expect(screen.queryByText("name, two")).not.toBeInTheDocument();
    expect(props.execute).not.toHaveBeenCalled();
  });

  it("guides revision of an open answer and retains the text when an explicit save is unconfirmed", async () => {
    const user = userEvent.setup();
    const props = practiceProps("check");
    const practice = { ...noReferences, criteriaMarkdown: "¿El saludo corresponde al momento del día?, ¿La presentación incluye tu nombre?" };
    const receipt = { resource_id: "saved-response" };
    props.execute.mockResolvedValueOnce(null).mockResolvedValueOnce(receipt);
    render(<BlockLearningTools {...props} practice={practice} />);

    const answer = screen.getByRole("textbox", { name: "Tu respuesta" });
    const review = screen.getByRole("button", { name: "Revisar mi respuesta" });
    expect(review).toBeDisabled();
    expect(screen.queryByText("¿El saludo corresponde al momento del día?")).not.toBeInTheDocument();
    await user.type(answer, "Good afternoon. My name is Lumo.");
    await user.click(review);
    const feedback = screen.getByRole("region", { name: "Compara tu intento" });
    expect(within(feedback).getAllByRole("listitem")).toHaveLength(2);
    expect(feedback).toHaveTextContent("¿El saludo corresponde al momento del día?");
    expect(feedback).toHaveTextContent("Esta revisión es personal y no genera una calificación.");
    expect(props.execute).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Mejorar mi respuesta" }));
    expect(answer).toHaveFocus();
    expect(answer).toHaveValue("Good afternoon. My name is Lumo.");
    await user.clear(answer);
    await user.type(answer, "Good morning. My name is Lumo.");

    const save = screen.getByRole("button", { name: "Guardar respuesta del bloque" });
    await user.click(save);
    await waitFor(() => expect(save).toBeEnabled());
    expect(answer).toHaveValue("Good morning. My name is Lumo.");
    expect(props.execute).toHaveBeenCalledWith("sessions/fixture-session/learning/interactions", {
      block_id: "exercise", content_version_id: "version-one", expected_session_revision: 1, kind: "check", text: "Good morning. My name is Lumo.",
    });
    await user.click(save);
    await waitFor(() => expect(answer).toHaveValue(""));
    expect(props.onResult).toHaveBeenCalledWith(receipt);
  });

  it("offers a local guided attempt when there is no exact answer key", async () => {
    const user = userEvent.setup();
    const props = practiceProps("guided_practice");
    render(<BlockLearningTools {...props} practice={noReferences} />);

    expect(screen.getByText(/se conserva mientras esta vista siga abierta/i)).toBeVisible();
    const answer = screen.getByRole("textbox", { name: "Tu respuesta" });
    await user.type(answer, "Mi explicación");
    await user.click(screen.getByRole("button", { name: "Revisar mi respuesta" }));
    expect(screen.getByRole("region", { name: "Compara tu intento" })).toHaveTextContent("Relee la consigna");
    expect(answer).toHaveValue("Mi explicación");
    expect(screen.queryByRole("button", { name: "Guardar respuesta del bloque" })).not.toBeInTheDocument();
    expect(props.execute).not.toHaveBeenCalled();
  });

  it("withholds the local helpers during a section final", () => {
    const props = practiceProps("check");
    const practice = { ...noReferences, solutionMarkdown: "A hidden reference" };
    const final = { ...session, active_attempts: [{ attempt_id: "attempt", scope: "section_final", state: "in_progress", section_id: "section", unit_id: null }] };
    render(<BlockLearningTools {...props} session={final} practice={practice} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver solución" })).not.toBeInTheDocument();
  });
});
