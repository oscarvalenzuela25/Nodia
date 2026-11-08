import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import TextInput from "../../../../../src/components/inputs/TextInput";

describe("TextInput", () => {
  it("uses one padding owner for multiline while preserving single-line and trailing controls", () => {
    render(<>
      <TextInput label="Objetivo" value={"Primera línea\nSegunda línea"} onChange={vi.fn()} multiline minRows={2} endAdornment={<button>Ayuda multiline</button>} />
      <TextInput label="Título" value="Texto breve" onChange={vi.fn()} endAdornment={<button>Ayuda simple</button>} />
    </>);
    const multiline = screen.getByRole("textbox", { name: "Objetivo" });
    const multilineRoot = multiline.closest(".MuiOutlinedInput-root")!;
    expect(multiline.tagName).toBe("TEXTAREA");
    expect(multiline).toHaveValue("Primera línea\nSegunda línea");
    expect(getComputedStyle(multiline).padding).toBe("0px");
    expect(getComputedStyle(multilineRoot).paddingLeft).not.toBe("0px");
    expect(getComputedStyle(multilineRoot).paddingTop).not.toBe("0px");
    expect(getComputedStyle(screen.getByRole("textbox", { name: "Título" })).padding).toBe("10px 14px");
    expect(screen.getByRole("button", { name: "Ayuda multiline" }).closest(".MuiOutlinedInput-root")).toBe(multilineRoot);
    expect(screen.getByRole("button", { name: "Ayuda simple" })).toBeInTheDocument();
  });

  it("forwards a decimal keyboard hint while preserving comma text for application validation", () => {
    render(<TextInput label="Cantidad" inputMode="decimal" value="1,125" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Cantidad" })).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByRole("textbox", { name: "Cantidad" })).toHaveValue("1,125");
  });
  it("keeps a label action separate from the associated input label", async () => {
    const help = vi.fn();
    render(<TextInput label="Producto" labelAdornment={<button type="button" onClick={help}>Ayuda del campo</button>} value="dato" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Producto")).toHaveValue("dato");
    await userEvent.setup().click(screen.getByRole("button", { name: "Ayuda del campo" }));
    expect(help).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Ayuda del campo" }).closest("label")).toBeNull();
  });
  it("renders a trailing control and links an external description without replacing its label", () => {
    render(<><TextInput label="Texto" value="dato" onChange={vi.fn()} aria-describedby="text-help" endAdornment={<button>Mostrar</button>} /><p id="text-help">Ayuda externa</p></>);
    expect(screen.getByLabelText("Texto")).toHaveAccessibleDescription("Ayuda externa");
    expect(screen.getByRole("button", { name: "Mostrar" })).toBeInTheDocument();
  });
  it("renders label, placeholder, value and handles input", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TextInput
        label="Email"
        required
        value=""
        onChange={handleChange}
        placeholder="user@example.com"
      />
    );

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("user@example.com");
    await user.type(input, "a");

    expect(handleChange).toHaveBeenCalled();
  });
});
