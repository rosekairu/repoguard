// Test only: screenshot every screen against the mock GitHub. Usage: node tests/e2e/screenshots.cjs <session-cookie> <outdir>
const { chromium } = require("playwright");

(async () => {
  const [cookie, out = "/tmp/shots"] = process.argv.slice(2);
  const base = "http://localhost:3000";
  const b = await chromium.launch();
  const save = (p, n) => p.screenshot({ path: `${out}/${n}.png`, fullPage: true });

  const anon = await b.newContext({ viewport: { width: 1280, height: 900 } });
  let p = await anon.newPage();
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await save(p, "1-landing");
  await p.goto(base + "/u/rosekairu");
  await p.waitForTimeout(1500);
  await save(p, "0-progress");
  await p.waitForSelector("text=Is this your profile?", { timeout: 120000 });
  await p.waitForTimeout(800);
  await save(p, "2-public");

  const mob = await b.newContext({ viewport: { width: 390, height: 844 } });
  p = await mob.newPage();
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await save(p, "6-landing-mobile");

  const own = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await own.addCookies([{ name: "authjs.session-token", value: cookie, domain: "localhost", path: "/" }]);
  p = await own.newPage();
  await p.goto(base + "/u/rosekairu");
  await p.waitForSelector('h1:has-text("Your report")', { timeout: 120000 });
  await p.waitForTimeout(20000);
  await save(p, "3-owner-report");
  await p.locator("button.row").first().click();
  await p.waitForSelector("text=Fix it in this order");
  await p.waitForTimeout(600);
  await save(p, "4-finding");
  await p.goBack();
  await p.waitForSelector('h1:has-text("Your report")', { timeout: 120000 });
  await p.locator("button.filter", { hasText: "Recruiter view" }).click();
  await p.waitForSelector("text=costing you points");
  await p.waitForTimeout(600);
  await save(p, "5-recruiter");
  await b.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
