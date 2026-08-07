const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");

const context = {
  window: {},
  self: { crypto: webcrypto },
  crypto: webcrypto,
  structuredClone,
  URL,
  Blob,
  console,
  setTimeout,
  clearTimeout
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/common.js"), "utf8"), context);
const C = context.window.DeskCommon;

const legacy = C.normalizeState({
  version: 1,
  cards: [
    { id: "a", type: "text", title: "Fonte", x: 10, y: 20, w: 320, h: 200, text: "contenuto" },
    { id: "b", type: "text", title: "Fonte", x: 400, y: 20, w: 320, h: 200, text: "contenuto" }
  ],
  connectors: [{ id: "c", a: "a", b: "b", color: "#123456" }],
  view: { scale: 99, tx: 0, ty: 0 }
});
assert.equal(legacy.version, 2);
assert.equal(legacy.sources.length, 1, "Le card legacy identiche devono condividere una fonte");
assert.equal(legacy.cards[0].sourceId, legacy.cards[1].sourceId);
assert.equal(legacy.sources[0].text, "contenuto");
assert.equal(legacy.connectors.length, 1);
assert.equal(legacy.view.scale, 3.5, "Lo zoom importato deve essere limitato");

const unsafe = C.normalizeState({
  version: 2,
  cards: [{ id: "x", sourceId: "s", type: "web", title: "X", x: 0, y: 0, w: 300, h: 200 }],
  connectors: [],
  sources: [{ id: "s", type: "web", title: "X", url: "javascript:alert(1)" }]
});
assert.equal(unsafe.sources[0].url, undefined, "Gli URL non HTTP(S) devono essere rimossi");

const serialized = C.serializableState(legacy);
assert.equal(serialized.version, 2);
assert.ok(serialized.updatedAt);
assert.equal(serialized.cards[0].text, undefined, "Il contenuto deve restare nella fonte, non essere duplicato nella card");

const fit = C.fitView(legacy.cards, { getBoundingClientRect: () => ({ width: 1000, height: 700 }) }, { min: .25, max: 3 });
assert.ok(fit.scale >= .25 && fit.scale <= 3);
assert.ok(Number.isFinite(fit.tx) && Number.isFinite(fit.ty));

assert.match(C.connectorPath(legacy.cards[0], legacy.cards[1]), /^M .+ C .+$/);
assert.throws(() => C.normalizeState({ version: 2, sources: [] }), /valido/);

console.log("Desk unit test: OK");
