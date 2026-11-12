import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActivityCard from "../../../../../modules/teacher/components/AdaptiveWorkspace/ActivityCard";
import VisualCard from "../../../../../modules/teacher/components/AdaptiveWorkspace/VisualCard";
import { activitySchema, visualSchema } from "../../../../../modules/teacher/infrastructure/enrichmentSchemas";

const id = "10000000-0000-4000-8000-000000000001";
describe("unsupported learning occurrences", () => {
  it("keeps the prompt readable, strips untrusted fields and offers no grading action", () => {
    const activity = activitySchema.parse({ id, objective_id: null, prompt: "An old exercise", revision: 1, answered: false, kind: "download_plugin", availability: "unsupported", solution: "private", payload: { javascript: "throw new Error('do not execute')" } });
    const respond = vi.fn();
    render(<ActivityCard activity={activity} disabled={false} respond={respond} />);
    expect(screen.getByText("An old exercise")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("tipo o versión no disponible");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(activity).not.toHaveProperty("solution");
    expect(activity).not.toHaveProperty("payload");
    expect(respond).not.toHaveBeenCalled();
  });
  it("preserves an unavailable visual title without loading or executing its payload", () => {
    const visual = visualSchema.parse({ id, kind: "html", title: "Historical figure", availability: "unsupported", payload: { url: "https://example.test/unsafe" } });
    render(<VisualCard visual={visual} />);
    expect(screen.getByText("Historical figure")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("tipo o versión no disponible");
    expect(document.querySelector("iframe,script,img")).toBeNull();
    expect(visual).not.toHaveProperty("payload");
  });
  it("rejects malformed supported visuals and never silently converts them into valid data", () => {
    expect(visualSchema.safeParse({ id, kind: "bar_chart", title: "Invalid", labels: ["one", "two"], values: [1] }).success).toBe(false);
    expect(visualSchema.safeParse({ id, kind: "bar_chart", title: "Invalid", labels: ["one"], values: [Infinity] }).success).toBe(false);
    expect(activitySchema.safeParse({ id, kind: "download_plugin", prompt: "Invalid", objective_id: null, revision: 1, answered: false }).success).toBe(false);
  });
  it("retains legacy version-one visuals and exposes their exact zero as text", () => {
    render(<VisualCard visual={visualSchema.parse({ id, kind: "timeline", title: "Events", labels: ["First"], values: [0] })} />);
    expect(screen.getByRole("list").tagName).toBe("OL");
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
