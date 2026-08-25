import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LanguageSelector from "../../../../../src/layouts/components/LanguageSelector/LanguageSelector";

const changeLanguageMock = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const texts: Record<string, string> = {
        "layout:toggle_language": "Cambiar idioma",
        "translate:es": "español",
        "translate:en": "inglés",
      };
      return texts[key] || key;
    },
    i18n: {
      language: "es",
      changeLanguage: changeLanguageMock,
    },
  }),
}));

describe("LanguageSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the translate icon button", () => {
    render(<LanguageSelector />);
    const button = screen.getByLabelText("Cambiar idioma");
    expect(button).toBeInTheDocument();
  });

  it("should open menu and show languages on click", async () => {
    const user = userEvent.setup();
    render(<LanguageSelector />);
    
    const button = screen.getByLabelText("Cambiar idioma");
    await user.click(button);

    const esOption = await screen.findByText("español");
    const enOption = await screen.findByText("inglés");
    
    expect(esOption).toBeVisible();
    expect(enOption).toBeVisible();
  });

  it("should call changeLanguage when a language is selected", async () => {
    const user = userEvent.setup();
    render(<LanguageSelector />);
    
    const button = screen.getByLabelText("Cambiar idioma");
    await user.click(button);

    const enOption = await screen.findByText("inglés");
    await user.click(enOption);

    expect(changeLanguageMock).toHaveBeenCalledWith("en");
  });
});
