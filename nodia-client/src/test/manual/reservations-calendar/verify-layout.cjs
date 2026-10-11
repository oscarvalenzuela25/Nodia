const { chromium } = require(process.env.NODIA_QA_PLAYWRIGHT || "playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const output = process.argv[2];
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true }),
    results = [];
  for (const lang of ["es", "en"])
    for (const width of [390, 599, 600, 768, 1440]) {
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
      const page = await browser.newPage({ viewport: { width, height: 1100 } }),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.clock.install({ time: new Date("2026-11-08T12:00:00Z") });
      await page.goto(
        "http://127.0.0.1:5194/src/test/manual/reservations-calendar/index.html?property=1&lang=" +
          lang +
          "&theme=" +
          (lang === "es" ? "dark" : "light"),
      );
      await page
        .getByRole("button", { name: labels.new_reservation, exact: true })
        .first()
        .click();
      const dialog = page.getByRole("dialog");
      const input = (key) =>
        dialog.getByRole("textbox", { name: labels[key], exact: true });
      for (const [key, value] of [
        ["check_in_on", "2026-11-15"],
        ["check_out_on", "2026-11-17"],
        ["check_in_time", "15:00"],
        ["check_out_time", "11:00"],
      ])
        await input(key).fill(value);
      await dialog
        .getByRole("button", { name: labels.wizard_continue, exact: true })
        .click();
      await input("guest_name").fill("QA agreement guest");
      await input("guest_contact").fill("guest@example.test");
      await dialog
        .getByRole("button", { name: labels.wizard_continue, exact: true })
        .click();
      await input("nightly_rate").waitFor();
      const box = (locator) =>
        locator.evaluate((el) => {
          const r = el.closest(".MuiFormControl-root").getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
      const money = await Promise.all(
        [
          "nightly_rate",
          "cleaning_fee",
          "discount_amount",
          "commission_amount",
          "deposit_amount",
          "notes",
        ].map((key) => box(input(key))),
      );
      const dates = [];
      for (const key of ["deposit_due_at", "balance_due_at"]) {
        const group = dialog.getByRole("group", {
          name: labels[key],
          exact: true,
        });
        const date = await box(
          group.getByRole("textbox", {
            name: core.date_time_date.replace("{{label}}", labels[key]),
            exact: true,
          }),
        );
        const time = await box(
          group.getByRole("textbox", {
            name: core.date_time_time.replace("{{label}}", labels[key]),
            exact: true,
          }),
        );
        const area = await group.boundingBox();
        if (width >= 600) {
          assert.ok(
            Math.abs(date.y - time.y) < 1,
            "date/time vertical alignment",
          );
          assert.ok(time.width >= 140, "hour width");
        }
        assert.ok(
          Math.abs(area.width - money[4].width) < 1,
          "deadline and deposit full width",
        );
        dates.push({ field: key, date, time, width: area.width });
      }
      assert.ok(
        Math.abs(money[4].width - money[5].width) < 1,
        "deposit and notes full width",
      );
      if (width >= 600) {
        assert.ok(Math.abs(money[0].y - money[1].y) < 1, "first money row");
        assert.ok(Math.abs(money[2].y - money[3].y) < 1, "second money row");
        assert.ok(Math.abs(money[0].x - money[2].x) < 1, "left money column");
        assert.ok(Math.abs(money[1].x - money[3].x) < 1, "right money column");
      }
      const overflow = await dialog.evaluate((el) => ({
        dialog: el.scrollWidth - el.clientWidth,
        page:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      }));
      assert.ok(overflow.dialog <= 1 && overflow.page <= 1, "overflow");
      assert.deepEqual(
        errors.filter((e) => !e.startsWith("ResizeObserver loop")),
        [],
      );
      if (
        (lang === "es" && [390, 768, 1440].includes(width)) ||
        (lang === "en" && width === 600)
      )
        await dialog.screenshot({
          path: path.join(
            output,
            "agreement-aligned-" + lang + "-" + width + ".png",
          ),
        });
      results.push({
        lang,
        width,
        money,
        dates,
        overflow,
        errors,
        passed: true,
      });
      await page.close();
    }
  await browser.close();
  fs.writeFileSync(
    path.join(output, "agreement-layout-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify({ passed: results.length }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
