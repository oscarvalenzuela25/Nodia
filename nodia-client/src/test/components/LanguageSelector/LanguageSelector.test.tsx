import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import LanguageSelector from "../../../components/LanguageSelector";
import i18n from "../../../translate";

describe("LanguageSelector", () => {
  it.each(["es", "en"])("includes the visible language in its accessible name for %s", async (language) => {
    await act(async () => { await i18n.changeLanguage(language); });
    render(<LanguageSelector />);
    const button = screen.getByRole("button", { name: i18n.t("layout:toggle_language_label", { language: language.toUpperCase() }) });
    expect(button).toHaveTextContent(language.toUpperCase());
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the translated menu and switches to English", async () => {
    const user = userEvent.setup();
    render(<LanguageSelector />);
    const button = screen.getByRole("button", { name: "ES · Cambiar idioma" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("menuitem", { name: /español/i })).toBeVisible();
    await user.click(screen.getByRole("menuitem", { name: /inglés/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: "EN · Change language" })).toHaveAttribute("aria-expanded", "false"));
    expect(i18n.language).toBe("en");
  });

  it("opens by keyboard and returns focus to the selector on Escape", async () => {
    const user = userEvent.setup();
    render(<LanguageSelector />);
    const button = screen.getByRole("button", { name: "ES · Cambiar idioma" });
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
