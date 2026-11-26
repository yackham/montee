// 4.18.1 : la nuit (21 h-8 h), l'iPhone prépare les notifications pour 8 h au lieu de les perdre
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = { console };
ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
for (const f of ["engine.js", "tenup.js", "summary.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "web", f), "utf8"), ctx, { filename: f });
ctx.MonteeTenup.rows = (p) => p.raw;
const m = (date, result, oppRank, score) => ({ ok: true, date, result, oppRank, score });
const pl = { folOnly: true, fol: [{ id: "1", d: { profil: { classement: "15/3" }, raw: [m("2026-11-28", "D", "15/3", "4-6 3-6"), m("2026-11-01", "V", "30")] } }] };
const st = JSON.stringify({ fol: { 1: { n: "Thomas Martin", r: "15/3", last: "2026-11-01" } }, np: {} });
const run = (opts) => JSON.parse(ctx.monteeSummary("MONTEE1" + JSON.stringify(pl), st, undefined, opts));

test("la nuit, sans opts (Android) : rien, comme avant", () => {
  ctx.__monteeNow = new Date("2026-11-29T23:10:00").getTime();
  assert.deepEqual(run(), {});
});

test("la nuit, iPhone : la notification est prête, marquée pour 8 h, et l'état avance", () => {
  ctx.__monteeNow = new Date("2026-11-29T03:40:00").getTime();
  const o = run({ at8: true });
  assert.equal(o.at8, true);
  assert.equal(o.more[0].title, "Thomas Martin a joué");
  assert.equal(JSON.parse(o.state).fol[1].last, "2026-11-28");
});

test("le jour : notification immédiate, pas de marque 8 h", () => {
  ctx.__monteeNow = new Date("2026-11-29T18:42:00").getTime();
  const o = run({ at8: true });
  assert.ok(!o.at8);
  assert.equal(o.more.length, 1);
});

test("la nuit sans nouveauté : pas de marque 8 h", () => {
  ctx.__monteeNow = new Date("2026-11-29T03:40:00").getTime();
  const o = JSON.parse(ctx.monteeSummary("MONTEE1" + JSON.stringify({ folOnly: true, fol: [{ id: "1", d: { profil: { classement: "15/3" }, raw: [m("2026-11-01", "V", "30")] } }] }), st, undefined, { at8: true }));
  assert.ok(!o.at8 && !o.more);
});
