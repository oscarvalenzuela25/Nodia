import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PersonalNewsPanel from "../../../../../modules/news/components/PersonalNews/PersonalNewsPanel";

describe("Personal News disclosure", () => {
  it("keeps headings and independent panels expandable by keyboard without discarding controls", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PersonalNewsPanel title="Tus fuentes"><p>DEV Community</p></PersonalNewsPanel>
        <PersonalNewsPanel title="Tu lectura"><input aria-label="Fuente" /></PersonalNewsPanel>
      </>,
    );

    const sources = within(screen.getByRole("heading", { name: "Tus fuentes", level: 2 })).getByRole("button");
    const reading = within(screen.getByRole("heading", { name: "Tu lectura", level: 2 })).getByRole("button");
    const filter = screen.getByRole("textbox", { name: "Fuente" });
    expect(sources).toHaveAttribute("aria-expanded", "true");
    expect(reading).toHaveAttribute("aria-expanded", "true");
    await user.type(filter, "DEV");

    reading.focus();
    await user.keyboard("{Enter}");
    expect(reading).toHaveAttribute("aria-expanded", "false");
    expect(filter).not.toBeVisible();
    expect(screen.getByText("DEV Community")).toBeVisible();

    await user.click(sources);
    expect(sources).toHaveAttribute("aria-expanded", "false");
    expect(reading).toHaveAttribute("aria-expanded", "false");
    reading.focus();
    await user.keyboard(" ");
    expect(reading).toHaveAttribute("aria-expanded", "true");
    expect(sources).toHaveAttribute("aria-expanded", "false");
    expect(filter).toBeVisible();
    expect(filter).toHaveValue("DEV");
  });
});
