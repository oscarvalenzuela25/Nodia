import "./reader.css";
import english from "../../../translate/en/teacher_offline_reader.json";
import spanish from "../../../translate/es/teacher_offline_reader.json";
import { TEACHER_DOWNLOADS_ROUTE } from "../constants/routes";
import {
  clearOfflineStudyGrant, listOfflineStudy, openOfflineStudy, readOfflineStudyAccount,
  removeOfflineStudy, subscribeOfflineStudyChanges, type OfflineStudyCopy, type OfflineStudySummary,
} from "../infrastructure/offlineStudy";
import { offlineStudyGrantSnapshot, sameOfflineStudyScope, type OfflineStudyScope } from "../infrastructure/offlineStudyIdentity";
import { hasUnexpiredAccessToken, requestOfflineTeacher } from "../infrastructure/offlineTeacherTransport";
import { syncOfflineReadingProgress } from "../infrastructure/syncOfflineReading";
import { createReadingProgressView } from "./readingProgressView";

function getLanguage(): "en" | "es" {
  try {
    const code = localStorage.getItem("app_language") ?? navigator.language;
    return /^en(?:-|$)/i.test(code) ? "en" : "es";
  } catch {
    return "es";
  }
}

const language = getLanguage();
const text = language === "en" ? english : spanish;
const checking = document.querySelector<HTMLParagraphElement>("#checking")!;
const message = document.querySelector<HTMLParagraphElement>("#message")!;
const failure = document.querySelector<HTMLParagraphElement>("#failure")!;
const list = document.querySelector<HTMLUListElement>("#downloads")!;
const lesson = document.querySelector<HTMLElement>("#lesson")!;
const heading = document.querySelector<HTMLHeadingElement>("#page-title")!;
const retry = document.querySelector<HTMLButtonElement>("#retry")!;
const network = document.querySelector<HTMLSpanElement>("#network-state")!;
document.documentElement.lang = language;
document.title = `${text.title} · Nodia`;
document.querySelector<HTMLAnchorElement>("#teacher-home")!.textContent = text.home;
heading.textContent = text.title;
retry.textContent = text.retry;
network.textContent = text.offline;

const format = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });
let active: AbortController | undefined;
let expiry: number | undefined;
let reading: ReturnType<typeof createReadingProgressView> | undefined;
let shown: { scope: OfflineStudyScope; grant: string | null; id?: string; key: string } | undefined;
let previousFocus: HTMLElement | undefined;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, content?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  return node;
}

function showNotices(content = "", error = "", canRetry = false) {
  checking.hidden = true;
  message.textContent = content;
  failure.textContent = error;
  retry.hidden = !canRetry;
}

function hideContentForCheck() {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && (list.contains(focused) || lesson.contains(focused))) previousFocus = focused;
  for (const panel of [list, lesson]) {
    panel.inert = true;
    panel.classList.add("is-checking");
  }
}

function showContent() {
  for (const panel of [list, lesson]) {
    panel.inert = false;
    panel.classList.remove("is-checking");
  }
}

function discardContent() {
  for (const panel of [list, lesson]) {
    panel.hidden = true;
    panel.replaceChildren();
  }
  showContent();
  reading = undefined;
  shown = undefined;
  previousFocus = undefined;
}

function clearView(): void {
  active?.abort();
  window.clearTimeout(expiry);
  discardContent();
  showNotices();
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
}

function selectedCopy(): string | undefined {
  try { return decodeURIComponent(location.hash.slice(1)) || undefined; }
  catch { return location.hash; }
}

function link(label: string, href: string): HTMLAnchorElement {
  const anchor = element("a", label);
  anchor.href = href;
  return anchor;
}

function expiryMessage(copy: OfflineStudySummary): HTMLParagraphElement {
  const expiryDate = element("time", format.format(copy.expiresAt));
  expiryDate.dateTime = new Date(copy.expiresAt).toISOString();
  const row = element("p");
  row.className = "expires";
  row.append(`${text.expires} `, expiryDate);
  return row;
}

