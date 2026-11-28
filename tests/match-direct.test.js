// Montée 4.32.0 : le match saisi au changement de côté (play.js games / gameState), un seul calcul pour la fiche et Ace.
// Match d'exemple (6-3 4-6, super tie-break 10-7), noms génériques : aucune donnée réelle.
const test = require("node:test"), assert = require("node:assert");
const P = require("../web/play.js");
const G = { f: 0, fmt: "stb", s: [{ g: "101111001" }, { g: "0110010010" }, { g: "", tb: [10, 7] }] };

test("score, jeux tenus et breaks depuis l'ordre des jeux", () => {
  const A = P.games(G);
  assert.strictEqual(A.score, "6-3 4-6 10-7");
  assert.deepStrictEqual(A.held, [6, 10]);
  assert.deepStrictEqual(A.brk, [4, 9]);
  assert.strictEqual(A.n, 19);
});

test("le service alterne à chaque jeu, en partant du 1er serveur", () => {
  const A = P.games(G);
  assert.deepStrictEqual(A.games.slice(0, 4).map((g) => g.srv), [0, 1, 0, 1]);
  assert.strictEqual(A.games[9].srv, 1); // 9 jeux au 1er set : il sert en premier au 2e
});

test("état en cours : fin de set, super tie-break attendu, match fini", () => {
  assert.strictEqual(P.gameState({ f: 0, fmt: "stb", s: [{ g: "101111001" }] }).setOver, true);
  assert.strictEqual(P.gameState({ f: 0, fmt: "stb", s: [{ g: "101111001" }, { g: "0110010010" }] }).stbNext, true);
  const st = P.gameState(G);
  assert.strictEqual(st.over, true); assert.strictEqual(st.sw, 2);
});
