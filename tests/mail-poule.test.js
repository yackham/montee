// Montée 4.21.2 : le mail de poule du comité, lu en entier même quand un numéro est mal ponctué (« +3.36… / mail »).
// Retour de Yann : un joueur sur cinq ignoré. Noms et numéros d'exemple, génériques.
// On teste la vraie fonction de app.js (mailParse), extraite du fichier.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const E = require("../web/engine.js");
const T = require("../web/tenup.js");
const SRC = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
const grab = (name) => { const i = SRC.indexOf("  function " + name + "("); assert.ok(i > 0, name); const j = SRC.indexOf("\n  function ", i + 5); return SRC.slice(i, j) + "\n"; };
const line = (start) => { const i = SRC.indexOf(start); assert.ok(i > 0, start); return SRC.slice(i, SRC.indexOf("\n", i)) + "\n"; };
function load(me) {
  const code = line("  var MOIS_RX =") + line("  var RK_RX =") + line("  var TEL_RX =") +
    grab("telNorm") + grab("tableParse").replace(/\n  \/\/[^\n]*\n  \/\/[^\n]*\n$/, "\n") + grab("mailParse") + grab("nameTokens") +
    "\nreturn { mailParse: mailParse, telNorm: telNorm };";
  const S = { tenup: { me: me || {} }, profile: {} };
  return new Function("E", "T", "S", "today", "dN", "MOIS", code)(E, T, S, () => new Date(2026, 10, 26), (d) => d.getDate(), ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]);
}

const MAIL = `CHAMPIONNATS INDIVIDUELS SENIORS 3ème Série  2027
CD 90

Simples Messieurs - Poule 6

Pour chaque rencontre dans le fichier joint, le joueur de gauche reçoit celui de droite.

Les coordonnées de vos adversaires sont ci-dessous :

Julien Moreau - 06.12.34.56.78
Thomas Martin - +3.36.11.22.33.44 / thomas.martin@exemple.fr
Lucas Bernard - 06.23.45.67.89
Hugo Petit - 06.34.56.78.90
Paul Durand - 07.45.67.89.01

ATTENTION  : la date limite pour envoyer les résultats est le 18 Janvier 2027

https://tally.so/r/EXEMPLE`;

test("le joueur au numéro « +3.36… / mail » n'est plus ignoré", () => {
  const P = load().mailParse(MAIL);
  assert.deepStrictEqual(P.ppl.map((x) => x.name), ["Julien Moreau", "Thomas Martin", "Lucas Bernard", "Hugo Petit", "Paul Durand"]);
  assert.strictEqual(P.ppl[1].tel, "0611223344");
  assert.strictEqual(P.ppl[0].tel, "0612345678");
  assert.strictEqual(P.poule, "6");
  assert.strictEqual(P.to, "2027-01-18");
  assert.strictEqual(P.resUrl, "https://tally.so/r/EXEMPLE");
});

test("toutes les écritures courantes d'un numéro", () => {
  const { mailParse } = load();
  const cas = {
    "Jean Dupont - 06 12 34 56 78": "0612345678",
    "Jean Dupont : 06-12-34-56-78": "0612345678",
    "Jean Dupont - 0612345678": "0612345678",
    "Jean Dupont - +33 6 12 34 56 78": "0612345678",
    "Jean Dupont - +33612345678 / jean@exemple.fr": "0612345678",
    "Jean Dupont - +33 (0)6 12 34 56 78": "0612345678",
    "Jean Dupont - +33.6.12.34.56.78": "0612345678",
    "Jean Dupont - +41 79 123 45 67": "+41791234567",
    "Jean Dupont - 06.12.34.56.78 / 07.11.22.33.44": "0612345678",
  };
  for (const [l, tel] of Object.entries(cas)) {
    const P = mailParse("Poule 2\n" + l);
    assert.strictEqual(P.ppl.length, 1, l);
    assert.strictEqual(P.ppl[0].name, "Jean Dupont", l);
    assert.strictEqual(P.ppl[0].tel, tel, l);
  }
});

test("une date ou une année n'est pas prise pour un numéro", () => {
  const P = load().mailParse("Poule 3\nDate limite 18/01/2027\nRésultats 2027 CD 90\nJean Dupont - 06 12 34 56 78");
  assert.deepStrictEqual(P.ppl.map((x) => x.name), ["Jean Dupont"]);
});

test("toi reconnu même avec un numéro international", () => {
  const P = load({ prenom: "Thomas", nom: "Martin" }).mailParse(MAIL);
  assert.ok(P.ppl.find((x) => x.name === "Thomas Martin").me);
});
