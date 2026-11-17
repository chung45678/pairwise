// End-to-end smoke test: the whole organizer + guest flow in a real browser.
// Needs the app running with the built frontend (see CI), then: npm run e2e
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:8000";
const CSV = new URL("../../backend/tests/fixtures/luma_export.csv", import.meta.url).pathname;
const errors = [];
const log = (...a) => console.log("✓", ...a);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--disable-component-update", "--disable-sync"],
  headless: true,
  protocolTimeout: 30000,
});
const ctx = await browser.createBrowserContext();
await ctx.overridePermissions(BASE, ["clipboard-read", "clipboard-write"]);
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const textOf = (p) => p.evaluate(() => document.body.innerText);
const waitText = (p, t, timeout = 8000) =>
  p.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
const clickButton = async (p, label) => {
  const handle = await p.waitForSelector(`::-p-xpath(//button[normalize-space(.)=${JSON.stringify(label)}])`);
  await handle.click();
};

// 1. Create event
await page.goto(BASE + "/");
await page.type("input[placeholder='PM x Blueprint Winter Mixer']", "E2E Mixer");
await page.type("input[placeholder='E7 4th floor']", "SLC");
await clickButton(page, "Create event");
await waitText(page, "Bookmark this dashboard");
const adminUrl = page.url();
log("event created, dashboard open, key removed from URL:", !adminUrl.includes("key="));

const intakeUrl = await page.$eval("input[readonly][value*='/join']", (el) => el.value);

// 2. Three guests fill the intake form
const guests = [
  ["Maya Chen", "maya.e2e@x.com", "PM", ["fintech"], "design feedback on my mockups", "roadmapping"],
  ["Jordan Lee", "jordan.e2e@x.com", "Designer", ["figma"], "learning roadmapping", "design feedback, figma"],
  ["Sam Patel", "sam.e2e@x.com", "SWE", ["machine learning"], "a cofounder", "python, backend"],
];
let guestUrl = "";
for (const [name, email, role, tags, looking, helping] of guests) {
  const g = await ctx.newPage();
  g.on("pageerror", (e) => errors.push(String(e)));
  await g.goto(intakeUrl);
  await waitText(g, "E2E Mixer");
  const inputs = await g.$$("main input:not([readonly])");
  await inputs[0].type(name);
  await inputs[1].type(email);
  await inputs[2].type(role);
  const tagInput = await g.$("input[placeholder='Type and press Enter']");
  for (const t of tags) {
    await tagInput.type(t);
    await g.keyboard.press("Enter");
  }
  const areas = await g.$$("textarea");
  await areas[0].type(looking);
  await areas[1].type(helping);
  await clickButton(g, "Save and get my link");
  await waitText(g, `You're in, ${name.split(" ")[0]}`);
  if (!guestUrl) guestUrl = g.url();
  await g.close();
}
log("3 guests completed intake, landed on private page");

// 3. Import Luma CSV
await page.bringToFront();
await page.reload();
await waitText(page, "Guests (3)");
const fileInput = await page.$("input[type=file]");
await fileInput.uploadFile(CSV);
await waitText(page, "Added 4 guests");
await waitText(page, "Guests (7)");
log("Luma import: added 4, skipped 3; guest table updated");

// 4. Generate and send
await clickButton(page, "Matches");
await clickButton(page, "Generate matches");
await waitText(page, "Review before you send");
const reviewText = await textOf(page);
log("matches generated:", reviewText.match(/\d+ pairs covering \d+ guests/)?.[0]);
const marks = await page.$$eval("mark", (ms) => ms.length);
log("highlighted evidence terms on review screen:", marks);
await page.$$eval("button", (bs) => bs.find((b) => b.textContent?.includes("Send matches"))?.click());
await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.startsWith("Send to")));
await page.$$eval("button", (bs) => bs.find((b) => b.textContent?.startsWith("Send to"))?.click());
await waitText(page, "Matches sent");
log("matches sent");

// 5. Guest sees matches and gives feedback
const g = await ctx.newPage();
g.on("pageerror", (e) => errors.push(String(e)));
await g.goto(guestUrl);
await waitText(g, "here's who to find");
const cards = await g.$$eval("article", (a) => a.length);
log("guest sees", cards, "name tags");
const talked = await g.$("::-p-xpath(//button[normalize-space(.)='We talked'])");
await talked.click();
await waitText(g, "How useful was it?");
await (await g.$("button[aria-label='4 out of 5']")).click();
await waitText(g, "Saved.");
log("feedback saved");

// 6. Results
await page.bringToFront();
await page.reload();
await clickButton(page, "Results");
await waitText(page, "Conversations that happened");
const results = await textOf(page);
log("results:", results.match(/Conversations that happened\s+(\S+)/)?.[1], "| rating", results.match(/(\d\.\d) \/ 5/)?.[1]);

// 7. Bad links
await g.bringToFront();
await g.goto(BASE + "/m/not-a-token");
await waitText(g, "isn't valid");
await g.goto(BASE + "/nope");
await waitText(g, "This page doesn't exist");
log("bad links handled");

await page.setViewport({ width: 390, height: 844 });
await g.setViewport({ width: 390, height: 844 });
const overflow = await g.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
log("no horizontal overflow on mobile:", !overflow);

await browser.close();
const real = errors.filter((e) => !e.includes("404"));
if (real.length) {
  console.error(`\nConsole errors:\n${real.join("\n")}`);
  process.exit(1);
}
console.log("\nNo console errors.");
