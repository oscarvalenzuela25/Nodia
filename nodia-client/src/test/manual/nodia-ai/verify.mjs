// Real Chromium, real UI/theme/PageContent, synthetic Axios adapter only.
import { chromium } from "playwright";
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const origin = "http://127.0.0.1:5194";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const output = name => fileURLToPath(new URL(`../../../../../docs/evidence/nodia-ai-ai13-browser-${name}`, import.meta.url));
const translations = Object.fromEntries(["es", "en"].map(lang => [lang,
  JSON.parse(fs.readFileSync(new URL(`../../../translate/${lang}/nodiaAi.json`, import.meta.url), "utf8")),
]));
const results = [], interactions = [], errors = [], networkApiRequests = [];
const syntheticModelLabel = "Modelo sintético alternativo / Synthetic alternative model";

async function open(page, { width = 390, theme = "dark", lang = "es", scenario = "default" } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${origin}/src/test/manual/nodia-ai/index.html?theme=${theme}&lang=${lang}&scenario=${scenario}`);
  await page.getByRole("heading", { name: "Nodia AI", level: 1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.getByText("[QA SINTÉTICO / SYNTHETIC QA]", { exact: false }).waitFor();
  if (scenario !== "unknown" && scenario !== "read-only") await page.getByRole("button", { name: translations[lang].send, exact: true }).waitFor({ state: "visible" });
  if (scenario !== "unknown") await page.waitForFunction(() => !!window.__nodiaAiQa && document.querySelectorAll("[role=alert]").length === 0);
}
async function settings(page, lang) {
  const t = translations[lang];
  const trigger = page.getByRole("button", { name: t.settings, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: t.configuration.title });
  await dialog.waitFor();
  assert.equal(await page.getByRole("switch").count(), 0);
  await page.waitForFunction(() => {
    const paper = document.querySelector("[role=dialog]");
    return paper && getComputedStyle(paper).transform === "none";
  });
  return { trigger, dialog };
}
async function layout(page) {
  return page.evaluate(() => {
    const section = document.querySelector("section");
    const region = document.querySelector("[role=region]");
    const dialog = document.querySelector("[role=dialog]");
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      padding: parseFloat(getComputedStyle(section.parentElement).paddingLeft),
      messageScrollWidth: region.scrollWidth, messageClientWidth: region.clientWidth,
      messageScrollHeight: region.scrollHeight, messageClientHeight: region.clientHeight,
      dialogs: document.querySelectorAll("[role=dialog]").length,
      drawerWidth: dialog?.getBoundingClientRect().width ?? null,
    };
  });
}
async function expectNoPost(page) {
  assert.equal(await page.evaluate(() => window.__nodiaAiQa.requests.filter(item => item.method === "POST").length), 0, "A read/restore triggered a POST");
}

try {
  const page = await browser.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.url().includes("/api/")) networkApiRequests.push(request.url()); });
  for (const width of [320, 390, 599, 600, 899, 900, 1440]) for (const theme of ["light", "dark"]) for (const lang of ["es", "en"]) {
    const t = translations[lang];
    await open(page, { width, theme, lang });
    const main = await layout(page);
    assert(main.scrollWidth <= main.clientWidth, `Page overflow ${JSON.stringify({ width, theme, lang, main })}`);
    assert(main.messageScrollWidth <= main.messageClientWidth, "Messages overflow horizontally");
    if (width < 600) {
      assert(main.messageClientHeight >= 240, `Mobile reading area is too short: ${JSON.stringify({ width, theme, lang, main })}`);
      await page.getByRole("textbox", { name: t.message }).scrollIntoViewIfNeeded();
      const composer = await page.getByRole("textbox", { name: t.message }).boundingBox();
      assert(composer.y >= 0 && composer.y + composer.height <= 900, "Composer is not reachable by normal document scrolling");
      main.composerReachableByDocumentScroll = true;
    }
    assert.equal(main.padding, width < 600 ? 16 : width < 900 ? 24 : 32);
    assert.equal(main.dialogs, 0);
    if (width === 1440 && theme === "light" && lang === "en") await page.screenshot({ path: output("1440-light-en.png"), fullPage: true });
    if (width === 320 && theme === "dark" && lang === "es") await page.screenshot({ path: output("320-main-dark-es.png"), fullPage: true });
    const { dialog, trigger } = await settings(page, lang);
    assert.equal(await page.getByRole("switch").isChecked(), false);
    const drawer = await layout(page);
    assert(drawer.scrollWidth <= drawer.clientWidth, `Drawer overflow ${JSON.stringify({ width, theme, lang, drawer })}`);
    assert.equal(drawer.dialogs, 1);
    assert(drawer.drawerWidth <= width + 0.5, `Drawer width ${JSON.stringify({ width, theme, lang, drawer })}`);
    if (width === 320 && theme === "dark" && lang === "es") await page.screenshot({ path: output("320-dark-es.png"), fullPage: true });
    await dialog.getByRole("button", { name: t.configuration.close, exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(label => document.activeElement?.textContent === label, t.settings);
    await trigger.waitFor({ state: "visible" });
    await expectNoPost(page);
    results.push({ width, theme, lang, main, drawer, focusRestored: true, restorePosts: 0 });
  }

  await open(page);
  const t = translations.es;
  const draftText = "Borrador sintético que debe conservarse / Synthetic draft retained";
  await page.getByRole("textbox", { name: t.message }).fill(draftText);
  const { dialog } = await settings(page, "es");
  await page.setViewportSize({ width: 390, height: 650 });
  const shortViewport = await dialog.getByRole("button", { name: t.configuration.apply, exact: true }).boundingBox();
  assert(shortViewport.y >= 0 && shortViewport.y + shortViewport.height <= 650, "Apply action is clipped in a short viewport");
  interactions.push("drawer footer remains reachable at 390×650 viewport (not virtual keyboard emulation)");
  await page.setViewportSize({ width: 390, height: 900 });
  await dialog.getByRole("button", { name: t.configuration.mode, exact: true }).click();
  await page.getByRole("option", { name: t.modes.api_key, exact: true }).click();
  await dialog.getByRole("button", { name: t.configuration.model, exact: true }).waitFor();
  assert(await dialog.getByRole("button", { name: t.configuration.apply, exact: true }).isDisabled());
  assert.equal(await page.getByRole("switch").count(), 0);
  await dialog.getByRole("button", { name: t.configuration.mode, exact: true }).click();
  await page.getByRole("option", { name: t.modes.agentic, exact: true }).click();
  assert.equal(await page.getByRole("switch").count(), 0);
  interactions.push("Unconfigured API keeps its model unassigned and blocks Apply; Agentic does not expose delegation");
  await dialog.getByRole("button", { name: t.configuration.model, exact: true }).click();
  await page.getByRole("option", { name: syntheticModelLabel, exact: true }).click();
  await dialog.getByRole("button", { name: t.configuration.apply, exact: true }).waitFor();
  for (const width of [1440, 899, 320, 900, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.getByRole("dialog").count(), 1, "Resizing mounted duplicate dialogs");
    assert((await dialog.getByRole("button", { name: t.configuration.model, exact: true }).textContent()).includes(syntheticModelLabel));
  }
  interactions.push("single configuration draft retained across 390→1440→899→320→900→390");

  await page.evaluate(async () => { window.__nodiaAiQa.failNext("catalog"); await window.__nodiaAiQa.refetch("connections"); });
  await dialog.getByText(t.catalog_error, { exact: true }).waitFor();
  assert((await dialog.getByRole("button", { name: t.configuration.model, exact: true }).textContent()).includes(syntheticModelLabel));
  await dialog.getByRole("button", { name: t.configuration.retry, exact: true }).click();
  await dialog.getByText(t.catalog_error, { exact: true }).waitFor({ state: "hidden" });
  await page.waitForFunction(label => [...document.querySelectorAll("button")].some(button => button.textContent === label && !button.disabled), t.configuration.apply);
  interactions.push("catalog refetch failure keeps edited selection and recovers locally");

  await page.evaluate(() => window.__nodiaAiQa.failNext("selection"));
  await dialog.getByRole("button", { name: t.configuration.apply, exact: true }).click();
  await dialog.getByText("Fallo sintético recuperable / Recoverable synthetic failure", { exact: true }).waitFor();
  assert((await dialog.getByRole("button", { name: t.configuration.model, exact: true }).textContent()).includes(syntheticModelLabel));
  await dialog.getByRole("button", { name: t.configuration.retry, exact: true }).click();
  await dialog.getByText("Fallo sintético recuperable / Recoverable synthetic failure", { exact: true }).waitFor({ state: "hidden" });
  await dialog.getByRole("button", { name: t.configuration.close, exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("textbox", { name: t.message }).inputValue(), draftText);
  await expectNoPost(page);
  interactions.push("rejected synthetic PATCH retains drawer model and underlying composer draft");

  await page.reload();
  await page.getByText("[QA SINTÉTICO / SYNTHETIC QA]", { exact: false }).waitFor();
  await expectNoPost(page);
  interactions.push("reload reconstructs stored fixture messages without POST");

  await open(page, { scenario: "unknown" });
  await page.getByText(t.states.unknown, { exact: false }).waitFor();
  assert(await page.getByRole("textbox", { name: t.message }).isDisabled());
  assert(await page.getByRole("button", { name: t.send, exact: true }).isDisabled());
  await expectNoPost(page);
  interactions.push("unknown result preserves history and blocks new submissions");
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(networkApiRequests.length, 0, "The synthetic QA leaked an API network request");
  const report = {
    scope: "synthetic_adapter_real_page_drawer_theme_pagecontent_memoryrouter_chrome",
    source: "src/test/manual/nodia-ai/fixtures.ts; not live Gemini, not backend, not configured database",
    cases: results.length, results, interactions, pageErrors: errors, actualNetworkApiRequests: networkApiRequests.length,
    browser: browser.version(), generatedAt: new Date().toISOString(),
    notVerified: ["full_authenticated_shell", "real_provider_inference", "real_backend_authorization", "real_SQL_persistence", "physical_phone", "virtual_keyboard", "other_browser_engines"],
  };
  fs.writeFileSync(output("qa.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ cases: results.length, interactions: interactions.length, pageErrors: errors.length, actualNetworkApiRequests: networkApiRequests.length, browser: browser.version() }));
} finally {
  await browser.close();
}
