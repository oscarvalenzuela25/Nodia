import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FieldHelp from "../../../../../modules/teacher/components/FieldHelp";

describe("Teacher field help", () => {
  it("opens its explanation from keyboard focus without submitting the surrounding form", async () => {
    const submit = vi.fn(event => event.preventDefault());
    render(<form onSubmit={submit}><FieldHelp label="Tema" message="Ejemplo: redes y DNS." /></form>);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "Ayuda: Tema" })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Ejemplo: redes y DNS.");
    await user.keyboard("{Enter}");
    expect(submit).not.toHaveBeenCalled();
  });
});
