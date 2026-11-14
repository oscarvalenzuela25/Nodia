import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import SessionFields from "../../../../../modules/teacher/components/SessionForm/SessionFields";
import { sessionFormDefaults } from "../../../../../modules/teacher/components/SessionForm/formValues";
import type { CreateSession } from "../../../../../modules/teacher/infrastructure/schemas";

function Form({ language = "es", busy = false, save }: { language?: string; busy?: boolean; save: (value: CreateSession) => void }) {
  const { control, handleSubmit } = useForm<CreateSession>({ defaultValues: { ...sessionFormDefaults(language), topic: "Redes", objective: "Comprender DNS" } });
  return <form onSubmit={handleSubmit(save)}><SessionFields control={control} errors={{}} busy={busy} /><button type="submit">Guardar</button></form>;
}

describe("Teacher session fields", () => {
  it.each(["es-CL", "xx-Private"])("preserves the historical language %s until the learner explicitly selects another", async language => {
    const save = vi.fn();
    render(<Form language={language} save={save} />);
    const user = userEvent.setup();
    const selector = screen.getByRole("button", { name: "Idioma de explicación" });
    expect(selector).toHaveTextContent(language);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].explanation_language).toBe(language);
    await user.click(selector);
    expect(screen.getByRole("option", { name: `${language} (valor conservado)` })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: "Inglés" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][0].explanation_language).toBe("en");
  });

  it("offers independent field help and reveals the day input only for day organization", async () => {
    const save = vi.fn();
    render(<Form save={save} />);
    const user = userEvent.setup();
    expect(screen.getAllByRole("button", { name: /^Ayuda:/ })).toHaveLength(7);
    await user.click(screen.getByRole("button", { name: "Ayuda: Organización" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Organización" }));
    await user.click(screen.getByRole("option", { name: "Por jornadas" }));
    expect(screen.getAllByRole("button", { name: /^Ayuda:/ })).toHaveLength(8);
    await user.type(screen.getByRole("spinbutton", { name: "Cantidad de jornadas" }), "10");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0]).toMatchObject({ organization: "days", day_count: 10, topic: "Redes" });
  });

  it("keeps values visible while busy and blocks both text and language changes", async () => {
    const save = vi.fn();
    const view = render(<Form save={save} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Tema*" }), " y DNS");
    view.rerender(<Form save={save} busy />);
    expect(screen.getByRole("textbox", { name: "Tema*" })).toHaveValue("Redes y DNS");
    expect(screen.getByRole("textbox", { name: "Tema*" })).toBeDisabled();
    const selector = screen.getByRole("button", { name: "Idioma de explicación" });
    expect(selector).toHaveAttribute("aria-disabled", "true");
    await user.click(selector);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps each named value when starting with the plan title and describing the learner's background", async () => {
    const save = vi.fn();
    render(<Form save={save} />);
    const user = userEvent.setup();
    const title = screen.getByRole("textbox", { name: "Título del plan de estudio" });
    expect(screen.getAllByRole("textbox")[0]).toBe(title);
    await user.type(title, "Mi plan de redes");
    const knowledge = screen.getByRole("textbox", { name: "¿Qué es lo que ya sé? (opcional)" });
    const context = screen.getByRole("textbox", { name: "Contexto base (opcional)" });
    expect(knowledge).toHaveAccessibleDescription("Describe lo que ya conoces y lo que te cuesta, o indica que empiezas desde cero.");
    expect(context).toHaveAccessibleDescription("Cuenta desde qué situación o proyecto partes y para qué quieres aplicar lo aprendido.");
    await user.type(knowledge, "Conozco las direcciones IP");
    await user.type(context, "Tengo una API en Ubuntu");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0]).toMatchObject({ title: "Mi plan de redes", topic: "Redes", objective: "Comprender DNS",
      declared_base: "Conozco las direcciones IP", context: "Tengo una API en Ubuntu" });
  });
});
