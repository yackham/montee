// Montée : « Points à défendre » calé sur Ten'Up (3.78.1, retour testeur)
// Une victoire qui sort est remplacée par la meilleure hors quota (relais), les bonus partent ou reviennent,
// et la date de fin de prise en compte de Ten'Up (dateFinPEC) fait foi. Noms génériques.
const test = require("node:test"), assert = require("node:assert");
const E = require("../web/engine.js");
const T = require("../web/tenup.js");

const CUR = E.idx("15/4");
let n = 0;
const V = (date, rank, x) => Object.assign({ id: "m" + (++n), date, oppRank: rank, result: "V", opp: "Joueur " + n }, x || {});
const D = (date, rank, x) => Object.assign({ id: "m" + (++n), date, oppRank: rank, result: "D", opp: "Joueur " + n }, x || {});

// 12 victoires (8 comptées au plus à 15/4 avant ajustement), dont des 15/4 qui vont sortir et des 30/1 hors quota
const MATCHES = [
  V("2025-12-20", "15/4"), V("2026-01-10", "15/4"), V("2026-01-25", "15/5"), V("2026-02-16", "15/3"),
  V("2026-03-08", "15/4"), V("2026-04-12", "15/4"), V("2026-05-03", "15/5"), V("2026-06-14", "15/4"),
  V("2026-07-05", "30"), V("2026-08-23", "30/1"), V("2026-09-13", "30/1"), V("2026-10-04", "30"), V("2026-10-18", "30"), V("2026-11-01", "30/1"),
  D("2026-01-18", "15/2"), D("2026-02-01", "15/3")
];
const TODAY = new Date(2026, 10, 23);
function series(ms) {
  let rel = E.nextRelease(TODAY); const out = [];
  for (let k = 0; k < 7; k++) { out.push({ rel, b: E.bilanAt(E.windowMatches(ms, rel, TODAY), CUR, "H", CUR) }); rel = E.nextRelease(rel); }
  return out;
}

test("chaque mois, la liste s'additionne exactement à la baisse du bilan (relais et bonus compris)", () => {
  const s = series(MATCHES);
  for (let i = 1; i < s.length; i++) {
    const d = E.releaseDiff(s[i - 1].b, s[i].b), sum = d.reduce((a, r) => a + r.pts, 0);
    assert.strictEqual(sum, s[i].b.total - s[i - 1].b.total, "sortie " + E.iso(s[i].rel));
  }
});

test("une victoire qui sort est remplacée par la meilleure hors quota (prend le relais)", () => {
  const s = series(MATCHES);
  const all = [];
  for (let i = 1; i < s.length; i++) E.releaseDiff(s[i - 1].b, s[i].b).forEach((r) => all.push(r));
  const outs = all.filter((r) => r.k === "out"), ins = all.filter((r) => r.k === "in");
  assert.ok(outs.length >= 1, "des victoires sortent");
  assert.ok(ins.length >= 1, "au moins une victoire prend le relais");
  // le relais réduit la perte : la baisse est inférieure à la somme brute des victoires qui sortent
  const gross = outs.reduce((a, r) => a - r.pts, 0), net = s[0].b.total - s[s.length - 1].b.total;
  assert.ok(net < gross, "net " + net + " < brut " + gross);
});

test("le bonus sans défaite significative qui revient (défaite qui sort) apparaît en plus", () => {
  // 10 matchs dont une seule défaite significative (contre un 15/4) qui sort en janvier
  const ms = [D("2025-12-28", "15/4")];
  for (let k = 0; k < 10; k++) ms.push(V("2026-0" + (1 + (k % 9)) + "-1" + (k % 9), "15/5"));
  const r0 = new Date(2026, 11, 1), r1 = new Date(2027, 0, 5);
  const b0 = E.bilanAt(E.windowMatches(ms, r0, TODAY), CUR, "H", CUR), b1 = E.bilanAt(E.windowMatches(ms, r1, TODAY), CUR, "H", CUR);
  const d = E.releaseDiff(b0, b1), sd = d.filter((r) => r.k === "bonus" && r.key === "bonusSD")[0];
  assert.ok(sd && sd.pts > 0, "bonus qui revient");
  assert.strictEqual(d.reduce((a, r) => a + r.pts, 0), b1.total - b0.total);
});

test("bonus championnat (indivs) perdu quand la victoire sort", () => {
  const ms = [V("2025-12-20", "15/4", { kind: "champ" }), V("2026-03-01", "15/4"), V("2026-04-01", "15/4")];
  const b0 = E.bilanAt(E.windowMatches(ms, new Date(2026, 11, 1), TODAY), CUR, "H", CUR);
  const b1 = E.bilanAt(E.windowMatches(ms, new Date(2027, 0, 5), TODAY), CUR, "H", CUR);
  const d = E.releaseDiff(b0, b1);
  assert.ok(d.some((r) => r.k === "bonus" && r.key === "bonusCh" && r.pts < 0));
  assert.ok(d.some((r) => r.k === "out"));
  assert.strictEqual(d.reduce((a, r) => a + r.pts, 0), b1.total - b0.total);
});

test("Ten'Up fait foi : dateFinPEC décide quand le match sort", () => {
  const m = V("2026-02-16", "15/3");
  // sans date Ten'Up : 12 mois → encore compté le 2 févr. 2027, sorti le 2 mars
  assert.strictEqual(E.iso(E.leaveDate(m)), "2027-02-16");
  assert.strictEqual(E.windowMatches([m], new Date(2027, 1, 2), TODAY).length, 1);
  // Ten'Up dit qu'il sort le 31 janv. 2027 : plus compté à la sortie du 2 févr.
  const t = Object.assign({}, m, { finPec: "2027-01-31" });
  assert.strictEqual(E.iso(E.leaveDate(t)), "2027-01-31");
  assert.strictEqual(E.windowMatches([t], new Date(2027, 1, 2), TODAY).length, 0);
  assert.strictEqual(E.windowMatches([t], new Date(2027, 0, 5), TODAY).length, 1);
  // et les victoires qui sortent avant la prochaine sortie suivent la même date
  const out = E.dropOuts([t], CUR, "H", { today: new Date(2027, 0, 10), release: new Date(2027, 1, 2) });
  assert.strictEqual(out.length, 1);
});

test("import Ten'Up : dateFinPEC lue (simple et double), formats ISO ou jj/mm/aaaa", () => {
  const raw = [
    { date: "2026-02-16T00:00:00", dateFinPEC: "16/02/2027", victoireUtilisateur: true, adversaires: [{ prenom: "Julien", nom: "Moreau", classementLibelle: "15/3" }], sets: [] },
    { date: "2026-03-01", dateFinPEC: "2027-03-01T00:00:00", victoireUtilisateur: false, adversaires: [{ prenom: "Thomas", nom: "M", classementLibelle: "15/4" }], sets: [] }
  ];
  const r = T.rows({ raw });
  assert.strictEqual(r[0].finPec, "2027-02-16");
  assert.strictEqual(r[1].finPec, "2027-03-01");
  const sans = T.rows({ raw: [{ date: "2026-02-16", victoireUtilisateur: true, adversaires: [{ nom: "X", classementLibelle: "15/3" }] }] });
  assert.strictEqual(sans[0].finPec, undefined);
});
