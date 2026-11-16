import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NewsTopicChips from "../../../../../modules/news/components/NewsTopicChips";
import type { NewsFilters } from "../../../../../modules/news/types";
import i18n from "../../../../../translate";

describe("NewsTopicChips", () => {
  it("keeps exactly one selection and does not clear or reapply the active topic", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Topics() {
      const [value, setValue] = useState<NewsFilters["topic"]>("all");
      return <NewsTopicChips value={value} onChange={(topic) => {
        setValue(topic);
        onChange(topic);
      }} />;
    }

    render(<Topics />);
    const group = screen.getByRole("group", { name: "Tema" });
    const all = within(group).getByRole("button", { name: "Todos los temas" });
    await user.click(all);
    expect(onChange).not.toHaveBeenCalled();
    expect(all).toHaveAttribute("aria-pressed", "true");

    const ai = within(group).getByRole("button", { name: "IA" });
    await user.click(ai);
    await user.click(ai);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("ai");
    expect(within(group).getAllByRole("button", { pressed: true })).toEqual([ai]);
    expect(all).toHaveAttribute("aria-pressed", "false");
  });

  it("supports native keyboard navigation and activation without moving focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NewsTopicChips value="all" onChange={onChange} />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Todos los temas" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    const technology = screen.getByRole("button", { name: "Tecnología" });
    expect(technology).toHaveFocus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledExactlyOnceWith("technology");
    expect(technology).toHaveFocus();
  });

  it("keeps the selected state while controls are disabled during a request", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = render(<NewsTopicChips value="programming" onChange={onChange} disabled />);
    const programming = screen.getByRole("button", { name: "Programación" });
    expect(programming).toHaveAttribute("aria-pressed", "true");
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    screen.getByRole("button", { name: "IA" }).click();
    expect(onChange).not.toHaveBeenCalled();

    view.rerender(<NewsTopicChips value="programming" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Programación" })).toBe(programming);
    expect(programming).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "IA" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("ai");
  });

  it("uses the existing English labels without changing topic values", async () => {
    await i18n.changeLanguage("en");
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NewsTopicChips value="all" onChange={onChange} />);

    const group = screen.getByRole("group", { name: "Topic" });
    expect(within(group).getByRole("button", { name: "All topics" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(group).getByRole("button", { name: "Programming" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("programming");
  });

  it("returns focus to the activated chip when its request releases the native disabled state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = render(<NewsTopicChips value="all" onChange={onChange} />);
    const ai = screen.getByRole("button", { name: "IA" });
    await user.click(ai);
    expect(ai).toHaveFocus();
    view.rerender(<NewsTopicChips value="ai" onChange={onChange} disabled />);
    // jsdom retains focus on disabled buttons; reproduce Chromium's native blur.
    ai.blur();
    expect(document.body).toHaveFocus();

    view.rerender(<NewsTopicChips value="ai" onChange={onChange} />);
    expect(ai).toHaveFocus();
    expect(onChange).toHaveBeenCalledExactlyOnceWith("ai");
  });

  it.each(["focus", "tab", "pointer"] as const)(
    "does not take focus back after an explicit %s interaction during the request",
    async (intent) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const controls = (disabled = false) => <>
        <NewsTopicChips value={disabled ? "ai" : "all"} onChange={onChange} disabled={disabled} />
        <button>Otra acción</button>
        <p>Otro contenido</p>
      </>;
      const view = render(controls());
      const ai = screen.getByRole("button", { name: "IA" });
      await user.click(ai);
      view.rerender(controls(true));
      ai.blur();
      const other = screen.getByRole("button", { name: "Otra acción" });
      if (intent === "focus") other.focus();
      else if (intent === "tab") await user.tab();
      else await user.click(screen.getByText("Otro contenido"));
      // Also cover the target disappearing/losing focus before the reply arrives.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

      view.rerender(<><NewsTopicChips value="ai" onChange={onChange} /><button>Otra acción</button><p>Otro contenido</p></>);
      expect(document.body).toHaveFocus();
      expect(ai).not.toHaveFocus();
    },
  );

  it("never returns focus for unrelated loading or after the activated chip is unmounted", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = render(<NewsTopicChips value="all" onChange={onChange} />);
    view.rerender(<NewsTopicChips value="all" onChange={onChange} disabled />);
    view.rerender(<NewsTopicChips value="all" onChange={onChange} />);
    expect(document.body).toHaveFocus();

    const ai = screen.getByRole("button", { name: "IA" });
    await user.click(ai);
    view.rerender(<NewsTopicChips value="ai" onChange={onChange} disabled />);
    ai.blur();
    view.unmount();
    render(<button>Destino nuevo</button>);
    const destination = screen.getByRole("button", { name: "Destino nuevo" });
    destination.focus();
    expect(destination).toHaveFocus();
    expect(ai.isConnected).toBe(false);
  });
});
