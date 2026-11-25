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
  for (const [k, a] of [["tournois", { from: "2026-12-01", to: "2027-01-31", lat: 47, lng: 6, km: 40, cp: "25000" }], ["fiche", { t: "FFT_1001" }], ["inscrits", { t: "1", e: "2" }], ["inscriptions", {}]]) {
    const out = String(await new AF(T.queryScript(k, a))());
    assert.ok(!/is not defined|ReferenceError/.test(out), k + " : " + out.slice(0, 200));
  }
});
test("tournois 4.6.0 : formats Ten'Up relevés le 25/11/2026", () => {
  assert.strictEqual(T.dispoLimFrom("Vous aviez jusqu&#x27;au 04/11/2026 pour modifier vos disponibilités"), "2026-11-04");
  assert.strictEqual(T.dispoLimFrom("Vous avez jusqu’au 1/12/2026 pour modifier vos disponibilités"), "2026-12-01");
  assert.strictEqual(T.dispoLimFrom("<p>Rien</p>"), "");
  const c = T.cardMap({ idHomologation: "MOJA_321545", libelleTournoi: "Open d'hiver", dateDebut: "2026-12-05", dateFin: "2026-12-20", club: { libelle: "TC Exemple" }, ville: "VILLE", distance: 12400, inscriptionEnLigne: true, naturesEpreuves: [] });
  assert.strictEqual(c.id, "321545"); assert.strictEqual(c.fav, false); assert.strictEqual(c.km, 12); assert.strictEqual(c.eps, null);
  assert.strictEqual(T.cardsFrom('x{"nbResultats":1,"cards":[{"idHomologation":"A_1","libelleTournoi":"T"}]}y').cards.length, 1);
  const f = T.ficheMap({ mailJa: " ja@exemple.fr ", telephoneJa: "06 00 00 00 00", dateCloture: "2026-12-01T00:00", inscriptionEnLigne: true, epreuveList: [{ id: 7, typeEpreuve: "SM", nomEpreuve: "Simple messieurs" }, { id: 8, typeEpreuve: "DD", nomEpreuve: "Double dames" }] });
  assert.strictEqual(f.ja.tel, "0600000000"); assert.strictEqual(f.ja.mail, "ja@exemple.fr"); assert.strictEqual(f.closing, "2026-12-01");
  assert.strictEqual(f.eps[0].sex, "H"); assert.strictEqual(f.eps[1].sex, "F"); assert.strictEqual(f.eps[1].dbl, true);
  const g = T.ficheMap({ codeSurfaces: ["TB", "RES", "XX"], courtList: [{ couvert: true }, { couvert: false }], prixEspece: 100, prixLots: 0, libelleCategorie: "TMC Messieurs", type: "T", epreuveList: [{ id: 9, typeEpreuve: "SM", nomEpreuve: "Simple messieurs" }] });
  assert.deepStrictEqual(g.surf, ["Terre battue", "Résine"]); assert.strictEqual(g.cov, "mix"); assert.strictEqual(g.cash, 100); assert.strictEqual(g.lots, undefined); assert.strictEqual(g.tmc, true); assert.strictEqual(g.kind, "tournoi"); assert.strictEqual(T.ficheMap({ type: "C" }).kind, "indiv");
  T.epMerge(g, [{ eprId: 9, classementMin: "15/4 ", classementMax: "15/1 ", type: "MULTICHANCE", prixEspece: 100, prixLots: 50, mailConvocation: "x@exemple.fr" }]);
  assert.strictEqual(g.eps[0].min, "15/4"); assert.strictEqual(g.eps[0].max, "15/1"); assert.strictEqual(g.eps[0].fmt, "tmc"); assert.strictEqual(g.lots, 50);
  assert.ok(!JSON.stringify(g).includes("x@exemple.fr"));
  const l = T.lieuMap({ nomClub: "TC Exemple", adresse1: "1 rue du Court", codePostal: "75001", ville: "PARIS", lat: 48.86, lng: 2.34 });
  assert.ok(/1 rue du Court/.test(l.addr)); assert.strictEqual(l.lat, 48.86);
  const i = T.tuInfos({ jugeArbitre: { idCrm: 1, nom: "MARTIN", prenom: "Julien" }, installation: { adresse1: null, codePostal: "75001", nom: "Salle", ville: "PARIS" } });
  assert.strictEqual(i.ja.name, "Julien MARTIN"); assert.strictEqual(i.place, "Salle");
});
test("indispos 4.6.0 : lecture jour par jour (relevé du 25/11/2026)", () => {
  const d = T.dispoDays({ disponibilites: [{ date: "2027-02-13", horaires: [{ heureDebut: "2027-02-13T18:30:00", heureFin: "2027-02-13T22:00:00", particuliere: true }] }] });
  assert.deepStrictEqual(d, [{ date: "2027-02-13", slots: [{ from: "18:30", to: "22:00", ex: true }] }]);
  assert.ok(/dispoDays/.test(T.queryScript("dispos", { t: "MOJA_1" })));
});
test("indispos 4.6.0 : créneaux habituels, numérotation des jours, contenu envoyé", () => {
  const gen = T.genMap({ personnes: [{ idCrm: 1, disponibilites: { generales: [{ jours: [1, 2, 3, 4, 5], heureDebut: "18:30:00", heureFin: "22:00:00" }, { jours: [6, 7], heureDebut: "09:00", heureFin: "20:00" }] } }] });
  assert.strictEqual(gen[1].hd, "09:00:00");
  // semaine du lundi 8 février 2027 : du lundi au vendredi 18 h 30 – 22 h, le week-end 9 h – 20 h, samedi 13 : exception
  const days = ["2027-02-08", "2027-02-09", "2027-02-10", "2027-02-11", "2027-02-12"].map(d => ({ date: d, slots: [{ from: "18:30", to: "22:00", ex: false }] }))
    .concat([{ date: "2027-02-13", slots: [{ from: "14:00", to: "18:00", ex: true }] }, { date: "2027-02-14", slots: [{ from: "09:00", to: "20:00", ex: false }] }]);
  assert.strictEqual(T.dzMapping(gen, days), "iso");
  assert.strictEqual(T.dzMapping(gen, days.map(d => d.date === "2027-02-08" ? { date: d.date, slots: [{ from: "07:00", to: "08:00", ex: false }] } : d)), null); // rien ne colle : on n'écrit pas
  let n = 0; const b = T.dzBody(gen, { "2027-02-13": [{ from: "14:00", to: "18:00" }], "2027-02-10": [] }, "iso", () => "id" + (n++));
  assert.deepStrictEqual(b.generales[0], { jours: [1, 2, 3, 4, 5], heureDebut: "18:30:00", heureFin: "22:00:00" });
  assert.deepStrictEqual(b.particulieres, [
    { disponible: false, dateDebut: "2027-02-10T18:30:00", dateFin: "2027-02-10T22:00:00", generaleId: "id0" },
    { disponible: false, dateDebut: "2027-02-13T09:00:00", dateFin: "2027-02-13T20:00:00", generaleId: "id1" },
    { disponible: true, dateDebut: "2027-02-13T14:00:00", dateFin: "2027-02-13T18:00:00", generaleId: "id1" }]);
  assert.ok(/dzMapping/.test(T.queryScript("dispos", { t: "MOJA_1", from: "2027-02-08", to: "2027-02-14" })));
  assert.ok(/PUT/.test(T.queryScript("dispoSave", { t: "MOJA_1", body: {} })));
});

