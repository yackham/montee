// Montée : liaison Ten'Up (tenup.js) : fonctions de lecture
const test = require("node:test"), assert = require("node:assert");
const T = require("../web/tenup.js");
test("classements normalisés", () => {
  assert.strictEqual(T.normRank("15/1"), "15/1");
  assert.strictEqual(T.normRank("nc"), "NC");
  assert.strictEqual(T.normRank("30 / 2"), "30/2");
});
test("équipes du club : département d'un championnat (3.74.1, rapport de Davy)", () => {
  assert.deepStrictEqual(T.champDeps("+35 ANS MESSIEURS - 70/90"), ["70", "90"]);
  assert.deepStrictEqual(T.champDeps("CHPT/EQUIPES HIVER SENIORS MESSIEURS - 58"), ["58"]);
  assert.deepStrictEqual(T.champDeps("EQUIPES JEUNES - 11/14 ANS - FILLES - 58"), ["58"]);
  assert.deepStrictEqual(T.champDeps("CD57-Equipes Hiver DAMES 2026"), ["57"]);
  assert.strictEqual(T.champDeps("CHAMPIONNAT SENIORS BFC MESSIEURS"), null);
  assert.strictEqual(T.champDeps("Championnats de France Interclubs Seniors Dames 2026"), null);
  assert.strictEqual(T.champDeps("Challenge National par équipes 9 ans Filles - Limoges"), null);
});
test("le script injecté dans Ten'Up contient tout ce qu'il appelle", async () => {
  global.location = { origin: "https://exemple.invalid", hostname: "tenup.fft.fr", pathname: "/" };
  global.document = { title: "", querySelectorAll: () => [] };
  global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  const AF = Object.getPrototypeOf(async function () {}).constructor;
  for (const [k, a] of [["equipes", { all: 1, full: 1, club: "51900071", nomClub: "TC EXEMPLE", pid: "1", cids: [], known: {} }], ["equipes", { club: "51900071", nomClub: "TC EXEMPLE", pid: "1", known: {} }]]) {
    const out = String(await new AF(T.queryScript(k, a))());
    assert.ok(!/is not defined|ReferenceError/.test(out), out.slice(0, 200));
  }
});
