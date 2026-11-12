import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ResponseReflection from "../../../../../modules/teacher/components/AdaptiveWorkspace/ResponseReflection";

describe("optional response reflection", () => {
  it("starts without a declared confidence and saves an explicit zero", async () => {
    const onSave = vi.fn(async () => true);
    render(<ResponseReflection value={{ self_explanation: null, confidence: null }} disabled={false} canSave onDirty={vi.fn()} onSave={onSave} />);
    const input = screen.getByRole("textbox", { name: /Confianza declarada/ });
    expect(input).toHaveValue("");
    expect(screen.getByRole("button", { name: "Guardar reflexión" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "0" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Guardar reflexión" }));
    expect(onSave).toHaveBeenCalledWith({ self_explanation: null, confidence: 0 });
  });
  it("retains the explanation and dirty boundary after an unsuccessful save", async () => {
    const onDirty = vi.fn();
    const onSave = vi.fn(async () => false);
    render(<ResponseReflection value={{ self_explanation: null, confidence: null }} disabled={false} canSave onDirty={onDirty} onSave={onSave} />);
    const input = screen.getByRole("textbox", { name: /Qué te hizo elegir/ });
    fireEvent.change(input, { target: { value: "I guessed after eliminating one option" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Guardar reflexión" }));
    expect(input).toHaveValue("I guessed after eliminating one option");
    expect(onDirty).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "Guardar reflexión" })).toBeEnabled();
  });
  it("blocks invalid confidence without calling persistence", () => {
    const onSave = vi.fn();
    render(<ResponseReflection value={{ self_explanation: null, confidence: null }} disabled={false} canSave onDirty={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Confianza declarada/ }), { target: { value: "101" } });
    expect(screen.getByRole("button", { name: "Guardar reflexión" })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
