import { lazy, useState, type ComponentType } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link } from "react-router";
import { RouterProvider } from "react-router/dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { afterEach, describe, expect, it, vi } from "vitest";
import RouteContent from "../../routes/RouteContent";
import RouteError from "../../modules/core/pages/RouteError";
import i18n from "../../translate";

afterEach(() => vi.restoreAllMocks());

describe("RouteContent", () => {
  it.each(["page", "fullscreen"] as const)("shows loading on a direct %s route until its import resolves", async (variant) => {
    await i18n.changeLanguage("en");
    let resolve!: (value: { default: ComponentType }) => void;
    const Page = lazy(() => new Promise<{ default: ComponentType }>((complete) => { resolve = complete; }));
    const router = createMemoryRouter([{ path: "/page", element: <RouteContent variant={variant}><Page /></RouteContent> }], { initialEntries: ["/page"] });
    render(<ThemeProvider theme={createTheme({ palette: { mode: "dark" } })}><RouterProvider router={router} /></ThemeProvider>);
    expect(await screen.findByRole("status", { name: "Loading page..." })).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Loading page..." })).toBeVisible();
    await act(async () => { resolve({ default: () => <h1>Loaded page</h1> }); });
    expect(await screen.findByRole("heading", { name: "Loaded page" })).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    router.dispose();
  });

  it("preserves a draft on query and hash navigation within the same page", async () => {
    const user = userEvent.setup();
    function DraftPage() {
      const [draft, setDraft] = useState("");
      return <><label>Draft<input value={draft} onChange={event => setDraft(event.target.value)} /></label><Link to="/page?tab=details#notes">Open details</Link></>;
    }
    const router = createMemoryRouter([{ path: "/page", element: <RouteContent><DraftPage /></RouteContent> }], { initialEntries: ["/page"] });
    render(<RouterProvider router={router} />);
    await user.type(screen.getByRole("textbox", { name: "Draft" }), "Keep my draft");
    await user.tab();
    expect(screen.getByRole("link", { name: "Open details" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("Keep my draft");
    expect(router.state.location.search).toBe("?tab=details");
    expect(router.state.location.hash).toBe("#notes");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    router.dispose();
  });

  it("replaces the loader with the existing recoverable error screen when an import fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let reject!: (reason: Error) => void;
    const Page = lazy(() => new Promise<{ default: ComponentType }>((_complete, fail) => { reject = fail; }));
    const router = createMemoryRouter([{ path: "/page", element: <RouteContent><Page /></RouteContent>, errorElement: <RouteError /> }], { initialEntries: ["/page"] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("status")).toBeVisible();
    await act(async () => { reject(new Error("Synthetic module failure")); });
    expect(await screen.findByRole("heading", { name: "Algo salio mal" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic module failure")).not.toBeInTheDocument();
    router.dispose();
  });
});