test("4.9.2 : épreuves jeunes et seniors+ reconnues dans les libellés", () => {
  for (const x of ["Tmc orange", "Open Jeunes", "11/12 ans", "U14 garçons", "Galaxie vert", "Plateau balle verte", "17/18 ans"]) assert.equal(T.youthOnly(x), true, x);
  for (const x of ["TMC Seniors", "Tournoi du Moulin Rouge", "Tournoi de Rougemont", "SM 4e série", "35 ans et +", "Simple Messieurs Seniors"]) assert.equal(T.youthOnly(x), false, x);
  assert.equal(T.seniorsPlus("35 ans et +"), 35); assert.equal(T.seniorsPlus("Senior +45"), 45); assert.equal(T.seniorsPlus("SM 4e série"), 0);
  assert.match(T.ageTxt({ libelleTournoi: "Tmc orange", club: { libelle: "TC Exemple" }, ville: "X" }), /Tmc orange/);
});

test("4.9.2 : nom du juge-arbitre lu sur la page du tournoi", () => {
  assert.equal(T.jaNameFrom('<div><span>Juge-arbitre</span><span><a href="/x">Jean DUPONT</a></span></div>'), "Jean Dupont");
  assert.equal(T.jaNameFrom('<p>Juge-arbitre</p><a href=x><span>Jean-Paul</span> <span>MARTIN-DURAND</span></a>'), "Jean-Paul Martin-Durand");
  assert.equal(T.jaNameFrom('<p>Juge-arbitre</p><a href=x>Voir le site</a>'), "");
  assert.equal(T.jaNameFrom("<p>rien</p>"), "");
});

