import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PersonalNewsConnectionDialog from "../../../../../modules/news/components/PersonalNews/PersonalNewsConnectionDialog";

describe("Personal News connection dialog", () => {
  it("initially conceals the credential, validates after submit and returns focus to an invalid field", async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();
    render(<PersonalNewsConnectionDialog provider="dev-community" reconnect={false} active busy={false} onClose={vi.fn()} onConnect={onConnect} />);
    const key = screen.getByLabelText(/API key/);
    expect(screen.getByRole("dialog", { name: "Conectar DEV" })).toBeVisible();
    expect(key).toHaveAttribute("type", "password");
    await waitFor(() => expect(key).toHaveFocus());
    expect(key).toHaveAttribute("aria-invalid", "false");
    await user.click(screen.getByRole("button", { name: "Probar y conectar" }));
    expect(await screen.findByText("Ingresa tu API key.")).toBeVisible();
    expect(key).toHaveAttribute("aria-invalid", "true");
    expect(key).toHaveAccessibleDescription("Ingresa tu API key.");
    await waitFor(() => expect(key).toHaveFocus());
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("restores masking on submit and preserves the draft after provider rejection", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConnect = vi.fn().mockResolvedValue({ ok: false, fieldError: "DEV rechazó la clave." });
    render(<PersonalNewsConnectionDialog provider="dev-community" reconnect={true} active busy={false} onClose={onClose} onConnect={onConnect} />);
    const key = screen.getByLabelText(/API key/);
    await user.type(key, "synthetic-unit-test-key");
    await user.click(screen.getByRole("button", { name: "Mostrar clave" }));
    expect(key).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Probar y reemplazar" }));
    expect(await screen.findByText("DEV rechazó la clave.")).toBeVisible();
    expect(onConnect).toHaveBeenCalledExactlyOnceWith("synthetic-unit-test-key");
    expect(key).toHaveValue("synthetic-unit-test-key");
    expect(key).toHaveAttribute("type", "password");
    await waitFor(() => expect(key).toHaveFocus());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clears the credential on cancellation without sending it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConnect = vi.fn();
    render(<PersonalNewsConnectionDialog provider="dev-community" reconnect={false} active busy={false} onClose={onClose} onConnect={onConnect} />);
    const key = screen.getByLabelText(/API key/);
    await user.type(key, "synthetic-unit-test-key");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onConnect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
    expect(key).toHaveValue("");
  });

  it("gives daily.dev its own masked PAT instructions and keeps rejected credentials in its dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConnect = vi.fn().mockResolvedValue({ ok: false, fieldError: "daily.dev rechazó el token." });
    render(<PersonalNewsConnectionDialog provider="daily-dev" reconnect={false} active busy={false} onClose={onClose} onConnect={onConnect} />);
    const key = screen.getByLabelText(/Token de acceso personal/);

    expect(screen.getByRole("dialog", { name: "Conectar daily.dev" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Abrir ajustes de API de daily.dev" })).toHaveAttribute("href", "https://daily.dev/settings/api");
    await waitFor(() => expect(key).toHaveFocus());
    expect(key).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Probar y conectar" }));
    expect(await screen.findByText("Ingresa tu token de acceso personal.")).toBeVisible();
    await user.type(key, "synthetic-daily-pat-for-test");
    await user.click(screen.getByRole("button", { name: "Probar y conectar" }));
    expect(await screen.findByText("Ingresa el token de daily.dev que empieza por dda_.")).toBeVisible();
    expect(onConnect).not.toHaveBeenCalled();
    await user.clear(key);
    await user.type(key, "dda_synthetic-daily-pat-for-test");
    await user.click(screen.getByRole("button", { name: "Probar y conectar" }));

    expect(await screen.findByText("daily.dev rechazó el token.")).toBeVisible();
    expect(key).toHaveValue("dda_synthetic-daily-pat-for-test");
    expect(onConnect).toHaveBeenCalledExactlyOnceWith("dda_synthetic-daily-pat-for-test");
    expect(onClose).not.toHaveBeenCalled();
  });
});
