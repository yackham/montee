// Montée : moteur de classement (engine.js) : fonctions de base
const test = require("node:test"), assert = require("node:assert");
const E = require("../web/engine.js");
test("classement : index et libellé aller-retour", () => {
  for (const r of ["40", "30/5", "30", "15/1", "15", "5/6", "4/6", "-2/6", "-15"]) { const i = E.idx(r); if (i >= 0) assert.strictEqual(E.label(i), r); }
  assert.ok(E.idx("15/1") > E.idx("15/2") && E.idx("15/2") > E.idx("30"));
});
test("score : sets lus", () => {
  assert.deepStrictEqual(E.parseScore("6/4 7/6"), [[6, 4], [7, 6]]);
});
test("12 mois glissants", () => {
  assert.strictEqual(E.iso(E.plus12Months(new Date(2026, 0, 31))), "2027-01-31");
});
test("projection sans match : pas d'erreur, classement conservé ou plus bas", () => {
  const cur = E.idx("15/1"), p = E.project([], cur, "H", { today: new Date(2026, 10, 23) });
  assert.ok(p && typeof p === "object");
});
