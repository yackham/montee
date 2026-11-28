// Montée 4.28.0 : le match point par point compté à la montre (play.js), un seul calcul pour la fiche et Ace.
// Match d'exemple simulé (4-6 6-4 1-6), noms génériques : aucune donnée réelle.
const test = require("node:test"), assert = require("node:assert");
const P = require("../web/play.js");
const F = require("./point-par-point.fixture.json");

test("le replay retrouve le score, les jeux tenus et les breaks", () => {
  const r = P.read(F.ev, 0, "full", F.evT);
  assert.deepStrictEqual(r.sets.map((s) => s.me + "-" + s.him), ["4-6", "6-4", "1-6"]);
  assert.deepStrictEqual(r.held, { n: 14, won: 5 });
  assert.deepStrictEqual(r.brk, { n: 13, won: 6 });
  assert.strictEqual(r.srv.n + r.ret.n, r.n);
});

test("le 1er point de tes jeux de service : jeux tenus selon qu'il est gagné ou perdu", () => {
  const r = P.read(F.ev, 0, "full", F.evT);
  assert.strictEqual(r.first.won.n + r.first.lost.n, r.held.n);
  assert.strictEqual(r.first.won.held + r.first.lost.held, r.held.won);
});

test("une double faute est un point pour l'autre", () => {
  const R = P.replay("ff" + "mmmm", 0, "full");
  assert.strictEqual(R.pts[0].df, true); assert.strictEqual(R.pts[0].w, 1);
});

test("la longueur des échanges : seulement avec l'heure de chaque touche, trois paquets égaux", () => {
  const r = P.read(F.ev, 0, "full", F.evT);
  assert.ok(r.rally && r.rally.n >= 30);
  assert.strictEqual(r.rally.short.n, r.rally.long.n);
  assert.ok(r.rally.long.pct > r.rally.short.pct);
  assert.strictEqual(P.read(F.ev, 0, "full", null).rally, null);
  assert.strictEqual(P.read(F.ev, 0, "full", F.evT.slice(1)).rally, null, "horodatage incomplet : pas d'estimation");
});

test("une pause ou des points saisis d'un coup ne comptent pas comme des échanges", () => {
  const T = F.evT.slice(); for (let i = 40; i < T.length; i++) T[i] += 600; // une pause de 10 min
  const a = P.read(F.ev, 0, "full", F.evT).rally, b = P.read(F.ev, 0, "full", T).rally;
  assert.ok(b.n === a.n || b.n === a.n - 1, "au plus le point de la pause est écarté");
  const T2 = F.evT.slice(); for (let i = 0; i < T2.length; i++) T2[i] = i; // tout saisi d'un coup, 1 s d'écart
  assert.strictEqual(P.read(F.ev, 0, "full", T2).rally, null);
});

test("trop peu de points : pas de lecture", () => {
  assert.strictEqual(P.read("mmmmllll", 0, "full", null), null);
});

// 4.30.0 : Ace qui tape juste
test("balles de break : sauvées à ton service, converties au retour, cohérentes avec les jeux", () => {
  const r = P.read(F.ev, 0, "full", F.evT);
  assert.ok(r.bp.saved.n >= r.held.n - r.held.won); // chaque jeu perdu au service a eu au moins une balle de break
  assert.ok(r.bp.conv.won >= r.brk.won); // chaque break est une balle de break convertie
  assert.strictEqual(r.bp.saved.n - r.bp.saved.won >= r.held.n - r.held.won, true);
});

test("la pression : chaque point de ton service (hors tie-break, hors 15-15) est dans une seule colonne", () => {
  const r = P.read(F.ev, 0, "full", F.evT), R = P.replay(F.ev, 0, "full").pts.filter((p) => p.s === 0 && !p.tb);
  const tot = Object.values(r.press).reduce((a, x) => a + x[1], 0), f15 = R.filter((p) => !p.bp && p.sc[0] === 1 && p.sc[1] === 1).length;
  assert.strictEqual(tot + f15, R.length);
  assert.strictEqual(P.pressKey({ sc: [2, 3], bp: true }), "bp");
  assert.strictEqual(P.pressKey({ sc: [3, 3], bp: false }), "deuce");
  assert.strictEqual(P.pressKey({ sc: [0, 0], bp: false }), "zero");
});

test("le tournant : au début du 3e set, juste après un set gagné, sur ton service", () => {
  const r = P.read(F.ev, 0, "full", F.evT);
  assert.ok(r.turn);
  assert.strictEqual(r.turn.set, 2); assert.strictEqual(r.turn.first, true); assert.strictEqual(r.turn.after, "won"); assert.strictEqual(r.turn.me, true); assert.strictEqual(r.turn.w, 1);
});

test("la courbe : un point par point joué, finit sur l'écart de points du match", () => {
  const r = P.read(F.ev, 0, "full", F.evT);
  assert.strictEqual(r.curve.length, r.n);
  assert.strictEqual(r.curve[r.curve.length - 1][1], 2 * r.all.won - r.n);
  assert.ok(r.curve.every((c) => c[0] != null));
  assert.strictEqual(r.reb.n >= r.reb.won, true);
});
