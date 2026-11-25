// Montée : liaison Ten'Up (tenup.js) : fonctions de lecture
const test = require("node:test"), assert = require("node:assert");
const T = require("../web/tenup.js");
test("classements normalisés", () => {
  assert.strictEqual(T.normRank("15/1"), "15/1");
  assert.strictEqual(T.normRank("nc"), "NC");
  assert.strictEqual(T.normRank("30 / 2"), "30/2");
});
test("équipes du club : département d'un championnat (3.74.1, rapport de Davy)", () => {
  assert.deepStrictEqual(T.champDeps("+35 ANS MESSIEURS - 70/90"), ["70", "90"]);
  assert.deepStrictEqual(T.champDeps("CHPT/EQUIPES HIVER SENIORS MESSIEURS - 58"), ["58"]);
  assert.deepStrictEqual(T.champDeps("EQUIPES JEUNES - 11/14 ANS - FILLES - 58"), ["58"]);
  assert.deepStrictEqual(T.champDeps("CD57-Equipes Hiver DAMES 2026"), ["57"]);
  assert.strictEqual(T.champDeps("CHAMPIONNAT SENIORS BFC MESSIEURS"), null);
  assert.strictEqual(T.champDeps("Championnats de France Interclubs Seniors Dames 2026"), null);
  assert.strictEqual(T.champDeps("Challenge National par équipes 9 ans Filles - Limoges"), null);
});
test("le script injecté dans Ten'Up contient tout ce qu'il appelle", async () => {
  global.location = { origin: "https://exemple.invalid", hostname: "tenup.fft.fr", pathname: "/" };
  global.document = { title: "", querySelectorAll: () => [] };
  global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  const AF = Object.getPrototypeOf(async function () {}).constructor;
  for (const [k, a] of [["equipes", { all: 1, full: 1, club: "51900071", nomClub: "TC EXEMPLE", pid: "1", cids: [], known: {} }], ["equipes", { club: "51900071", nomClub: "TC EXEMPLE", pid: "1", known: {} }]]) {
    const out = String(await new AF(T.queryScript(k, a))());
    assert.ok(!/is not defined|ReferenceError/.test(out), out.slice(0, 200));
  }
});
test("tennis entreprise = championnat par équipes, pas une inscription (4.5.1, retour testeur)", () => {
  assert.strictEqual(T.kindOf("CH. REGIONAL TE MESSIEURS | Championnat"), "equipes");
  assert.strictEqual(T.kindOf("Tennis entreprise Division 2"), "equipes");
  assert.strictEqual(T.kindOf("Open TE de Lyon"), "tournoi");
  assert.strictEqual(T.kindOf("TOURNOI CNGT DE GRANDVILLARS"), "tournoi");
  assert.strictEqual(T.kindOf("Championnat individuel TE"), "champ");
});
test("4.6.0 : juge-arbitre et lieu d'une inscription (champs lus par motif)", () => {
  const x = { id: "FFT_1", installation: { nom: "Complexe des Sports", adresse: { adresse1: "12 allée des Sports", codePostal: "25000", ville: "Villeneuve" }, latitude: 47.2, longitude: 6.0 },
    jugeArbitre: { prenom: "Julien", nom: "MOREAU", telephone: "06 00 00 00 00", email: "ja@exemple.fr" } };
  const r = T.tuInfos(x);
  assert.deepStrictEqual(r.ja, { name: "Julien MOREAU", tel: "0600000000", mail: "ja@exemple.fr" });
  assert.strictEqual(r.addr, "12 allée des Sports, 25000 Villeneuve");
  assert.strictEqual(r.lat, 47.2);
  assert.deepStrictEqual(T.tuInfos({ id: 1 }), {});
});
test("4.6.0 : un tournoi de la recherche Ten'Up en forme Montée", () => {
  const t = T.tsMap({ id: 1001, libelle: "Open de Noël", dateDebut: "2026-12-12T00:00:00", dateFin: "2026-12-23", nomClub: "TC Beaulieu", dateLimiteInscription: "2026-12-08",
    installation: { ville: "Beaulieu" }, epreuves: [{ idEpreuve: 11, libelle: "Simple Messieurs", classementMin: { libelle: "30/1" }, classementMax: { libelle: "15/1" }, tarif: 22, nbInscrits: 18 },
      { idEpreuve: 12, libelle: "Double Mixte", tarif: 15 }] });
  assert.strictEqual(t.id, "1001"); assert.strictEqual(t.from, "2026-12-12"); assert.strictEqual(t.limit, "2026-12-08"); assert.strictEqual(t.city, "Beaulieu");
  assert.deepStrictEqual([t.eps[0].sex, t.eps[0].min, t.eps[0].max, t.eps[0].fee, t.eps[0].n, t.eps[0].dbl], ["H", "30/1", "15/1", 22, 18, false]);
  assert.strictEqual(t.eps[1].dbl, true);
  assert.strictEqual(T.tsMap({ libelle: "sans id" }), null);
});
test("4.6.0 : inscrits d'une épreuve (classements, liste d'attente, pas de noms)", () => {
  const m = T.inscritsMap({ tableau: [{ joueur: { idCrm: 5, nom: "X", classement: { libelle: "15/2" } } }, { classement: "30" }], listeAttente: [{ classement: "30/1" }] });
  assert.deepStrictEqual(m.list.map((x) => x.r), ["15/2", "30"]); assert.strictEqual(m.wait, 1);
  assert.ok(!JSON.stringify(m).includes('"X"'));
});
test("4.6.0 : les nouvelles lectures (tournois, inscrits) tournent dans le script injecté", async () => {
  global.location = { origin: "https://exemple.invalid", hostname: "tenup.fft.fr", pathname: "/" };
  global.document = { title: "", querySelectorAll: () => [] };
  global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  const AF = Object.getPrototypeOf(async function () {}).constructor;
  for (const [k, a] of [["tournois", { from: "2026-12-01", to: "2027-01-31", lat: 47, lng: 6, km: 40, cp: "25000" }], ["fiche", { t: "FFT_1001" }], ["explore", {}], ["inscrits", { t: "1", e: "2" }], ["inscriptions", {}]]) {
    const out = String(await new AF(T.queryScript(k, a))());
    assert.ok(!/is not defined|ReferenceError/.test(out), k + " : " + out.slice(0, 200));
  }
});
