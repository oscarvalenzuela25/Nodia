import type spanish from "../../../translate/es/teacher_offline_reader.json";
import {
  discardOfflineReadingIntent, queueOfflineReadingPoint, readOfflineReadingProgress, resolveOfflineReadingConflict,
  type OfflineReadingIntent, type OfflineReadingPoint, type OfflineStudyCopy,
} from "../infrastructure/offlineStudy";

type Copy = typeof spanish.progress;

function button(label: string, action: () => void) {
  const control = document.createElement("button");
  control.type = "button";
  control.textContent = label;
  control.onclick = () => {
    if (control.getAttribute("aria-disabled") !== "true") action();
  };
  return control;
}

function pointDescription(parent: HTMLElement, label: string) {
  const pair = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  pair.append(term, description);
  parent.append(pair);
  return description;
}

function setDisabled(control: HTMLButtonElement, disabled: boolean) {
  control.setAttribute("aria-disabled", String(disabled));
}

export function createReadingProgressView(copy: OfflineStudyCopy, text: Copy, syncReading: () => Promise<void>) {
  const container = document.createElement("div");
  container.className = "reading-progress";
  container.dataset.state = "empty";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.tabIndex = -1;
  const error = document.createElement("p");
  error.setAttribute("role", "alert");
  const details = document.createElement("dl");
  details.className = "reading-choices";
  details.hidden = true;
  const localTitle = pointDescription(details, text.thisDevice);
  const remoteTitle = pointDescription(details, text.server);
  const actions = document.createElement("div");
  actions.className = "actions";
  container.append(status, error, details, actions);

  const headings = new Map<string, HTMLHeadingElement>();
  const controls = new Map<string, { control: HTMLButtonElement; marker: HTMLElement }>();
  let currentIntent: OfflineReadingIntent | null = null;
  let currentBlock: string | undefined;
  let working = false;
  let sequence = 0;

  const sameCopy = (point: OfflineReadingPoint | null | undefined) => Boolean(point &&
    point.unitId === copy.unitId && point.contentVersionId === copy.contentVersionId);
  const blockTitle = (point: OfflineReadingPoint | null | undefined) =>
    (point && sameCopy(point) ? headings.get(point.blockId)?.textContent : null) ?? text.anotherSection;

  function focusHeading(target: HTMLHeadingElement | undefined) {
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start" });
  }

  const resume = button(text.resume, () => focusHeading(currentBlock ? headings.get(currentBlock) : undefined));
  const pending = document.createElement("a");
  pending.textContent = text.openPending;
  const useLocal = button(text.useLocal, () => void resolve("local"));
  useLocal.className = "button-primary";
  const keepServer = button(text.useServer, () => void resolve("server"));
  const sync = button(text.sync, () => void perform(syncReading));
  sync.className = "button-primary";
  const discard = button(text.discard, () => {
    const intent = currentIntent;
    if (intent) void perform(async () => { await discardOfflineReadingIntent(copy.studyId, intent.requestKey); });
  });
  discard.className = "button-quiet";
  actions.append(pending, useLocal, keepServer, sync, resume, discard);
  actions.hidden = true;
  for (const action of actions.children) (action as HTMLElement).hidden = true;

  async function resolve(choice: "local" | "server") {
    const intent = currentIntent;
    const remote = intent?.serverCursor;
    if (!intent || !remote || (choice === "local" && navigator.onLine === false)) return;
    await perform(async () => {
      if (await resolveOfflineReadingConflict(copy.studyId, intent.requestKey, choice, remote) && choice === "local") {
        await syncReading();
      }
    });
  }

  function updateDisabled() {
    const offline = navigator.onLine === false;
    for (const [blockId, { control }] of controls) {
      setDisabled(control, working || blockId === currentBlock || (currentIntent !== null && currentIntent.state !== "pending"));
    }
    setDisabled(useLocal, working || offline);
    setDisabled(keepServer, working);
    setDisabled(sync, working || offline);
    setDisabled(discard, working);
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
    const focused = document.activeElement;
    const intent = state.intent;
    currentIntent = intent;
    const here = intent?.copyId === copy.id && sameCopy(intent.point);
    const elsewhere = Boolean(intent && !here);
    const confirmed = state.confirmed && state.confirmed.revision >= (copy.readingContext?.cursorRevision ?? 0)
      ? state.confirmed : null;
    const authoritativePoint = confirmed
      ? (sameCopy(confirmed.point) ? confirmed.point?.blockId : undefined)
      : copy.readingContext?.savedBlockId;
    const matchingBlock = here ? intent?.point.blockId : authoritativePoint;
    currentBlock = matchingBlock && headings.has(matchingBlock) ? matchingBlock : undefined;
    const conflict = Boolean(here && intent?.state === "conflict" && intent.serverCursor);
    const canSync = Boolean(here && (intent?.state === "pending" || intent?.state === "uncertain"));

    let summary = "";
    if (elsewhere) summary = text.pendingElsewhere;
    else if (conflict) summary = text.conflict;
    else if (intent?.state === "rejected") summary = intent.issue === "stale" ? text.outdated : text.unavailable;
    else if (intent?.state === "pending") summary = text.pending;
    else if (intent?.state === "uncertain") summary = text.uncertain;
    else if (currentBlock) summary = confirmed ? text.synced : text.saved;

    if (status.textContent !== summary) status.textContent = summary;
    container.dataset.state = elsewhere ? "pending" : intent?.state ?? (currentBlock ? "saved" : "empty");
    details.hidden = !conflict;
    if (conflict && intent?.serverCursor) {
      localTitle.textContent = blockTitle(intent.point);
      remoteTitle.textContent = blockTitle(intent.serverCursor.point);
    }
    if (elsewhere && intent) pending.href = `#${encodeURIComponent(intent.copyId)}`;
    pending.hidden = !elsewhere;
    useLocal.hidden = !conflict;
    keepServer.hidden = !conflict;
    sync.hidden = !canSync;
    resume.hidden = !currentBlock;
    discard.hidden = !here || conflict || intent?.state === "uncertain";
    actions.hidden = [...actions.children].every(action => (action as HTMLElement).hidden);

    for (const [blockId, { control, marker }] of controls) {
      const marked = blockId === currentBlock;
      control.setAttribute("aria-pressed", String(marked));
      marker.hidden = !marked;
      marker.textContent = here ? text.markedLocal : text.marked;
    }
    updateDisabled();
    if (focused instanceof HTMLElement && actions.contains(focused) && focused.hidden) {
      if (summary) status.focus();
      else headings.values().next().value?.focus();
    }
  }

  async function perform(run: () => Promise<void>) {
    if (working) return;
    working = true;
    container.setAttribute("aria-busy", "true");
    updateDisabled();
    error.textContent = "";
    try { await run(); }
    catch { if (container.isConnected) error.textContent = text.failed; }
    finally {
      working = false;
      container.removeAttribute("aria-busy");
      updateDisabled();
      await refresh();
    }
  }

  function registerBlock(blockId: string, heading: HTMLHeadingElement, canSave: boolean) {
    heading.tabIndex = -1;
    headings.set(blockId, heading);
    if (!canSave) return;
    const control = button(text.save, () => void perform(async () => {
      await queueOfflineReadingPoint(copy.id, blockId);
      await refresh();
      if (navigator.onLine !== false) await syncReading();
    }));
    control.className = "reading-point";
    control.setAttribute("aria-label", `${text.save} · ${heading.textContent}`);
    setDisabled(control, true);
    const marker = document.createElement("span");
    marker.className = "reading-marker";
    marker.hidden = true;
    const footer = document.createElement("div");
    footer.className = "reading-block-actions";
    footer.append(control, marker);
    controls.set(blockId, { control, marker });
    return footer;
  }

  return { container, registerBlock, refresh };
}
