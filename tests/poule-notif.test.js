// 4.33.1 (Yann, 28/11) : « Ta poule a bougé » seulement pour un match de la poule, et la notif ouvre le tournoi
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = { console };
ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
for (const f of ["engine.js", "tenup.js", "summary.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "web", f), "utf8"), ctx, { filename: f });
ctx.MonteeTenup.rows = (p) => p.raw;
const r = (comp) => ({ ok: true, date: "2026-11-28", result: "V", oppRank: "15/4", score: "6-4 6-3", opp: "KASTL Yohann", oid: "22", comp });
const st = JSON.stringify({ np: { quiet: false }, pool: [{ id: "t9", t: "Championnat individuel Belfort", lo: "2026-11-01", seen: [], mem: [{ id: "11", n: "Paul Riche", p: 77 }, { id: "22", n: "Yohann Kastl", p: null }] }] });
const run = (comp) => { const o = JSON.parse(ctx.monteeSummary("MONTEE1" + JSON.stringify({ folOnly: true, fol: [{ id: "11", d: { raw: [r(comp)] } }] }), st, "2026-11-28")); return (o.more || []).filter((n) => n.title === "Ta poule a bougé"); };

test("match joué dans un autre tournoi : pas de « Ta poule a bougé »", () => {
  assert.strictEqual(run("TOURNOI SG HERICOURT").length, 0);
});
test("match de la poule : notif, qui ouvre le tournoi", () => {
  const n = run("Championnat individuel Belfort");
  assert.strictEqual(n.length, 1);
  assert.strictEqual(n[0].url, "montee://open/tournoi/t9");
});
test("épreuve inconnue (pas de nom) : on garde la notif", () => {
  assert.strictEqual(run("").length, 1);
});
