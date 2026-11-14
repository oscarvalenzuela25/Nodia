import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SessionForm from "../../../../../modules/teacher/components/SessionForm";

describe("Teacher session draft", () => {
  it("keeps input and modal intact across a rejected save and allows a new attempt", async () => {
    const onSave = vi.fn(async () => {});
    const onClose = vi.fn();
    const { rerender } = render(<SessionForm open busy={false} onSave={onSave} onClose={onClose} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Tema*" }), "Redes");
    await user.type(screen.getByRole("textbox", { name: "¿Qué es lo que quieres aprender?*" }), "Comprender DNS");
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    rerender(<SessionForm open busy onSave={onSave} onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeDisabled();
    rerender(<SessionForm open busy={false} onSave={onSave} onClose={onClose} />);
    expect(screen.getByRole("textbox", { name: "Tema*" })).toHaveValue("Redes");
    expect(screen.getByRole("textbox", { name: "¿Qué es lo que quieres aprender?*" })).toHaveValue("Comprender DNS");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  });
});
