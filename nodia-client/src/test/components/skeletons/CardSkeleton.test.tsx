import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  BusinessCardSkeleton,
  CardsGridSkeleton,
  KpiCardSkeleton,
  KpiCardsGridSkeleton,
  HeaderCardSkeleton,
  SettingsCardSkeleton,
  SettingsCardsGridSkeleton,
} from "../../../components/skeletons";

describe("Card Skeleton Components", () => {
  it("renders BusinessCardSkeleton and CardsGridSkeleton", () => {
    const { unmount } = render(<BusinessCardSkeleton />);
    expect(screen.getByTestId("business-card-skeleton")).toBeInTheDocument();
    unmount();

    render(<CardsGridSkeleton count={3} />);
    expect(screen.getByTestId("cards-grid-skeleton")).toBeInTheDocument();
    expect(screen.getAllByTestId("business-card-skeleton")).toHaveLength(3);
  });

  it("renders KpiCardSkeleton and KpiCardsGridSkeleton", () => {
    const { unmount } = render(<KpiCardSkeleton />);
    expect(screen.getByTestId("kpi-card-skeleton")).toBeInTheDocument();
    unmount();

    render(<KpiCardsGridSkeleton count={3} />);
    expect(screen.getByTestId("kpi-cards-grid-skeleton")).toBeInTheDocument();
    expect(screen.getAllByTestId("kpi-card-skeleton")).toHaveLength(3);
  });

  it("renders HeaderCardSkeleton", () => {
    render(<HeaderCardSkeleton />);
    expect(screen.getByTestId("header-card-skeleton")).toBeInTheDocument();
  });

  it("renders SettingsCardSkeleton and SettingsCardsGridSkeleton", () => {
    const { unmount } = render(<SettingsCardSkeleton />);
    expect(screen.getByTestId("settings-card-skeleton")).toBeInTheDocument();
    unmount();

    render(<SettingsCardsGridSkeleton count={4} />);
    expect(screen.getByTestId("settings-cards-grid-skeleton")).toBeInTheDocument();
    expect(screen.getAllByTestId("settings-card-skeleton")).toHaveLength(4);
  });
});
