import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import TranslationInput from "../../../../../src/components/inputs/TranslationInput";

describe("TranslationInput", () => {
  it("renders key input with label and placeholder", () => {
    render(
      <TranslationInput
        label="Identificador"
        value=""
        onChangeKey={vi.fn()}
        translations={{ es: "", en: "" }}
        onChangeTranslations={vi.fn()}
        placeholder="ej: super_admin"
        required
      />
    );

    expect(screen.getByText("Identificador")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ej: super_admin")).toBeInTheDocument();
  });

  it("calls onChangeKey when typing in the key field", async () => {
    const handleChangeKey = vi.fn();
    const user = userEvent.setup();

    render(
      <TranslationInput
        label="Identificador"
        value=""
        onChangeKey={handleChangeKey}
        translations={{ es: "", en: "" }}
        onChangeTranslations={vi.fn()}
        placeholder="ej: super_admin"
      />
    );

    const keyInput = screen.getByPlaceholderText("ej: super_admin");
    await user.type(keyInput, "admin");

    expect(handleChangeKey).toHaveBeenCalled();
  });

  it("renders language translation fields when expanded or value is provided", async () => {
    const handleChangeTranslations = vi.fn();
    const user = userEvent.setup();

    const Wrapper = () => {
      const [translations, setTranslations] = useState({
        es: "Gerente",
        en: "Manager",
      });

      return (
        <TranslationInput
          label="Identificador"
          value="manager"
          onChangeKey={vi.fn()}
          translations={translations}
          onChangeTranslations={(newTrans) => {
            setTranslations(newTrans as { es: string; en: string });
            handleChangeTranslations(newTrans);
          }}
        />
      );
    };

    render(<Wrapper />);

    expect(screen.getByDisplayValue("Gerente")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Manager")).toBeInTheDocument();

    const esInput = screen.getByDisplayValue("Gerente");
    await user.clear(esInput);
    await user.type(esInput, "Director");

    expect(handleChangeTranslations).toHaveBeenLastCalledWith({
      es: "Director",
      en: "Manager",
    });
  });

  it("toggles translations collapse when clicking the toggle button", async () => {
    const user = userEvent.setup();

    render(
      <TranslationInput
        label="Identificador"
        value=""
        onChangeKey={vi.fn()}
        translations={{ es: "", en: "" }}
        onChangeTranslations={vi.fn()}
        defaultExpanded={false}
      />
    );

    const toggleBtn = screen.getByRole("button", {
      name: /toggle translations/i,
    });
    expect(screen.queryByText("Traducciones del Nombre")).not.toBeInTheDocument();

    await user.click(toggleBtn);
    expect(screen.getByText("Traducciones del Nombre")).toBeInTheDocument();
  });
});
