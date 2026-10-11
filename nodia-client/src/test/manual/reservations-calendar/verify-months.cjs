const { chromium } = require(process.env.NODIA_QA_PLAYWRIGHT || "playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const output = process.argv[2];
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true }),
    results = [];
  for (const lang of ["es", "en"])
    for (const width of [390, 1440]) {
      const es = lang === "es",
        page = await browser.newPage({ viewport: { width, height: 1000 } });
      const labels = JSON.parse(
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
      await page.clock.install({ time: new Date("2026-11-08T12:00:00Z") });
      await page.goto(
        "http://127.0.0.1:5194/src/test/manual/reservations-calendar/index.html?property=1&lang=" +
          lang +
          "&theme=" +
          (es ? "dark" : "light"),
      );
      await page
        .getByRole("button", { name: labels.new_reservation, exact: true })
        .first()
        .click();
      await page
        .getByRole("button", {
          name: core.open_date_calendar.replace(
            "{{label}}",
            labels.check_in_on,
          ),
          exact: true,
        })
        .click();
      const calendar = page.getByRole("dialog", {
        name: labels.check_in_on,
        exact: true,
      });
      await calendar
        .getByRole("button", {
          name: es ? /cambie a la vista anual/ : /switch to year view/,
        })
        .click();
      await calendar.getByRole("radio", { name: "2027", exact: true }).click();
      await calendar
        .getByRole("radio", { name: es ? "mayo" : "May", exact: true })
        .waitFor();
      assert.equal(await calendar.count(), 1);
      if (es)
        await calendar.screenshot({
          animations: "disabled",
          path: path.join(output, "calendar-months-" + width + ".png"),
        });
      await calendar
        .getByRole("radio", { name: es ? "mayo" : "May", exact: true })
        .click();
      await calendar.getByRole("gridcell", { name: "20", exact: true }).click();
      await calendar.waitFor({ state: "hidden" });
      assert.equal(
        await page
          .getByRole("textbox", { name: labels.check_in_on, exact: true })
          .inputValue(),
        "2027-05-20",
      );
      results.push({
        lang,
        width,
        yearMonthDay: true,
        civilDate: "2027-05-20",
        passed: true,
      });
      await page.close();
    }
  await browser.close();
  fs.writeFileSync(
    path.join(output, "calendar-months-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify({ passed: results.length, results }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