function showCopy(copy: OfflineStudyCopy, newer: boolean, renderMarkdown: typeof import("./markdown").renderReadingMarkdown): void {
  const title = element("h2", copy.title);
  title.id = "lesson-title";
  title.tabIndex = -1;
  const top = element("header");
  top.className = "lesson-header";
  const back = link(text.library, TEACHER_DOWNLOADS_ROUTE);
  back.className = "back-link library-link";
  const label = element("span", text.copy);
  label.className = "copy-label";
  const actions = element("div");
  actions.className = "lesson-meta";
  const remove = element("button", text.delete);
  remove.type = "button";
  remove.className = "button-quiet";
  remove.onclick = async () => {
    remove.disabled = true;
    try {
      await removeOfflineStudy(copy.id);
      if (!remove.isConnected) return;
      history.replaceState(null, "", TEACHER_DOWNLOADS_ROUTE);
      await render({ success: text.deleted, focusHeading: true });
    } catch {
      if (remove.isConnected) {
        failure.textContent = text.delete_failed;
        remove.disabled = false;
      }
    }
  };
  actions.append(expiryMessage(copy), remove);
  top.append(back, label, title, actions);
  lesson.append(top);
  if (newer) {
    const update = element("p", text.newer);
    update.className = "material-update";
    lesson.append(update);
  }
  reading = createReadingProgressView(copy, text.progress, syncReading);
  lesson.append(reading.container);
  for (const block of copy.blocks) {
    const section = element("section");
    section.className = "reading-block";
    const blockHeading = element("h3", block.title);
    const body = element("div");
    body.className = "block-body";
    body.append(renderMarkdown(block.body_markdown));
    section.append(blockHeading, body);
    const controls = reading.registerBlock(block.id, blockHeading, Boolean(copy.readingContext && !newer));
    if (controls) section.append(controls);
    lesson.append(section);
  }
  lesson.hidden = false;
}

async function syncReading() {
  const before = offlineStudyGrantSnapshot().raw;
  await syncOfflineReadingProgress();
  if (before !== offlineStudyGrantSnapshot().raw) await render();
  else await reading?.refresh();
}

