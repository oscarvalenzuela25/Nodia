import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Home from "../../../../../modules/home/pages/Home";

describe("Home", () => {
  it("increments the counter", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(
      screen.getByRole("button", { name: "El contador es 0" })
    );

    expect(
      screen.getByRole("button", { name: "El contador es 1" })
    ).toBeInTheDocument();
  });

  it("exposes and updates the selected language", async () => {
    const user = userEvent.setup();
    render(<Home />);
    const englishButton = screen.getByRole("button", { name: "inglés" });

    expect(englishButton).toHaveAttribute("aria-pressed", "false");
    await user.click(englishButton);

    await waitFor(() => {
      expect(englishButton).toHaveAttribute("aria-pressed", "true");
    });
  });
});
