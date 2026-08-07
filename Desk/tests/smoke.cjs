const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 834, height: 1194 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto("http://127.0.0.1:4173/Desk/editor.html");
  await page.waitForSelector("#saveStatus.saved, #saveStatus.error");
  assert.equal(await page.locator("#appShell").evaluate(element => element.classList.contains("sidebar-collapsed")), true);
  await page.click("#sidebarToggle");
  await page.click("#openTextDialog");
  await page.fill("#sourceTitle", "Fonte di prova");
  await page.fill("#sourceText", "Un testo salvato localmente.");
  await page.click("#confirmSource");
  await page.waitForSelector(".source-item");
  assert.equal(await page.locator(".source-item").count(), 1);
  assert.equal(await page.locator(".desk-card").count(), 1);
  await page.waitForTimeout(700);

  const legacy = await page.evaluate(() => DeskCommon.normalizeState({
    version: 1,
    cards: [{ id: "old", type: "text", title: "Vecchia", x: 10, y: 20, w: 300, h: 200, text: "contenuto" }],
    connectors: [], view: { scale: 1, tx: 60, ty: 60 }
  }));
  assert.equal(legacy.version, 2);
  assert.equal(legacy.sources.length, 1);
  assert.equal(legacy.cards[0].sourceId, legacy.sources[0].id);
  assert.equal(legacy.sources[0].text, "contenuto");

  await page.reload();
  await page.waitForSelector(".desk-card");
  assert.equal(await page.locator(".source-item").count(), 1);

  // Lo stato dell'editor è volutamente privato: verifichiamo il contratto tramite IndexedDB.
  const stored = await page.evaluate(() => DeskStorage.load());
  assert.equal(stored.version, 2);
  assert.equal(stored.sources.length, 1);
  assert.equal(stored.cards.length, 1);
  assert.equal(stored.cards[0].text, undefined);
  assert.equal(stored.sources[0].text, "Un testo salvato localmente.");

  await page.goto("http://127.0.0.1:4173/Desk/presentation.html");
  await page.waitForSelector(".desk-card");
  await page.click(".desk-card");
  await page.waitForSelector("#viewerDialog[open] .viewer-text");
  assert.match(await page.locator(".viewer-text").textContent(), /salvato localmente/);

  assert.deepEqual(errors, []);
  await browser.close();
  console.log("Desk smoke test: OK");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
