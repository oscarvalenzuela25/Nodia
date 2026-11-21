import "./reader.css";
import english from "../../../translate/en/teacher_offline_reader.json";
import spanish from "../../../translate/es/teacher_offline_reader.json";
import { TEACHER_DOWNLOADS_ROUTE } from "../constants/routes";
import {
  clearOfflineStudyGrant, listOfflineStudy, openOfflineStudy, readOfflineStudyAccount,
  removeOfflineStudy, subscribeOfflineStudyChanges, type OfflineStudyCopy, type OfflineStudySummary,
} from "../infrastructure/offlineStudy";
import { offlineStudyGrantSnapshot } from "../infrastructure/offlineStudyIdentity";
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
const message = document.querySelector<HTMLParagraphElement>("#message")!;
const failure = document.querySelector<HTMLParagraphElement>("#failure")!;
const list = document.querySelector<HTMLUListElement>("#downloads")!;
const lesson = document.querySelector<HTMLElement>("#lesson")!;
const heading = document.querySelector<HTMLHeadingElement>("#page-title")!;
document.documentElement.lang = language;
document.title = `${text.title} · Nodia`;
document.querySelector<HTMLAnchorElement>("#teacher-home")!.textContent = text.home;
heading.textContent = text.title;

const format = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });
let active: AbortController | undefined;
let expiry: number | undefined;
let reading: ReturnType<typeof createReadingProgressView> | undefined;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, content?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  return node;
}

function clearView(): void {
  active?.abort();
  window.clearTimeout(expiry);
  list.hidden = true;
  lesson.hidden = true;
  list.replaceChildren();
  lesson.replaceChildren();
  reading = undefined;
  message.textContent = "";
  failure.textContent = "";
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

function expiryMessage(copy: OfflineStudySummary): string {
  return `${text.copy} · ${text.expires} ${format.format(copy.expiresAt)}`;
}

function showCopy(copy: OfflineStudyCopy, newer: boolean): void {
  const title = element("h2", copy.title);
  title.id = "lesson-title";
  const actions = element("div");
  actions.className = "actions";
  const remove = element("button", text.delete);
  remove.type = "button";
  remove.onclick = async () => {
    remove.disabled = true;
    try {
      await removeOfflineStudy(copy.id);
      if (!remove.isConnected) return;
      history.replaceState(null, "", TEACHER_DOWNLOADS_ROUTE);
      await render(text.deleted);
      if (document.activeElement === document.body) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    } catch {
      if (remove.isConnected) {
        failure.textContent = text.delete_failed;
        remove.disabled = false;
      }
    }
  };
  actions.append(link(text.library, TEACHER_DOWNLOADS_ROUTE), remove);
  lesson.append(title, element("p", expiryMessage(copy)), actions);
  if (newer) lesson.append(element("p", text.newer));
  reading = createReadingProgressView(copy, text.progress, syncReading);
  lesson.append(reading.container);
  for (const block of copy.blocks) {
    const section = element("section");
    const body = element("div", block.body_markdown);
    body.className = "block-body";
    // Keep the offline reader text-only. Lesson markup never becomes executable DOM or remote requests.
    section.append(element("h3", block.title), body);
    if (copy.readingContext && !newer) section.append(reading.saveButton(block.id, block.title));
    lesson.append(section);
  }
  lesson.hidden = false;
  void reading.refresh();
}

async function syncReading() {
  const before = offlineStudyGrantSnapshot().raw;
  await syncOfflineReadingProgress();
  if (before !== offlineStudyGrantSnapshot().raw) await render();
  else await reading?.refresh();
}

async function render(success = ""): Promise<void> {
  clearView();
  const attempt = new AbortController();
  active = attempt;
  const account = readOfflineStudyAccount();
  const id = selectedCopy();
  const current = () => !attempt.signal.aborted && readOfflineStudyAccount()?.token === account?.token;
  const copyUnavailable = () => { message.textContent = id ? text.missing : text.empty; };
  if (!account) { copyUnavailable(); return; }
  try {
    const copies = await listOfflineStudy();
    if (!current()) return;
    if (!copies.length) { if (success && !id) message.textContent = `${success} ${text.empty}`; else copyUnavailable(); return; }
    let copy = id ? await openOfflineStudy(id) : null;
    if (!current()) return;
    if (id && !copy) { copyUnavailable(); return; }
    let newer = false;
    if (navigator.onLine !== false) {
      message.textContent = text.checking;
      if (!hasUnexpiredAccessToken(account.token)) throw new Error("Session renewal required");
      const route = copy
        ? `sessions/${copy.studyId}/units/${copy.unitId}?${new URLSearchParams({ plan_revision_id: copy.planRevisionId })}`
        : "sessions?limit=1";
      const response = await requestOfflineTeacher(route, account.token, { signal: attempt.signal });
      if (!current()) return;
      if (response.status === 401 || response.status === 403 || (copy && response.status === 404)) {
        if (response.status === 404 && copy) await removeOfflineStudy(copy.id);
        else clearOfflineStudyGrant(account.scope);
        if (current()) { message.textContent = ""; failure.textContent = text.denied; }
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
          if (current()) { message.textContent = ""; failure.textContent = text.denied; }
          return;
        }
        newer = data.content_version_id !== copy.contentVersionId;
        // The online check can take long enough for the copy to expire or be removed in another page.
        copy = await openOfflineStudy(copy.id);
        if (!current()) return;
        if (!copy) { copyUnavailable(); return; }
      } else if (!Array.isArray(data?.data) || !record(data?.meta)) throw new Error("Teacher unavailable");
    }
    if (!current()) return;
    message.textContent = success;
    if (copy) showCopy(copy, newer);
    else {
      for (const item of copies.filter((entry) => entry.expiresAt > Date.now())) {
        const row = element("li");
        row.append(link(item.title, `#${encodeURIComponent(item.id)}`), element("p", expiryMessage(item)));
        list.append(row);
      }
      list.hidden = !list.childElementCount;
      if (list.hidden) copyUnavailable();
    }
    const expiresAt = copy?.expiresAt ?? Math.min(...copies.map((entry) => entry.expiresAt));
    expiry = window.setTimeout(() => { void render(); }, Math.max(0, expiresAt - Date.now()));
  } catch {
    if (current()) { message.textContent = ""; failure.textContent = text.unavailable; }
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
window.addEventListener("hashchange", refresh);
window.addEventListener("pageshow", (event) => { if (event.persisted) reconnect(); });
window.addEventListener("pagehide", clearView);
window.addEventListener("online", reconnect);
window.addEventListener("offline", refresh);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
reconnect();
