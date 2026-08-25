import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import Home from "../../../../../modules/home/pages/Home";
import MUIProvider from "../../../../../providers/MUIProvider";

describe("Home", () => {
  it("renders the welcome message and general settings", () => {
    render(
      <MemoryRouter>
        <MUIProvider>
          <Home />
        </MUIProvider>
      </MemoryRouter>
    );
    
    // Assuming i18n is mocked to return the keys if not initialized.
    expect(
      screen.getByRole("heading", { name: /bienvenido a nodia|welcome to nodia|home:welcome/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /ajustes generales|general settings|home:general_settings/i })
    ).toBeInTheDocument();
  });
});
