// 4.33.2 (Yann, 28/11) : défaite au 1er tour saisie APRÈS que le 2e tour soit connu : le 2e tour et son rappel sont retirés
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "web", "app.js"), "utf8").match(/  function trCutLost\(t\) \{[\s\S]*?\n  \}\n/)[0];
const make = (S) => new Function("S", "E", "today", src + "; return trCutLost;")(S, { iso: () => "2026-11-28" }, () => 0);

test("1er tour ajouté en fin de liste, derrière le 2e tour : le 2e tour et son rappel partent", () => {
  const S = { plans: [{ id: "99", tour: "T1", day: "2026-11-29" }, { id: "5", day: "2026-12-01" }] };
  const t = { id: "T1", rounds: [{ id: "a", day: "2026-11-29", opp: { tid: "99" } }, { id: "b", day: "2026-11-28", res: "D", opp: {} }] };
  assert.strictEqual(make(S)(t), true);
  assert.deepStrictEqual(t.rounds.map((r) => r.id), ["b"]);
  assert.deepStrictEqual(t.cut.map((r) => r.id), ["a"]);
  assert.deepStrictEqual(S.plans.map((p) => p.id), ["5"]);
});
test("ordre habituel : inchangé", () => {
  const S = { plans: [{ id: "99", tour: "T1", day: "2026-11-29" }] };
  const t = { id: "T1", rounds: [{ id: "b", day: "2026-11-28", res: "D", opp: {} }, { id: "a", day: "2026-11-29", opp: { tid: "99" } }] };
  assert.strictEqual(make(S)(t), true);
  assert.deepStrictEqual(t.cut.map((r) => r.id), ["a"]);
  assert.strictEqual(S.plans.length, 0);
});