test("4.9.3 : un jour retiré pour le tournoi (vide, sans particuliere) ne bloque pas la numérotation des jours", () => {
  const gen = T.genMap({ personnes: [{ disponibilites: { generales: [{ heureDebut: "14:00:00", heureFin: "22:00:00", jours: [6, 7] }, { heureDebut: "18:30:00", heureFin: "22:00:00", jours: [1, 2, 4, 5] }, { heureDebut: "20:00:00", heureFin: "22:00:00", jours: [3] }] } }] });
  const days = T.dispoDays({ disponibilites: [
    { date: "2027-02-12", horaires: [{ heureDebut: "2027-02-12T18:30:00", heureFin: "2027-02-12T22:00:00", particuliere: false }] },
    { date: "2027-02-13", horaires: [] },
    { date: "2027-02-14", horaires: [{ heureDebut: "2027-02-14T14:00:00", heureFin: "2027-02-14T22:00:00", particuliere: false }] }] });
  assert.equal(T.dzMapping(gen, days), "iso");
  assert.deepEqual(T.dzGenSlots(gen, "2027-02-13", "iso"), [{ from: "14:00", to: "22:00" }]);
  // le samedi retiré est renvoyé tel quel à l'enregistrement : pas dispo de 14 h à 22 h
  const b = T.dzBody(gen, { "2027-02-13": [] }, "iso", () => "u");
  assert.deepEqual(b.particulieres.map((x) => [x.disponible, x.dateDebut, x.dateFin]), [[false, "2027-02-13T14:00:00", "2027-02-13T22:00:00"]]);
});

test("4.9.3 : un tournoi garde sa copie des créneaux habituels (relevé de Yann : profil passé à 18 h, tournoi resté à 18 h 30)", () => {
  const pg = T.genMap({ personnes: [{ disponibilites: { generales: [{ heureDebut: "14:00:00", heureFin: "22:00:00", jours: [6, 7] }, { heureDebut: "18:00:00", heureFin: "22:00:00", jours: [1, 2, 4, 5] }, { heureDebut: "20:00:00", heureFin: "22:00:00", jours: [3] }] } }] });
  const days = T.dispoDays({ disponibilites: [
    { date: "2027-02-12", horaires: [{ heureDebut: "2027-02-12T18:30:00", heureFin: "2027-02-12T22:00:00", particuliere: false }] },
    { date: "2027-02-13", horaires: [] },
    { date: "2027-02-14", horaires: [{ heureDebut: "2027-02-14T14:00:00", heureFin: "2027-02-14T22:00:00", particuliere: false }] }] });
  const g = T.tourGen(pg, days);
  assert.deepEqual(T.dzGenSlots(g, "2027-02-12", "iso"), [{ from: "18:30", to: "22:00" }]); // vendredi : la copie du tournoi
  assert.deepEqual(T.dzGenSlots(g, "2027-02-13", "iso"), [{ from: "14:00", to: "22:00" }]); // samedi retiré : le profil
  assert.deepEqual(T.dzGenSlots(g, "2027-02-08", "iso"), [{ from: "18:00", to: "22:00" }]); // lundi pas vu : le profil
  assert.ok(/tourGen/.test(T.queryScript("dispos", { t: "MOJA_1", from: "2027-02-12", to: "2027-02-14" })));
});

