import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import MobileShortcutDialog from "../../../../layouts/components/MobileShortcutDialog";
import { buildShortcutCatalog } from "../../../../layouts/components/MobileBottomNav/catalog";
import { groups } from "../MobileBottomNav/fixtures";
import i18n from "../../../../translate";
const props = () => ({ slotIndex: 0, current: null, occupied: [], options: buildShortcutCatalog(groups, "es"), busy: false, contextError: false, loading: false, onRetry: vi.fn(), onClose: vi.fn(), onSave: vi.fn().mockReturnValue(true) });
it("allows keyboard selection and saves the reference rather than a label or URL", async () => {
  const callbacks = props(); render(<MobileShortcutDialog {...callbacks} />);
  const reservations = screen.getByRole("radio", { name: "Reservas" });
  reservations.focus(); await userEvent.keyboard("{ArrowDown}");
  expect(screen.getByRole("radio", { name: "Finanzas" })).toHaveFocus();
  expect(screen.getByRole("radio", { name: "Finanzas" })).toHaveAttribute("aria-checked", "true");
  await userEvent.click(screen.getByRole("button", { name: i18n.t("core:save") }));
  expect(callbacks.onSave).toHaveBeenCalledWith({ groupKey: "tools", moduleKey: "finances" });
  expect(callbacks.onClose).toHaveBeenCalledOnce();
});
it("filters locally and reports no matches without changing the current selection", async () => {
  render(<MobileShortcutDialog {...props()} />);
  await userEvent.click(screen.getByRole("radio", { name: "Reservas" }));
  await userEvent.type(screen.getByRole("textbox", { name: i18n.t("layout:mobile_nav.search") }), "xyz");
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(i18n.t("layout:mobile_nav.no_matches")));
  expect(screen.getByRole("button", { name: i18n.t("core:save") })).toBeEnabled();
});
it("shows an empty catalog only after loading completes and disables controls while fetching", () => {
  const callbacks = props();
  const view = render(<MobileShortcutDialog {...callbacks} options={[]} busy loading />);
  expect(screen.queryByText(i18n.t("layout:mobile_nav.empty"))).not.toBeInTheDocument();
  expect(screen.getByRole("textbox")).toBeDisabled();
  view.rerender(<MobileShortcutDialog {...callbacks} options={[]} />);
  expect(screen.getByRole("status")).toHaveTextContent(i18n.t("layout:mobile_nav.empty"));
});
