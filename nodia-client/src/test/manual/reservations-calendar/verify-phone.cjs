const { chromium } = require(process.env.NODIA_QA_PLAYWRIGHT || "playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const output = process.argv[2];
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  for (const [width, lang, theme] of [
    [390, "es", "dark"],
    [600, "es", "dark"],
    [1440, "es", "dark"],
    [390, "en", "light"],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 1100 } });
    const rental = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../../translate/" + lang + "/rental.json"),
        "utf8",
      ),
    );
    const core = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../../translate/" + lang + "/core.json"),
        "utf8",
      ),
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.install({ time: new Date("2026-11-08T12:00:00Z") });
    await page.goto(
      "http://127.0.0.1:5194/src/test/manual/reservations-calendar/index.html?property=1&reject=1&lang=" +
        lang +
        "&theme=" +
        theme,
    );
    await page
      .getByRole("button", { name: rental.new_reservation, exact: true })
      .first()
      .click();
    let dialog = page.getByRole("dialog");
    for (const [key, value] of [
      ["check_in_on", "2026-11-15"],
      ["check_out_on", "2026-11-17"],
      ["check_in_time", "15:00"],
      ["check_out_time", "11:00"],
    ])
      await dialog
        .getByRole("textbox", { name: rental[key], exact: true })
        .fill(value);
    await dialog
      .getByRole("button", { name: rental.wizard_continue, exact: true })
      .click();
    await dialog
      .getByRole("textbox", { name: rental.guest_name, exact: true })
      .fill("QA phone guest");
    await dialog
      .getByRole("button", { name: core.phone_country, exact: true })
      .click();
    await page.getByPlaceholder(core.search, { exact: true }).fill("+1");
    const country =
      new Intl.DisplayNames([lang], { type: "region" }).of("US") + " (+1)";
    await page.getByRole("option", { name: country, exact: true }).click();
    const input = dialog.getByRole("textbox", {
      name: rental.guest_contact,
      exact: true,
    });
    await input.fill("123");
    await dialog
      .getByRole("button", { name: rental.wizard_continue, exact: true })
      .click();
    await dialog
      .getByText(rental.invalid_guest_phone, { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() =>
        window.calendarQaRequests.some((r) => r.startsWith("post ")),
      ),
      false,
    );
    await input.fill("2025550123");
    await dialog
      .getByRole("button", { name: rental.wizard_continue, exact: true })
      .click();
    await dialog
      .getByRole("textbox", { name: rental.nightly_rate, exact: true })
      .fill("100000");
    await dialog
      .getByRole("textbox", { name: rental.deposit_amount, exact: true })
      .fill("50000");
    await dialog
      .getByRole("button", { name: rental.wizard_draft, exact: true })
      .click();
    await page
      .getByText("Synthetic QA rejection", { exact: false })
      .first()
      .waitFor();
    assert.equal(await page.getByRole("dialog").count(), 1);
    await dialog
      .getByRole("button", { name: rental.wizard_back, exact: true })
      .click();
    assert.equal(await input.inputValue(), "2025550123");
    await dialog.getByText(country, { exact: true }).waitFor();
    const geometry = await dialog.evaluate((el) => ({
      dialogOverflow: el.scrollWidth - el.clientWidth,
      pageOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }));
    assert.ok(geometry.dialogOverflow <= 1 && geometry.pageOverflow <= 1);
    assert.deepEqual(
      errors.filter((e) => !e.startsWith("ResizeObserver loop")),
      [],
    );
    await dialog.screenshot({
      path: path.join(output, "guest-phone-" + lang + "-" + width + ".png"),
    });
    results.push({
      width,
      lang,
      theme,
      ...geometry,
      callingCodeSelected: true,
      invalidDraftBlocked: true,
      rejectedWritePreserved: true,
      resizeObserverNotices: errors.filter((e) =>
        e.startsWith("ResizeObserver loop"),
      ),
    });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(
    path.join(output, "guest-phone-browser-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify({ passed: results.length, results }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
