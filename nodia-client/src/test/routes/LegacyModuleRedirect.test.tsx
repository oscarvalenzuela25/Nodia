import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import LegacyModuleRedirect from "../../routes/LegacyModuleRedirect";
import { LEGACY_MODULE_DESTINATIONS } from "../../routes/moduleDestinations";

describe("legacy navigation redirects", () => {
  it.each(Object.entries(LEGACY_MODULE_DESTINATIONS))("redirects %s to the canonical guarded identity", async (source, destination) => {
    const router = createMemoryRouter([
      { path: source, element: <LegacyModuleRedirect destination={destination} /> },
      { path: destination, element: <p>Canonical resource</p> },
    ], { initialEntries: [`${source}?context=original#saved`] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText("Canonical resource")).toBeVisible();
    expect(router.state.location).toMatchObject({ pathname: destination, search: "?context=original", hash: "#saved" });
    expect(router.state.historyAction).toBe("REPLACE");
    router.dispose();
  });

  it("preserves the resource detail ID and reaches only its canonical guard", async () => {
    const router = createMemoryRouter([
      { path: "/tools/business/:id", element: <LegacyModuleRedirect destination="/business" /> },
      { path: "/business/:id", element: <p>Canonical authority barrier</p> },
    ], { initialEntries: ["/tools/business/verified-id?tab=products"] });
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(router.state.location.pathname).toBe("/business/verified-id"));
    expect(await screen.findByText("Canonical authority barrier")).toBeVisible();
    expect(router.state.location.search).toBe("?tab=products");
    router.dispose();
  });
});