async function render({ success = "", focusHeading = false } = {}): Promise<void> {
  active?.abort();
  window.clearTimeout(expiry);
  const attempt = new AbortController();
  active = attempt;
  const account = readOfflineStudyAccount();
  const grant = offlineStudyGrantSnapshot().raw;
  const id = selectedCopy();
  const current = () => !attempt.signal.aborted && selectedCopy() === id && readOfflineStudyAccount()?.token === account?.token;
  const offline = navigator.onLine === false;
  network.hidden = !offline;
  if (shown && shown.id === id && shown.grant === grant && sameOfflineStudyScope(shown.scope, account?.scope ?? null)) {
    hideContentForCheck();
  } else discardContent();
  showNotices();
  checking.textContent = offline ? text.opening : text.checking;
  checking.hidden = false;
  const copyUnavailable = () => {
    discardContent();
    showNotices(id ? text.missing : [success, text.empty].filter(Boolean).join(" "));
    if (focusHeading) heading.focus({ preventScroll: true });
  };
  if (!account) {
    showNotices(text.signedOut);
    if (focusHeading) heading.focus({ preventScroll: true });
    return;
  }
  try {
    const copies = await listOfflineStudy();
    if (!current()) return;
    if (!copies.length) { copyUnavailable(); return; }
    const copy = id ? await openOfflineStudy(id) : null;
    if (!current()) return;
    if (id && !copy) { copyUnavailable(); return; }
    let newer = false;
    const verifyOnline = navigator.onLine !== false;
    if (verifyOnline) {
      if (!hasUnexpiredAccessToken(account.token)) {
        discardContent();
        showNotices("", text.renewSession);
        return;
      }
      const route = copy
        ? `sessions/${copy.studyId}/units/${copy.unitId}?${new URLSearchParams({ plan_revision_id: copy.planRevisionId })}`
        : "sessions?limit=1";
      const response = await requestOfflineTeacher(route, account.token, { signal: attempt.signal });
      if (!current()) return;
      if (response.status === 401 || response.status === 403 || (copy && response.status === 404)) {
        if (response.status === 404 && copy) await removeOfflineStudy(copy.id);
        else clearOfflineStudyGrant(account.scope);
        if (current()) { discardContent(); showNotices("", text.denied); }
        return;
      }
      if (response.status !== 200) throw new Error("Teacher unavailable");
      const data = record(response.data);
      if (!current()) return;
      if (copy) {
        const read = record(record(data?.allowed_actions)?.read_theory);
        if (data?.kind !== "material" || typeof read?.enabled !== "boolean" || data.unit_id !== copy.unitId ||
          data.plan_revision_id !== copy.planRevisionId || typeof data.content_version_id !== "string") throw new Error("Teacher unavailable");
        if (!read.enabled) {
          await removeOfflineStudy(copy.id);
          if (current()) { discardContent(); showNotices("", text.denied); }
          return;
        }
        newer = data.content_version_id !== copy.contentVersionId;
      } else if (!Array.isArray(data?.data) || !record(data?.meta)) throw new Error("Teacher unavailable");
    }
    if (!current()) return;
    const visibleCopies = copies.filter((entry) => entry.expiresAt > Date.now());
    if (!copy && !visibleCopies.length) { copyUnavailable(); return; }
    const key = copy
      ? `${copy.id}:${copy.contentVersionId}:${copy.downloadedAt}:${newer}`
      : visibleCopies.map((entry) => `${entry.id}:${entry.downloadedAt}`).join("|");
    const replaceView = shown?.key !== key;
    let markdown: typeof import("./markdown") | undefined;
    if (copy && replaceView) {
      markdown = await import("./markdown");
      if (!current()) return;
    }
    if (copy && (verifyOnline || replaceView)) {
      // A copy may expire or change during the authority check or the reader import.
      const latest = await openOfflineStudy(copy.id);
      if (!current()) return;
      if (!latest) { copyUnavailable(); return; }
      if (latest.downloadedAt !== copy.downloadedAt || latest.contentVersionId !== copy.contentVersionId) {
        void render({ success, focusHeading });
        return;
      }
    }
    showNotices(success);
    const focused = previousFocus;
    previousFocus = undefined;
    if (replaceView) {
      discardContent();
      if (copy && markdown) showCopy(copy, newer, markdown.renderReadingMarkdown);
      else {
        for (const item of visibleCopies) {
          const row = element("li");
          const itemLink = link(item.title, `#${encodeURIComponent(item.id)}`);
          itemLink.className = "download-link";
          row.append(itemLink, expiryMessage(item));
          list.append(row);
        }
        list.hidden = false;
      }
      shown = { scope: account.scope, grant, id, key };
    }
    showContent();
    const newHeading = document.querySelector<HTMLHeadingElement>("#lesson-title") ?? heading;
    if (focusHeading) newHeading.focus();
    else if (focused && document.activeElement === document.body) {
      (focused.isConnected ? focused : newHeading).focus({ preventScroll: true });
    }
    void reading?.refresh();
    const expiresAt = copy?.expiresAt ?? Math.min(...visibleCopies.map((entry) => entry.expiresAt));
    expiry = window.setTimeout(() => { void render(); }, Math.max(0, expiresAt - Date.now()));
  } catch {
    if (current()) {
      discardContent();
      showNotices("", text.unavailable, true);
      if (focusHeading) retry.focus({ preventScroll: true });
    }
  }
}

const refresh = () => { void render(); };
const reconnect = () => { void render().then(syncReading); };
let previousToken = readOfflineStudyAccount()?.token;
subscribeOfflineStudyChanges(() => {
  const token = readOfflineStudyAccount()?.token;
  if (token !== previousToken) reconnect();
  else refresh();
  previousToken = token;
}, false);
retry.onclick = () => { void render({ focusHeading: true }).then(syncReading); };
window.addEventListener("hashchange", () => { void render({ focusHeading: true }); });
window.addEventListener("pageshow", (event) => { if (event.persisted) reconnect(); });
window.addEventListener("pagehide", clearView);
window.addEventListener("online", reconnect);
window.addEventListener("offline", refresh);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
reconnect();
