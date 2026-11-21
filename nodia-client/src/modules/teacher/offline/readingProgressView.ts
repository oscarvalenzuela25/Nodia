import type spanish from "../../../translate/es/teacher_offline_reader.json";
import {
  discardOfflineReadingIntent, queueOfflineReadingPoint, readOfflineReadingProgress, resolveOfflineReadingConflict,
  type OfflineReadingPoint, type OfflineStudyCopy,
} from "../infrastructure/offlineStudy";

type Copy = typeof spanish.progress;

function button(label: string, action: (control: HTMLButtonElement) => void) {
  const control = document.createElement("button");
  control.type = "button";
  control.textContent = label;
  control.onclick = () => action(control);
  return control;
}

export function createReadingProgressView(copy: OfflineStudyCopy, text: Copy, syncReading: () => Promise<void>) {
  const container = document.createElement("div");
  container.className = "reading-progress";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const error = document.createElement("p");
  error.setAttribute("role", "alert");
  const details = document.createElement("div");
  const actions = document.createElement("div");
  actions.className = "actions";
  container.append(status, error, details, actions);

  const controls = new Map<string, HTMLButtonElement>();
  let working = false;
  let sequence = 0;

  const sameCopy = (point: OfflineReadingPoint | null | undefined) => Boolean(point &&
    point.unitId === copy.unitId && point.contentVersionId === copy.contentVersionId);
  const blockTitle = (point: OfflineReadingPoint | null | undefined) =>
    sameCopy(point) ? copy.blocks.find(block => block.id === point?.blockId)?.title ?? text.anotherSection : text.anotherSection;

  function actionLabel(label: string, value: string) {
    const line = document.createElement("p");
    line.textContent = `${label} ${value}`;
    return line;
  }

  async function refresh() {
    const turn = ++sequence;
    let state;
    try { state = await readOfflineReadingProgress(copy.studyId); }
    catch {
      if (container.isConnected && turn === sequence) error.textContent = text.failed;
      return;
    }
    if (!container.isConnected || turn !== sequence) return;
    const intent = state.intent;
    const here = intent?.copyId === copy.id && sameCopy(intent.point);
    const confirmed = state.confirmed && state.confirmed.revision >= (copy.readingContext?.cursorRevision ?? 0)
      ? state.confirmed : null;
    const authoritativePoint = confirmed
      ? (sameCopy(confirmed.point) ? confirmed.point?.blockId : null)
      : copy.readingContext?.savedBlockId;
    const localPoint = here ? intent?.point.blockId : authoritativePoint;
    for (const [blockId, control] of controls) {
      control.setAttribute("aria-pressed", String(blockId === localPoint));
      control.disabled = working || blockId === localPoint || (intent !== null && intent.state !== "pending");
    }
    details.replaceChildren();
    actions.replaceChildren();
    const online = navigator.onLine !== false;
    if (!intent) {
      status.textContent = confirmed && sameCopy(confirmed.point) ? text.synced : "";
      return;
    }
    if (!here) {
      status.textContent = text.pendingElsewhere;
      const pending = document.createElement("a");
      pending.href = `#${encodeURIComponent(intent.copyId)}`;
      pending.textContent = text.openPending;
      actions.append(pending);
      return;
    }

    if (intent.state === "conflict" && intent.serverCursor) {
      status.textContent = text.conflict;
      details.append(actionLabel(text.thisDevice, blockTitle(intent.point)),
        actionLabel(text.server, blockTitle(intent.serverCursor.point)));
      const remote = intent.serverCursor;
      const local = button(text.useLocal, (control) => void perform(control, async () => {
        await resolveOfflineReadingConflict(copy.studyId, intent.requestKey, "local", remote);
        await syncReading();
      }));
      local.disabled = working || !online;
      const keep = button(text.useServer, (control) => void perform(control, async () => {
        await resolveOfflineReadingConflict(copy.studyId, intent.requestKey, "server", remote);
      }));
      keep.disabled = working;
      actions.append(local, keep);
      return;
    }
    if (intent.state === "rejected") {
      status.textContent = intent.issue === "stale" ? text.outdated : text.unavailable;
    } else {
      status.textContent = intent.state === "pending" ? text.pending : text.uncertain;
      const sync = button(text.sync, (control) => void perform(control, syncReading));
      sync.disabled = working || !online;
      actions.append(sync);
    }
    if (intent.state !== "uncertain") {
      const discard = button(text.discard, (control) => void perform(control, async () => {
        await discardOfflineReadingIntent(copy.studyId, intent.requestKey);
      }));
      discard.disabled = working;
      actions.append(discard);
    }
  }

  async function perform(control: HTMLButtonElement, run: () => Promise<void>) {
    if (working) return;
    working = true;
    container.setAttribute("aria-busy", "true");
    control.disabled = true;
    error.textContent = "";
    try { await run(); }
    catch { if (container.isConnected) error.textContent = text.failed; }
    finally {
      working = false;
      container.removeAttribute("aria-busy");
      await refresh();
    }
  }

  function saveButton(blockId: string, title: string) {
    const control = button(text.save, (pressed) => void perform(pressed, async () => {
      await queueOfflineReadingPoint(copy.id, blockId);
      if (navigator.onLine !== false) {
        await refresh();
        await syncReading();
      }
    }));
    control.className = "reading-point";
    control.setAttribute("aria-label", `${text.save} · ${title}`);
    control.disabled = true;
    controls.set(blockId, control);
    return control;
  }
  return { container, saveButton, refresh };
}
