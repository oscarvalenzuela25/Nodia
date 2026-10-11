// Real UI/services, synthetic HTTP only. Requires the calendar-qa Vite server.
const { chromium } = require(process.env.NODIA_QA_PLAYWRIGHT || "playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const output = process.argv[2];
const labels = (lang) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../../translate/" + lang + "/rental.json"),
      "utf8",
    ),
  );
const url = (tab, lang, extra = "") =>
  "http://127.0.0.1:5194/src/test/manual/reservations-calendar/index.html?property=1&owner=1&theme=" +
  (lang === "es" ? "dark" : "light") +
  "&lang=" +
  lang +
  "&tab=" +
  tab +
  extra;
async function measure(p, context) {
  const m = await p.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll(".MuiDialog-paper")].map((e) => ({
      client: e.clientWidth,
      scroll: e.scrollWidth,
    })),
  }));
  assert(m.document <= m.viewport + 1, JSON.stringify({ context, ...m }));
  for (const d of m.dialogs)
    assert(d.scroll <= d.client + 1, JSON.stringify({ context, ...m }));
  return m;
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [],
    notices = [];
  for (const lang of ["es", "en"])
    for (const width of [320, 390, 599, 600, 768, 1440]) {
      const l = labels(lang),
        p = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      p.on("pageerror", (e) => {
        if (e.message.includes("ResizeObserver loop")) notices.push(e.message);
        else errors.push(e.message);
      });
      await p.clock.install({ time: new Date("2026-11-08T12:00:00Z") });
      for (const tab of [
        "calendar",
        "reservations",
        "turnovers",
        "cash",
        "collaborators",
        "configuration",
        "expenses",
      ]) {
        await p.goto(url(tab, lang));
        await p
          .getByRole("tab", {
            name: l.tabs[tab === "expenses" ? "cash" : tab],
            exact: true,
          })
          .waitFor();
        if (tab === "configuration")
          await p
            .getByRole("heading", {
              name: l.configuration_view.title,
              exact: true,
            })
            .waitFor();
        else if (tab !== "calendar" && tab !== "cash") {
          await p
            .getByRole(width < 600 ? "listitem" : "row")
            .first()
            .waitFor();
          if (width < 600)
            assert(
              (await p.getByRole("table").count()) === 0,
              tab + " should use mobile cards",
            );
          else
            assert(
              (await p.getByRole("table").count()) === 1,
              tab + " should retain desktop table",
            );
        } else if (tab === "calendar")
          await p.getByText(l.calendar_legend, { exact: true }).waitFor();
        else await p.getByText(l.overview_cash, { exact: true }).waitFor();
        results.push({ lang, width, tab, ...(await measure(p, tab)) });
        if (tab === "configuration" && [390, 1440].includes(width))
          await p.screenshot({
            path: path.join(
              output,
              "configuration-" + width + "-" + lang + ".png",
            ),
            fullPage: true,
          });
      }
      // Secondary surfaces retain the same handlers and fit inside their modal.
      await p.goto(url("calendar", lang, "&blocks=1"));
      await p
        .getByRole("button", { name: l.calendar_manage, exact: true })
        .click();
      await p
        .getByRole("menuitem", { name: l.manage_blocks, exact: true })
        .click();
      await p
        .getByRole("heading", { name: l.manage_blocks, exact: true })
        .waitFor();
      await p
        .getByRole(width < 600 ? "listitem" : "row")
        .first()
        .waitFor();
      results.push({
        lang,
        width,
        tab: "blocks",
        ...(await measure(p, "blocks")),
      });
      await p
        .getByRole("button", { name: l.calendar_manage, exact: true })
        .click();
      await p.getByRole("menuitem", { name: l.history, exact: true }).click();
      const history = p.getByRole("dialog");
      await history
        .getByRole(width < 600 ? "listitem" : "row")
        .first()
        .waitFor();
      results.push({
        lang,
        width,
        tab: "history",
        ...(await measure(p, "history")),
      });
      await p.goto(url("cash", lang));
      await p
        .getByRole("button", { name: l.view_payments, exact: true })
        .click();
      const payments = p.getByRole("dialog");
      await payments
        .getByRole(width < 600 ? "listitem" : "row")
        .first()
        .waitFor();
      results.push({
        lang,
        width,
        tab: "payments",
        ...(await measure(p, "payments")),
      });
      assert.deepEqual(errors, []);
      await p.close();
      console.log("Layouts", lang, width, "passed");
    }
  // Both grouped editors preserve data after rejected writes and resizing.
  for (const lang of ["es", "en"]) {
    const l = labels(lang),
      p = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await p.goto(url("configuration", lang, "&reject=1"));
    for (const section of ["details", "defaults"]) {
      await p
        .getByRole("button", {
          name: l.configuration_view["edit_" + section],
          exact: true,
        })
        .click();
      const dialog = p.getByRole("dialog"),
        key = section === "details" ? "location" : "default_nightly_rate";
      const input = dialog.getByRole("textbox", { name: l[key], exact: true });
      const value = section === "details" ? "QA preserved location" : "98765";
      await input.fill(value);
      await p.setViewportSize({ width: 768, height: 1000 });
      assert.equal(await input.inputValue(), value);
      await dialog.getByRole("button", { name: l.save, exact: true }).click();
      await p.waitForFunction(() =>
        window.calendarQaRequests.some((r) => r.startsWith("put ")),
      );
      assert.equal(await input.inputValue(), value);
      assert.equal(await dialog.count(), 1);
      results.push({
        lang,
        flow: section + " rejected draft",
        ...(await measure(p, section)),
      });
      await dialog
        .locator("button")
        .filter({ hasText: lang === "es" ? "Cancelar" : "Cancel" })
        .click();
      await p.setViewportSize({ width: 390, height: 900 });
    }
    await p
      .getByRole("button", {
        name: l.configuration_view.use_default,
        exact: true,
      })
      .click();
    await p.waitForFunction(
      () =>
        window.calendarQaRequests.filter((r) => r.startsWith("put ")).length >=
        3,
    );
    assert(
      await p
        .getByRole("button", { name: l.save_default_policy, exact: true })
        .isEnabled(),
    );
    results.push({ lang, flow: "default rejection retry available" });
    await p.close();
  }
  // Confirmed writes refetch synthetic property state using the real service hooks.
  for (const lang of ["es", "en"]) {
    const l = labels(lang);
    const core = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../../translate/" + lang + "/core.json"),
        "utf8",
      ),
    );
    const p = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await p.goto(url("configuration", lang));
    await p
      .getByRole("button", {
        name: l.configuration_view.use_default,
        exact: true,
      })
      .click();
    await p
      .getByText(l.configuration_view.default_policy, { exact: true })
      .waitFor();
    assert(
      await p
        .getByRole("button", { name: l.deactivate, exact: true })
        .isDisabled(),
    );
    results.push({
      lang,
      flow: "saved default reflected and protected",
      ...(await measure(p, "saved default")),
    });
    await p
      .getByRole("button", {
        name: l.configuration_view.edit_details,
        exact: true,
      })
      .click();
    const dialog = p.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: l.location, exact: true })
      .fill("Synthetic updated location");
    await dialog.getByRole("button", { name: l.save, exact: true }).click();
    await p.getByText("Synthetic updated location", { exact: true }).waitFor();
    assert.equal(await p.getByRole("dialog").count(), 0);
    results.push({
      lang,
      flow: "saved details close editor and refetch",
      ...(await measure(p, "saved details")),
    });
    // Leave toast hover before testing the final footer: Sileo pauses its
    // dismiss timer under the pointer, and a success toast can cover its center.
    await p.mouse.move(0, 0);
    await p.waitForFunction(
      () => !document.querySelector('[data-sileo-toast][data-ready="true"]'),
    );
    await p
      .getByRole("button", { name: l.archive_property, exact: true })
      .evaluate((element) => element.scrollIntoView({ block: "center" }));
    await p
      .getByRole("button", { name: l.archive_property, exact: true })
      .click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: core.confirm, exact: true })
      .click();
    await p
      .getByRole("button", { name: l.reactivate_property, exact: true })
      .waitFor();
    assert(
      await p
        .getByRole("button", { name: l.new_reservation, exact: true })
        .isDisabled(),
    );
    results.push({
      lang,
      flow: "archive reflected after confirmation",
      ...(await measure(p, "archive")),
    });
    await p.close();
  }
  // Read-only configuration and missing/invalid/failed lists.
  for (const extra of [
    "&resource=cancellation-policies&empty=1",
    "&resource=cancellation-policies&error=1",
    "&resource=cancellation-policies&invalid=1",
  ]) {
    const p = await browser.newPage({ viewport: { width: 320, height: 900 } });
    await p.goto(url("configuration", "es", extra));
    await p
      .getByText(
        extra.includes("empty") ? labels("es").empty : labels("es").load_error,
        { exact: true },
      )
      .first()
      .waitFor();
    results.push({ scenario: extra, ...(await measure(p, extra)) });
    await p.close();
  }
  for (const lang of ["es", "en"]) {
    const p = await browser.newPage({ viewport: { width: 320, height: 900 } });
    await p.goto(url("configuration", lang, "&long=1"));
    await p
      .getByText("Synthetic".repeat(12), { exact: true })
      .first()
      .waitFor();
    await p.getByText("0.00 %", { exact: true }).first().waitFor();
    results.push({
      lang,
      scenario: "long property and exact maximum amount",
      ...(await measure(p, "long property")),
    });
    await p.close();
  }
  const p = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await p.goto(url("configuration", "en").replace("&owner=1", ""));
  await p
    .getByRole("heading", {
      name: labels("en").configuration_view.title,
      exact: true,
    })
    .waitFor();
  assert.equal(
    await p
      .getByRole("button", {
        name: labels("en").configuration_view.edit_details,
        exact: true,
      })
      .count(),
    0,
  );
  assert.equal(
    await p
      .getByRole("button", {
        name: labels("en").configuration_view.use_default,
        exact: true,
      })
      .count(),
    0,
  );
  await p
    .getByRole("button", { name: labels("en").view_policy, exact: true })
    .click();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: labels("en").save, exact: true })
    .waitFor();
  assert(
    await p
      .getByRole("dialog")
      .getByRole("button", { name: labels("en").save, exact: true })
      .isDisabled(),
  );
  results.push({
    scenario: "member read-only detail",
    ...(await measure(p, "member")),
  });
  await browser.close();
  fs.writeFileSync(
    path.join(output, "configuration-mobile-results.json"),
    JSON.stringify({ results, notices }, null, 2),
  );
  console.log("Passed", results.length, "checks; isolated HTTP fixtures only.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
