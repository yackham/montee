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

test("Ten'Up fait foi : dateFinPEC = dernière sortie qui compte le match", () => {
  const m = V("2026-02-16", "15/3");
  // sans date Ten'Up : 12 mois jour pour jour, premier jour compris → compté le 2 févr. 2027, sorti le 2 mars
  assert.strictEqual(E.iso(E.leaveDate(m)), "2027-03-02");
  assert.strictEqual(E.windowMatches([m], new Date(2027, 1, 2), TODAY).length, 1);
  assert.strictEqual(E.windowMatches([m], new Date(2027, 2, 2), TODAY).length, 0);
  // Ten'Up : dernière sortie qui le compte le 5 janv. 2027 → plus compté le 2 févr.
  const t = Object.assign({}, m, { finPec: "2027-01-05" });
  assert.strictEqual(E.iso(E.leaveDate(t)), "2027-02-02");
  assert.strictEqual(E.windowMatches([t], new Date(2027, 0, 5), TODAY).length, 1);
  assert.strictEqual(E.windowMatches([t], new Date(2027, 1, 2), TODAY).length, 0);
  // sortie décalée d'un jour (3 nov. au lieu du 2) : on compare au mois
  const u = Object.assign({}, V("2026-11-17", "15/4"), { finPec: "2027-11-03" });
  assert.strictEqual(E.windowMatches([u], new Date(2027, 10, 2), new Date(2027, 10, 1)).length, 1);
  assert.strictEqual(E.windowMatches([u], new Date(2027, 11, 7), new Date(2027, 11, 1)).length, 0);
  const out = E.dropOuts([t], CUR, "H", { today: new Date(2027, 0, 10), release: new Date(2027, 1, 2) });
  assert.strictEqual(out.length, 1);
});

test("12 mois : le match joué le jour anniversaire de la sortie compte encore (relevé Ten'Up)", () => {
  // sortie du 5 janv. 2027 : matchs du 5 janv. 2026 au 4 janv. 2027
  const a = V("2026-01-05", "15/4"), b = V("2026-01-03", "15/4");
  const w = E.windowMatches([a, b], new Date(2027, 0, 5), new Date(2027, 0, 4));
  assert.deepStrictEqual(w.map((m) => m.id), [a.id]);
});

// Cas réel relevé sur Ten'Up le 23/11/2026 (simulation officielle mois par mois), anonymisé : dates et classements seuls
test("cas réel : même bilan que la simulation Ten'Up en déc., janv., févr. et mars", () => {
  const S3 = "INDIVIDUELS 2026 - SENIORS 3S - 90", SP = "INDIVIDUELS 2026 - SÉNIORS+ - 90";
  const M = (date, r, rank, kind, comp, x) => Object.assign({ id: "r" + (++n), date, result: r, oppRank: rank, kind: kind || "tournoi", comp: comp || "" }, x || {});
  const ms = [
    M("2026-11-17", "V", "30/4", "champ", SP), M("2026-11-17", "V", "15/4", "champ", SP), M("2026-10-04", "V", "30", "equipe"), M("2026-04-17", "V", "30", "equipe"),
    M("2026-03-27", "V", "30", "equipe"), M("2026-03-13", "V", "15/4", "equipe"), M("2026-02-24", "V", "15/5", "equipe"), M("2026-02-16", "V", "15/3", "champ", SP),
    M("2026-01-29", "V", "15/5", "champ", S3), M("2026-01-05", "V", "15/4", "champ", S3), M("2025-12-31", "V", "30", "champ", S3), M("2025-12-27", "V", "15/4", "champ", S3),
    M("2026-10-25", "D", "15/5"), M("2026-10-18", "D", "30", "equipe"), M("2026-10-09", "D", "15/5"), M("2026-06-07", "D", "15/2", "equipe"), M("2026-05-31", "D", "15/3", "equipe"),
    M("2026-05-03", "D", "15/4", "equipe"), M("2026-03-06", "D", "15/2", "equipe"), M("2026-02-28", "D", "15/4", "champ", S3, { wo: true }),
    M("2026-02-27", "D", "15/3", "champ", S3, { wo: true }), M("2026-01-28", "D", "30/1", "tournoi", "", { wo: true }), M("2026-01-03", "D", "15/4", "champ", S3)
  ].concat(["2026-10-18", "2026-10-04", "2026-04-17", "2026-03-06"].map((d) => M(d, "V", "30", "equipe", "", { dbl: true, officialPts: 1, oppRanks: ["30", "30"] })));
  const at = (y, mo, d, rank) => E.bilanAt(E.windowMatches(ms, new Date(y, mo, d), TODAY), E.idx(rank), "H", CUR);
  const dec = at(2026, 11, 1, "15/4"), jan = at(2027, 0, 5, "15/4"), feb = at(2027, 1, 2, "15/4");
  assert.deepStrictEqual([dec.total, jan.total, feb.total], [494, 449, 349]);
  assert.deepStrictEqual([dec.ve, jan.ve, feb.ve], [1, 0, -2]); // 3 WO : aucune pénalité
  assert.deepStrictEqual([dec.bonusCh, jan.bonusCh, feb.bonusCh], [60, 55, 45]); // seniors+ : 15 pts
  assert.deepStrictEqual([at(2026, 11, 1, "15/3").total, at(2026, 11, 1, "15/2").total, at(2027, 2, 2, "15/5").total], [299, 204, 304]);
  // 4.5.4 (Davy) : le détail des bonus (Tes bonus) vient du même calcul : 15 en seniors+, y compris en réserve
  const cb = E.champBonuses(E.windowMatches(ms, new Date(2026, 11, 1), TODAY), E.idx("15/4"));
  assert.deepStrictEqual(cb.map((x) => [x.m.date, x.val, x.on]), [
    ["2025-12-27", 20, true], ["2025-12-31", 20, true], ["2026-01-05", 20, true], ["2026-01-29", 20, false],
    ["2026-02-16", 15, false], ["2026-11-17", 15, false], ["2026-11-17", 15, false]]);
  assert.strictEqual(cb.reduce((a, x) => a + x.pts, 0), dec.bonusCh);
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
