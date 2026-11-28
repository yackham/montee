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
