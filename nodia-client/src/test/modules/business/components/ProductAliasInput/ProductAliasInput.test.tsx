import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProductAliasInput from "../../../../../modules/business/components/ProductAliasInput";

describe("ProductAliasInput", () => {
  it("allows replacing the name with a custom alias, selecting the name again and handles blanks without an implicit write", () => {
    const changed = vi.fn();
    function Fixture() {
      const [value, setValue] = useState<string | null>(null);
      const [useName, setUseName] = useState(true);
      return <ProductAliasInput name="Original" value={value} useName={useName} onChange={next => { changed(next); setValue(next); }} onUseNameChange={setUseName} />;
    }
    render(<Fixture />);
    const input = screen.getByRole("textbox", { name: "Alias comercial" });
    const checkbox = screen.getByRole("checkbox", { name: "Usar el nombre del producto" });
    expect(input).toHaveValue("Original"); expect(checkbox).toBeChecked(); expect(changed).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Custom alias" } });
    expect(input).toHaveValue("Custom alias"); expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(input).toHaveValue("Original"); expect(checkbox).toBeChecked();
    fireEvent.change(input, { target: { value: "   " } });
    expect(checkbox).toBeChecked(); expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: "Original" } });
    expect(checkbox).not.toBeChecked();
  });
});
