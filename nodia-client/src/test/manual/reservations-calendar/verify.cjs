const { chromium } = require(process.env.NODIA_QA_PLAYWRIGHT || "playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const output = process.argv[2] || __dirname;
const base =
  "http://127.0.0.1:5194/src/test/manual/reservations-calendar/index.html?property=1";
const results = [];
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  for (const theme of ["light", "dark"])
    for (const width of [320, 390, 599, 600, 768, 900, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.clock.install({ time: new Date("2026-11-08T12:00:00Z") });
      await page.goto(base + "&theme=" + theme);
      await page.getByRole("tab", { name: "Agenda", exact: true }).waitFor();
      await (
        width < 600
          ? page.getByRole("button", {
              name: "Synthetic guest · Confirmada",
              exact: true,
            })
          : page.getByText("Synthetic guest · Confirmada", { exact: true })
      )
        .first()
        .click();
      await page
        .getByRole("button", { name: "Ver reserva completa" })
        .waitFor();
      assert.equal(
        await page
          .locator("body")
          .getByText("2026-11-08 · 15:00", { exact: true })
          .count(),
        1,
      );
      const requests = await page.evaluate(() => window.calendarQaRequests);
      assert.equal(
        requests.filter((item) => /get .*\/reservations\/\d+$/.test(item))
          .length,
        1,
      );
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      assert.ok(overflow <= 1, "page overflow " + width);
      if (width < 600) {
        assert.equal(
          await page
            .getByRole("button", { name: "Período siguiente", exact: true })
            .count(),
          0,
        );
        await page.getByRole("button", { name: "Cerrar", exact: true }).click();
        await page
          .getByRole("button", {
            name: "Synthetic guest · Confirmada",
            exact: true,
          })
          .first()
          .waitFor();
      }
      await page
        .getByRole("button", { name: "Nueva reserva", exact: true })
        .first()
        .click();
      await page
        .getByRole("button", {
          name: "Elegir fecha: Fecha de entrada",
          exact: true,
        })
        .click();
      const picker = page.getByRole("dialog").last();
      await picker.getByRole("gridcell", { name: "15", exact: true }).click();
      assert.equal(
        await page
          .getByRole("textbox", { name: "Fecha de entrada", exact: true })
          .inputValue(),
        "2026-11-15",
      );
      await page.waitForTimeout(250);
      const dialogOverflow = await page
        .getByRole("dialog")
        .last()
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      assert.ok(dialogOverflow <= 1, "dialog overflow " + width);
      await page
        .getByRole("button", { name: "Cerrar", exact: true })
        .last()
        .click();
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: path.join(output, "calendar-" + theme + "-" + width + ".png"),
          fullPage: true,
        });
      assert.deepEqual(errors, []);
      results.push({
        theme,
        width,
        overflow,
        dialogOverflow,
        detailRequests: 1,
        passed: true,
      });
      await page.close();
    }
  for (const scenario of ["empty", "error", "invalid", "loading"]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "&" + scenario + "=1");
    await page.getByRole("tab", { name: "Agenda", exact: true }).waitFor();
    const message =
      scenario === "empty"
        ? "No hay reservas, bloqueos o preparaciones en este período."
        : scenario === "loading"
          ? null
          : "No se pudo cargar el calendario";
    if (message)
      await page.getByText(message, { exact: false }).first().waitFor();
    if (scenario === "loading") await page.waitForTimeout(1500);
    assert.deepEqual(errors, []);
    results.push({ scenario, passed: true });
    await page.close();
  }
  // Spanish and English, keyboard, creation steps and rejected mutation.
  for (const lang of ["es", "en"]) {
    const labels = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../../translate/" + lang + "/rental.json"),
        "utf8",
      ),
    );
    const es = lang === "es",
      page = await browser.newPage({ viewport: { width: 390, height: 950 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-11-08T12:00:00Z") });
    await page.goto(base + "&reject=1&lang=" + lang);
    await page
      .getByRole("button", {
        name: es ? "Nueva reserva" : "New reservation",
        exact: true,
      })
      .first()
      .click();
    await page
      .getByRole("textbox", { name: labels.check_in_on, exact: true })
      .fill("2026-11-15");
    await page
      .getByRole("textbox", { name: labels.check_out_on, exact: true })
      .fill("2026-11-17");
    await page
      .getByRole("textbox", { name: labels.check_in_time, exact: true })
      .fill("15:00");
    await page
      .getByRole("textbox", { name: labels.check_out_time, exact: true })
      .fill("11:00");
    await page
      .getByRole("button", { name: es ? "Continuar" : "Continue", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: labels.guest_name, exact: true })
      .fill("QA wizard guest");
    await page
      .getByRole("textbox", { name: labels.guest_contact, exact: true })
      .fill("+56912345678");
    await page
      .getByRole("button", { name: es ? "Continuar" : "Continue", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: labels.nightly_rate, exact: true })
      .fill("100000");
    await page
      .getByRole("textbox", { name: labels.deposit_amount, exact: true })
      .fill("50000");
    await page
      .getByRole("button", {
        name: es ? "Guardar borrador" : "Save draft",
        exact: true,
      })
      .click();
    await page
      .getByText("Synthetic QA rejection", { exact: false })
      .first()
      .waitFor();
    assert.equal(await page.getByRole("dialog").count(), 1);
    assert.equal(
      await page
        .getByRole("textbox", { name: labels.nightly_rate, exact: true })
        .inputValue(),
      "100000",
    );
    assert.deepEqual(errors, []);
    results.push({ lang, wizardRejectedDraftPreserved: true, passed: true });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(
    path.join(output, "calendar-browser-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify({ passed: results.length, results }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
