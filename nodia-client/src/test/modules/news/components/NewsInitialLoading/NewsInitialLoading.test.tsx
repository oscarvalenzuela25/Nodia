import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NewsInitialLoading from "../../../../../modules/news/components/NewsInitialLoading";

describe("News first request loading", () => {
  it("renders Boneyard bones without article data instead of an empty loading region", () => {
    const { container } = render(<NewsInitialLoading />);
    expect(screen.getByRole("status", { name: "Cargando noticias conservadas" })).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector('[data-boneyard-overlay="true"] [data-boneyard-bone="true"]')).toBeInTheDocument();
    expect(container.querySelector("article,a,button,input")).not.toBeInTheDocument();
  });
});
