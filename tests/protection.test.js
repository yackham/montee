// Montée 4.11.8 : un adversaire déjà descendu il y a moins de 12 mois ne redescend pas (FFT, FAQ Classement Q12 et Q14).
// Retour testeur : un 15/5 annoncé « 30 en janvier » alors que Ten'Up l'avait dit protégé. Noms génériques.
// On teste la vraie fonction de app.js (oppProtUntil), extraite du fichier, avec le vrai moteur.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const E = require("../web/engine.js");
const T = require("../web/tenup.js");
const SRC = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
const grab = (name) => { const i = SRC.indexOf("  function " + name + "("); assert.ok(i > 0, name); const j = SRC.indexOf("\n  function ", i + 5); return SRC.slice(i, j) + "\n"; };
const TODAY = new Date(2026, 10, 26);
function load(S) {
  const code = grab("relOnOrBefore") + grab("seasonY") + grab("protAfter") + grab("oppProtUntil") + "\nreturn oppProtUntil;";
  return new Function("E", "T", "S", "today", code)(E, T, S, () => new Date(TODAY));
}
const JANV = E.nextRelease(new Date(2027, 0, 1));
const projJanv = (prot) => { const o = { today: TODAY, release: JANV }; if (prot) o.protectUntil = prot; return o; };

test("Ten'Up l'a dit protégé pour la sortie de novembre : toujours protégé en janvier", () => {
  const f = load({ matches: [], scout: {} });
  const u = f({ tid: "42", rank: "15/5", protAt: "2026-11-03" });
  assert.ok(u && u > JANV, "protégé au-delà de janvier");
  // au plus tard descendu à la sortie d'octobre 2026 : protégé jusqu'à celle d'octobre 2027 comprise
  assert.ok(u > E.nextRelease(new Date(2027, 9, 1)) && u < E.nextRelease(new Date(2027, 10, 1)));
});

test("vu 15/4 en mars, puis 15/5 en septembre : protégé jusqu'à la sortie de septembre 2027 au moins", () => {
  const S = { matches: [], scout: { a: { rows: [{ oid: "42", date: "2026-03-10", oppRank: "15/4" }, { oid: "42", date: "2026-09-20", oppRank: "15/5" }] } } };
  const u = load(S)({ tid: "42", rank: "15/5" });
  assert.ok(u > E.nextRelease(new Date(2027, 8, 1)));
});

test("le moteur ne le fait plus descendre en janvier quand il est protégé", () => {
  const u = load({ matches: [], scout: {} })({ tid: "42", rank: "15/5", protAt: "2026-11-03" });
  const pr = E.project([], E.idx("15/5"), "H", projJanv(u));
  assert.notStrictEqual(pr.status, "descente");
});

test("remonté depuis sa descente : plus protégé (le compteur repart de zéro)", () => {
  const S = { matches: [], scout: { a: { rows: [{ oid: "42", date: "2026-02-10", oppRank: "15/4" }, { oid: "42", date: "2026-05-10", oppRank: "30" }] } } };
  assert.strictEqual(load(S)({ tid: "42", rank: "15/5" }), null);
});

test("aucune trace de descente : pas de protection inventée", () => {
  const S = { matches: [], scout: { a: { rows: [{ oid: "42", date: "2026-02-10", oppRank: "15/5" }] } } };
  assert.strictEqual(load(S)({ tid: "42", rank: "15/5" }), null);
});

test("descente vieille de plus d'un an : plus protégé", () => {
  const S = { matches: [], scout: { a: { rows: [{ oid: "42", date: "2025-06-10", oppRank: "15/4" }, { oid: "42", date: "2025-09-10", oppRank: "15/5" }] } } };
  assert.strictEqual(load(S)({ tid: "42", rank: "15/5" }), null);
});
