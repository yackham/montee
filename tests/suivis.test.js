// 4.17.0 : un joueur suivi = tous ses résultats notifiés, regroupés s'ils sont plusieurs, hors limite « Combien »
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = { console };
ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
for (const f of ["engine.js", "tenup.js", "summary.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "web", f), "utf8"), ctx, { filename: f });
const T = ctx.MonteeTenup;
// fausse fiche : T.rows lit d.raw, ici directement la liste des matchs
T.rows = (p) => p.raw;
ctx.__monteeNow = new Date("2026-11-29T18:42:00").getTime();
const m = (date, result, oppRank, score) => ({ ok: true, date, result, oppRank, score });
const st = (fol, np) => JSON.stringify({ fol, np: np || {} });
const run = (pl, s) => JSON.parse(ctx.monteeSummary("MONTEE1" + JSON.stringify(pl), s));

test("une défaite d'un joueur suivi est notifiée", () => {
  const pl = { folOnly: true, fol: [{ id: "1", d: { profil: { classement: "15/3" }, raw: [m("2026-11-28", "D", "15/3", "4-6 3-6"), m("2026-11-01", "V", "30", "6-1 6-1")] } }] };
  const o = run(pl, st({ 1: { n: "Thomas Martin", r: "15/3", last: "2026-11-01" } }));
  assert.equal(o.more.length, 1);
  assert.equal(o.more[0].title, "Thomas Martin a joué");
  assert.match(o.more[0].body, /Défaite 4-6 3-6 contre un 15\/3/);
  assert.equal(JSON.parse(o.state).fol[1].last, "2026-11-28");
});

test("rien de neuf : pas de notification", () => {
  const pl = { folOnly: true, fol: [{ id: "1", d: { profil: { classement: "15/3" }, raw: [m("2026-11-01", "V", "30")] } }] };
  const o = run(pl, st({ 1: { n: "Thomas Martin", r: "15/3", last: "2026-11-01" } }));
  assert.ok(!o.more);
});

test("première lecture (pas encore de date connue) : pas de rafale", () => {
  const pl = { folOnly: true, fol: [{ id: "1", d: { profil: { classement: "15/3" }, raw: [m("2026-11-28", "D", "15/3")] } }] };
  const o = run(pl, st({ 1: { n: "Thomas Martin", r: "15/3", last: "" } }));
  assert.ok(!o.more);
});

test("plusieurs joueurs : une seule notification, même en « L'essentiel »", () => {
  const pl = { folOnly: true, fol: [
    { id: "1", d: { profil: { classement: "15/3" }, raw: [m("2026-11-28", "D", "15/3"), m("2026-11-01", "V", "30")] } },
    { id: "2", d: { profil: { classement: "15/4" }, raw: [m("2026-11-28", "V", "15/5"), m("2026-11-01", "V", "30")] } },
    { id: "3", d: { profil: { classement: "15/2" }, raw: [m("2026-11-27", "D", "15/2"), m("2026-11-01", "V", "30")] } }] };
  const o = run(pl, st({ 1: { n: "Thomas Martin", r: "15/3", last: "2026-11-01" }, 2: { n: "Hugo Leroy", r: "15/4", last: "2026-11-01" }, 3: { n: "Lucas Bernard", r: "15/3", last: "2026-11-01" } }, { lvl: "ess" }));
  assert.equal(o.more.length, 1);
  assert.equal(o.more[0].title, "3 joueurs que tu suis ont joué");
  assert.equal(o.more[0].body, "Thomas M. perd contre un 15/3 · Hugo L. bat un 15/5 · Lucas B. monte 15/2.");
});

test("réglage « Joueurs suivis » éteint : rien", () => {
  const pl = { folOnly: true, fol: [{ id: "1", d: { profil: { classement: "15/3" }, raw: [m("2026-11-28", "D", "15/3")] } }] };
  const o = run(pl, st({ 1: { n: "Thomas Martin", r: "15/3", last: "2026-11-01" } }, { fol: false }));
  assert.ok(!o.more);
});
