import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Link } from "react-router";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { sileo } from "sileo";
import MobileBottomNav from "../../../../layouts/components/MobileBottomNav";
import useAuthStore from "../../../../store/authStore";
import settings from "../../../../store/generalSettings/generalSettingsStore";
import { useMobileNavigationStore } from "../../../../store/mobileNavigationStore";
import { groups } from "./fixtures";
import i18n from "../../../../translate";

const load = vi.hoisted(() => vi.fn());
vi.mock("../../../../layouts/components/MobileBottomNav/loadShortcutDialog", () => ({ loadShortcutDialog: load }));
vi.mock("../../../../services/authorizationService", () => ({ useAuthorizationContext: () => ({ isFetching: false, isError: false, refetch: vi.fn() }) }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const realDialog = () => import("../../../../layouts/components/MobileShortcutDialog");
const setup = () => render(<ThemeProvider theme={createTheme()}><MemoryRouter>
  <input aria-label="Existing draft" defaultValue="" /><Link to="/tools/reservations">Navigate</Link><MobileBottomNav />
</MemoryRouter></ThemeProvider>);
const slot = () => screen.getByRole("button", { name: i18n.t("layout:mobile_nav.add_slot", { position: i18n.t("layout:mobile_nav.slot_0") }) });
beforeEach(() => {
  vi.clearAllMocks(); load.mockReset(); load.mockImplementation(realDialog);
  useAuthStore.getState().logout();
  useAuthStore.getState().login({ token: "synthetic", expiresAt: Date.now() + 900_000, user: { id: "a", name: "A" } });
  settings.getState().setContext({ roles: [], actions: [], modules: groups });
  useMobileNavigationStore.getState().hydrate(null);
});

it("keeps initial navigation immediate, opens on intent, traps focus and returns it on Escape without another import", async () => {
  setup(); const trigger = slot();
  expect(load).not.toHaveBeenCalled();
  expect(trigger).toBeEnabled();
  await userEvent.click(trigger);
  const dialog = await screen.findByRole("dialog");
  expect(load).toHaveBeenCalledOnce();
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  expect(await screen.findByRole("dialog")).toBeVisible();
  expect(load).toHaveBeenCalledOnce();
});

it.each(["es", "en"])("shows loading and a local retry in %s while preserving the current page's draft", async language => {
  await i18n.changeLanguage(language);
  let reject!: (error: Error) => void;
  load.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  setup(); const trigger = slot();
  await userEvent.type(screen.getByRole("textbox", { name: "Existing draft" }), "Unsaved details");
  await userEvent.click(trigger);
  expect(trigger).toBeDisabled();
  expect(trigger).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status")).toHaveTextContent(i18n.t("layout:mobile_nav.editor_loading"));
  expect(screen.getByRole("button", { name: i18n.t("layout:mobile_nav.lock") })).toBeDisabled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Existing draft" })).toBeEnabled();
  await act(async () => { reject(new Error("network unavailable")); });
  expect(screen.getByRole("alert")).toHaveTextContent(i18n.t("layout:mobile_nav.editor_load_error"));
  expect(sileo.error).toHaveBeenCalledExactlyOnceWith({ title: i18n.t("layout:mobile_nav.editor_load_error") });
  expect(trigger).toBeEnabled();
  expect(trigger).toHaveFocus();
  expect(screen.getByRole("textbox", { name: "Existing draft" })).toHaveValue("Unsaved details");
  await userEvent.click(trigger);
  expect(await screen.findByRole("dialog")).toBeVisible();
  expect(load).toHaveBeenCalledTimes(2);
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("textbox", { name: "Existing draft" })).toHaveValue("Unsaved details");
});

it("does not open a late editor after navigating away from the requested page", async () => {
  const module = await realDialog();
  let resolve!: (value: typeof module) => void;
  load.mockImplementationOnce(() => new Promise(ok => { resolve = ok; }));
  setup();
  await userEvent.click(slot());
  await userEvent.click(screen.getByRole("link", { name: "Navigate" }));
  expect(screen.getByRole("link", { name: "Navigate" })).toHaveFocus();
  await act(async () => { resolve(module); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(slot()).toBeEnabled();
  expect(screen.getByRole("link", { name: "Navigate" })).toHaveFocus();
  expect(sileo.error).not.toHaveBeenCalled();
});
