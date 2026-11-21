import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OfflineLessonDownload from "../../../../../modules/teacher/components/OfflineLessonDownload";
import { downloadLesson } from "../../../../../modules/teacher/infrastructure/downloadLesson";
import { makeOfflineStudyCopy, openOfflineStudy } from "../../../../../modules/teacher/infrastructure/offlineStudy";
import { notifyOfflineStudyChange } from "../../../../../modules/teacher/infrastructure/offlineStudyIdentity";
import useAuthStore from "../../../../../store/authStore";

vi.mock("../../../../../modules/teacher/infrastructure/downloadLesson", () => ({ downloadLesson: vi.fn() }));
vi.mock("../../../../../modules/teacher/infrastructure/offlineStudy", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../../../modules/teacher/infrastructure/offlineStudy")>(),
  openOfflineStudy: vi.fn(),
}));

const firstSession = "10000000-0000-4000-8000-000000000001";
const secondSession = "10000000-0000-4000-8000-000000000002";
const lesson = {
  studyId: "20000000-0000-4000-8000-000000000001",
  unitId: "20000000-0000-4000-8000-000000000002",
  planRevisionId: "20000000-0000-4000-8000-000000000003",
  contentVersionId: "20000000-0000-4000-8000-000000000004",
  title: "Lección de prueba",
  readingContext: { cursorRevision: 1, sectionId: "20000000-0000-4000-8000-000000000005" },
};
const copy = (override = {}) => makeOfflineStudyCopy({
  ...lesson, blocks: [{ id: "example", title: "Ejemplo de prueba", body_markdown: "Contenido de prueba." }], ...override,
}, Date.now());
const openLabel = "Abrir copia descargada";
const downloadLabel = "Descargar para leer sin conexión";
const updateLabel = "Actualizar copia descargada";
const view = () => <OfflineLessonDownload {...lesson} disabled={false} />;

function login(sid: string, userId = "44") {
  const claims = btoa(JSON.stringify({ sub: userId, sid, token_use: "access" })).replace(/=+$/, "");
  useAuthStore.getState().login({ token: `e30.${claims}.test`, user: { id: userId, name: "Prueba" }, expiresAt: Date.now() + 60_000 });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(openOfflineStudy).mockResolvedValue(null);
  login(firstSession);
});

describe("Teacher download action", () => {
  it("recovers the current copy on remount and drops the action after a deletion", async () => {
    const saved = copy();
    vi.mocked(openOfflineStudy).mockResolvedValue(saved);
    const firstView = render(view());
    expect(await screen.findByRole("link", { name: openLabel })).toHaveAttribute("href", `/nodia-teacher/downloads#${encodeURIComponent(saved.id)}`);
    expect(screen.queryByRole("button", { name: downloadLabel })).not.toBeInTheDocument();
    firstView.unmount();
    render(view());
    expect(await screen.findByRole("link", { name: openLabel })).toBeInTheDocument();
    expect(downloadLesson).not.toHaveBeenCalled();

    vi.mocked(openOfflineStudy).mockResolvedValue(null);
    await act(async () => { notifyOfflineStudyChange(); });
    expect(screen.queryByRole("link", { name: openLabel })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: downloadLabel })).toBeEnabled();
  });

  it("offers an update for older material and moves focus to the verified copy after download", async () => {
    vi.mocked(openOfflineStudy).mockResolvedValue(copy({ contentVersionId: "20000000-0000-4000-8000-000000000006" }));
    render(view());
    const update = await screen.findByRole("button", { name: updateLabel });
    expect(screen.queryByRole("link", { name: openLabel })).not.toBeInTheDocument();
    const saved = copy();
    vi.mocked(downloadLesson).mockImplementation(async () => {
      vi.mocked(openOfflineStudy).mockResolvedValue(saved);
      notifyOfflineStudyChange();
      return saved;
    });
    await userEvent.click(update);
    expect(await screen.findByRole("link", { name: openLabel })).toHaveFocus();
    expect(downloadLesson).toHaveBeenCalledExactlyOnceWith(lesson, expect.any(AbortSignal));
  });

  it("ignores a late copy from a previous session of the same account", async () => {
    let complete!: (value: ReturnType<typeof copy>) => void;
    vi.mocked(openOfflineStudy).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    render(view());
    expect(screen.getByRole("button", { name: downloadLabel })).toBeDisabled();
    await act(async () => { login(secondSession); });
    await act(async () => { complete(copy()); });

    expect(screen.queryByRole("link", { name: openLabel })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: downloadLabel })).toBeEnabled();
  });

  it("removes the open action when the copy expires while Teacher remains open", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(openOfflineStudy).mockResolvedValue({ ...copy(), expiresAt: Date.now() + 60 });
      await act(async () => { render(view()); });
      expect(screen.getByRole("link", { name: openLabel })).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(60); });
      expect(screen.queryByRole("link", { name: openLabel })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: downloadLabel })).toBeEnabled();
    } finally { vi.useRealTimers(); }
  });
});