test("4.10 : créneaux habituels du profil (lecture, fusion, envoi des 7 jours)", () => {
  const j = { utilisateurs: [{ idCrm: 1, codeClub: null, disponibilites: [
    { jour: 1, horaires: [{ heureDebut: "1970-01-01T18:00:00", heureFin: "1970-01-01T22:00:00", idDisponibilite: 9 }] },
    { jour: 6, horaires: [{ heureDebut: "1970-01-01T14:00:00", heureFin: "1970-01-01T22:00:00", idDisponibilite: 8 }] }] }] };
  const p = T.profMap(j);
  assert.deepEqual(p.week[1], [{ from: "18:00", to: "22:00", id: 9 }]); assert.deepEqual(p.week[3], []);
  // 10 h – 14 h + 14 h – 22 h = 10 h – 22 h ; 14 h – 18 h dans 14 h – 22 h = 14 h – 22 h
  assert.deepEqual(T.slotsMerge([{ from: "14:00", to: "22:00" }, { from: "10:00", to: "14:00" }]).slots.map((x) => [x.from, x.to]), [["10:00", "22:00"]]);
  assert.equal(T.slotsMerge([{ from: "14:00", to: "16:00" }, { from: "20:00", to: "22:00" }]).merged.length, 0);
  const w = Object.assign({}, p.week, { 6: [{ from: "14:00", to: "16:00" }, { from: "20:00", to: "22:00" }] });
  const b = T.profBody(p, w).utilisateurs[0];
  assert.equal(b.idCrm, 1); assert.equal(b.codeClub, null); assert.deepEqual(b.disponibilites.map((d) => d.jour), [1, 6]);
  assert.deepEqual(b.disponibilites[0].horaires, [{ heureDebut: "1970-01-01T18:00:00", heureFin: "1970-01-01T22:00:00", idDisponibilite: 9 }]);
  assert.deepEqual(b.disponibilites[1].horaires.map((h) => h.heureDebut.slice(11, 16)), ["14:00", "20:00"]);
  assert.deepEqual(T.weekGen(w), [{ jours: [1], hd: "18:00:00", hf: "22:00:00" }, { jours: [6], hd: "14:00:00", hf: "16:00:00" }, { jours: [6], hd: "20:00:00", hf: "22:00:00" }]);
  assert.ok(T.weekSame(p.week, p.week)); assert.ok(!T.weekSame(p.week, w));
});

test("4.10 : une indispo « juste un moment » retire ce moment des créneaux", () => {
  assert.deepEqual(T.slotsMinus([{ from: "18:00", to: "22:00" }], "18:00", "20:00"), [{ from: "20:00", to: "22:00" }]);
  assert.deepEqual(T.slotsMinus([{ from: "14:00", to: "22:00" }], "16:00", "20:00"), [{ from: "14:00", to: "16:00" }, { from: "20:00", to: "22:00" }]);
  assert.deepEqual(T.slotsMinus([{ from: "18:00", to: "22:00" }], "08:00", "12:00"), [{ from: "18:00", to: "22:00" }]);
});
