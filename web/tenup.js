/* Montée — liaison Ten'Up.
   Le script ci-dessous s'exécute DANS la page tenup.fft.fr, dans le navigateur du joueur
   (raccourci iPhone « Envoyer à Montée » ou favori sur ordinateur). Il utilise la session
   Ten'Up déjà ouverte : aucun mot de passe ne passe par Montée, aucun serveur.
   Il lit le palmarès, le profil, le bilan officiel et la simulation officielle, puis
   renvoie le tout à Montée (presse-papiers sur iPhone, adresse de la page sur ordinateur). */
(function (root) {
  "use strict";

  // Année du meilleur classement (millésime ou date), quel que soit le nom du champ
  // 3.47.4 : le classement du joueur indiqué dans un palmarès de saison (hors « meilleur » et hors adversaires)
  function palClOf(o) {
    var out = ""; (function walk(x, d) { if (out || !x || typeof x !== "object" || d > 3) return; Object.keys(x).forEach(function (k) { if (out || /^matchs?$|matches|adversaire/i.test(k)) return; var v = x[k];
      if (/classement/i.test(k) && v && typeof v === "object" && typeof v.libelle === "string" && !/meilleur/i.test(k)) out = v.libelle; else if (/classement/i.test(k) && typeof v === "string" && /^(NC|\d|-?\d+\/\d|[0-9]{1,2}\/[0-9])/.test(v) && v.length < 8 && !/meilleur/i.test(k)) out = v; else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, d + 1); }); })(o, 0);
    return out;
  }
  function bestYear(mc) {
    var y = null; if (!mc || typeof mc !== "object") return null;
    Object.keys(mc).forEach(function (k) { if (y || !/millesime|annee|year|saison|date/i.test(k)) return; var m = String(mc[k] == null ? "" : typeof mc[k] === "object" ? JSON.stringify(mc[k]) : mc[k]).match(/(19[89]\d|20[0-4]\d)/); if (m) y = +m[1]; });
    // 3.47 : clé inconnue → on cherche une année isolée n'importe où dans l'objet (dates « 2019-09-01 », « 2019 »…)
    if (!y) { var m2 = JSON.stringify(mc).match(/(?:^|[^0-9])(19[89]\d|20[0-4]\d)(?:[^0-9]|$)/); if (m2) y = +m2[1]; }
    return y;
  }
  // ---- Fiche joueur Ten'Up : ce que le joueur a renseigné (main, revers, style de jeu…) ----
  // Les noms de champs ne sont pas documentés : on garde les valeurs courtes dont la clé parle de jeu.
  function ficheOf(p) {
    var out = {}, n = 0, SECRET = /nom|prenom|licence|mail|tel|phone|adresse|naissance|photo|avatar|image|url|token|club|classement|ville|commune|age|sexe|id/i;
    var GAME = /lat[ée]ral|gauch|droit|revers|style|jeu|coup|surface|pref|main|service|volee|filet|qualit|point/i;
    (function walk(o, d, path) {
      if (!o || d > 4 || n > 15) return;
      Object.keys(o).forEach(function (k) {
        var v = o[k], key = path ? path + "." + k : k;
        if (SECRET.test(k) && !GAME.test(k)) return;
        if (v && typeof v === "object" && !Array.isArray(v)) {
          if (GAME.test(k) && (v.libelle || v.code || v.valeur)) { out[key] = String(v.libelle || v.valeur || v.code); n++; } else walk(v, d + 1, key);
        } else if (Array.isArray(v)) {
          if (GAME.test(k)) { var vals = v.map(function (x) { return x && typeof x === "object" ? (x.libelle || x.code || x.valeur || "") : x; }).filter(function (x) { return x != null && String(x).length && String(x).length < 40; }); if (vals.length) { out[key] = vals.join(", "); n++; } }
        } else if ((typeof v === "string" || typeof v === "boolean") && GAME.test(k) && String(v).length && String(v).length < 60) { out[key] = String(v); n++; }
      });
    })(p || {}, 0, "");
    return out;
  }

  // ---- Recherche de joueurs Ten'Up (nouveau site) : exécutée sur tenup.fft.fr ----
  // Les valeurs exactes de « pratique » et « typeRecherche » ne sont pas documentées : on essaie
  // plusieurs réglages et on renvoie celui qui marche, que Montée garde pour la fois suivante.
  function v2Search(nom, prenom, cfg, lic) {
    var combos = [], seen = {};
    // Relevé dans le code du site le 22 oct. 2026 (buildRechercheJoueursTennisBody) :
    // { pratique: "TENNIS", typeRecherche: "COMPETITEUR", from, size, nom, prenom, numeroLicence (nombre, sans la lettre) }
    [cfg, { pratique: "TENNIS", typeRecherche: "COMPETITEUR" }, { pratique: "tennis", typeRecherche: "COMPETITEUR" }].forEach(function (c) {
      if (!c) return; var k = JSON.stringify(c); if (!seen[k]) { seen[k] = 1; combos.push(c); }
    });
    // Début de prénom (« Nico ») : si rien ne revient tel quel, on essaie comme le ferait une recherche
    // « commence par »
    // La liste peut être rangée de plusieurs façons : on la cherche
    function listOf(j) {
      if (!j || typeof j !== "object") return null;
      var c = [j.hits, j.hits && j.hits.hits, j.resultats, j.results, j.content, j.items, j.data, j.data && j.data.hits, j.personnes, j.joueurs, j.liste];
      for (var i = 0; i < c.length; i++) if (Array.isArray(c[i])) return c[i].map(function (h) { return h && h._source ? Object.assign({}, h._source, h) : h; });
      var found = null;
      (function walk(o, d) { if (found || !o || typeof o !== "object" || d > 4) return; Object.keys(o).forEach(function (k) { var v = o[k]; if (found) return; if (Array.isArray(v) && v.length && v[0] && typeof v[0] === "object" && (v[0].nom || v[0].idCrm || v[0].idPersonne || (v[0]._source && v[0]._source.nom))) found = v; else walk(v, d + 1); }); })(j, 0);
      return found && found.map(function (h) { return h._source ? Object.assign({}, h._source, h) : h; });
    }
    var url = location.origin + "/api/back/v2/personnes/recherche", firstEmpty = null, tried = [];
    // Classement d'un résultat : le format n'est pas documenté, on cherche un libellé de classement
    // (en évitant le « meilleur classement »)
    var RK = /^(NC|40|30(\/[1-5])?|15(\/[1-5])?|[1-5]\/6|0|-2\/6|-4\/6|-15|-30|N°\s?\d+|T\s?\d+|Top ?\d+)$/i;
    function rk(h) {
      var c = h.classementTennis;
      if (typeof c === "string" || typeof c === "number") return String(c);
      var best = "", seenN = 0;
      (function walk(o, d, bad) {
        if (!o || d > 4 || best || seenN++ > 200) return;
        if (typeof o === "string") { if (!bad && RK.test(o.trim())) best = o.trim(); return; }
        if (typeof o !== "object") return;
        var ks = Object.keys(o).sort(function (a, b) { var w = function (k) { return /dernier|actuel|courant|libelle/i.test(k) ? 0 : /meilleur|best|ancien|precedent/i.test(k) ? 2 : 1; }; return w(a) - w(b); });
        ks.forEach(function (k) { walk(o[k], d + 1, bad || /meilleur|best|ancien|precedent|double/i.test(k)); });
      })([h.classementTennis, h.rangsParPratique, h.classement], 0, false);
      return best;
    }
    function step(i) {
      if (i >= combos.length) return firstEmpty ? Promise.resolve(firstEmpty) : Promise.reject(new Error("search " + tried.join(",")));
      var body = Object.assign({ from: 0, size: combos[i]._size || 20 }, combos[i]); delete body._p; delete body._start; delete body._size;
      if (nom) body.nom = nom;
      if (prenom && combos[i]._p !== "") body.prenom = combos[i]._p || prenom;
      var ln = String(lic || "").replace(/\D/g, ""); if (ln) body.numeroLicence = Number(ln);
      return fetch(url, { method: "POST", credentials: "include", headers: { "Accept": "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) {
        tried.push(r.status);
        if (r.status === 401 || r.status === 403) throw new Error("auth");
        if (!r.ok) return step(i + 1);
        return r.json().then(function (j) {
          var hits = listOf(j);
          if (Array.isArray(hits) && combos[i]._start) {
            var st0 = String(combos[i]._start).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
            hits = hits.filter(function (h) { return String(h.prenom || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "").indexOf(st0) === 0; });
          }
          // Aucun résultat : Ten'Up renvoie { total: 0, hits: null }
          if (!Array.isArray(hits) && j && typeof j.total === "number" && !j.total) hits = [];
          if (!Array.isArray(hits)) { if (j && j.total) tried.push("forme:" + Object.keys(j).join("+")); return step(i + 1); }
          var cfg0 = {}; Object.keys(combos[i]).forEach(function (k) { if (k.charAt(0) !== "_") cfg0[k] = combos[i][k]; });
          var out = { cfg: cfg0, total: combos[i]._start ? hits.length : j.total != null ? j.total : hits.length, hits: hits.map(function (h) {
            return { id: String(h.idCrm || h.idPersonne || h.id || ""), idp: String(h.idPersonne || ""), nom: h.nom || "", prenom: h.prenom || "", sexe: h.sexe || "", age: h.age || null,
              licence: h.licence || h.numeroLicence || "", rank: rk(h), club: (h.club && (h.club.nom || h.club.libelle)) || h.nomClub || h.club || "", ville: h.ville || (h.club && h.club.ville) || "" };
          }) };
          if (out.hits.length) return out;
          if (!firstEmpty) firstEmpty = out;
          return step(i + 1);
        });
      }, function (e) { if (e && e.message === "auth") throw e; tried.push("x"); return step(i + 1); });
    }
    return step(0);
  }

  // Requêtes ponctuelles depuis l'app (face-à-face) : recherche par nom, fiche d'un joueur.
  function tenupQuery(KIND, A) {
    if (!/(^|\.)tenup\.fft\.fr$/.test(location.hostname)) return Promise.resolve("MONTEE-ERR ouvre tenup.fft.fr");
    var ok = function (o) { return "MONTEE1" + JSON.stringify(o); };
    var err = function (e) { var m = String((e && e.message) || e); return "MONTEE-ERR " + (m === "auth" ? "connecte-toi à Ten'Up" : m); };
    var one = function (A) { return v2Search(A.lic ? "" : A.nom, A.lic ? "" : A.prenom, A.cfg, A.lic).then(function (r) {
      // Pour distinguer les homonymes : la fiche de chacun (club, classement), en parallèle
      return Promise.all(r.hits.slice(0, 8).map(function (h) {
        var u = function (pre) { return fetch(location.origin + pre + h.id + "/profil-joueur", { credentials: "include", headers: { "Accept": "application/json" } }).then(function (x) { if (!x.ok) throw 0; return x.json(); }); };
        return u("/api/back/v1/personnes/").catch(function () { return u("/back/v1/personnes/"); }).then(function (p) {
          var ct = (p && p.classementTennis) || {}, club = "";
          (function walk(o, d) { if (!o || d > 3 || club) return; Object.keys(o).forEach(function (k) { var v = o[k]; if (club) return; if (/club/i.test(k) && typeof v === "string" && v.length < 80) club = v; else if (/club/i.test(k) && v && typeof v === "object" && (v.nom || v.libelle)) club = v.nom || v.libelle; else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, d + 1); }); })(p, 0);
          if (club) h.club = club;
          var cl = ct.dernierClassement && ct.dernierClassement.libelle; if (cl) h.rank = cl;
          if (p && p.age && !h.age) h.age = p.age;
          if (p && (p.ville || p.commune) && !h.ville) h.ville = p.ville || p.commune;
        }).catch(function () {}).then(function () {
          // Lequel tu as joué ? On regarde dans son palmarès un match à l'une de tes dates contre toi
          var C = A.check; if (!C || !C.dates || !C.dates.length || r.hits.length > 6) return;
          var nk = function (x) { return String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, ""); };
          var day = function (x) { x = String(x || ""); var m = x.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0]; m = x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) : ""; };
          var pal = function (pre) { return fetch(location.origin + pre + h.id + "/palmares/tennis?millesime&mobile=false", { credentials: "include", headers: { "Accept": "application/json" } }).then(function (x) { if (!x.ok) throw 0; return x.json(); }); };
          return pal("/api/back/v1/personnes/").catch(function () { return pal("/back/v1/personnes/"); }).then(function (pj) {
            var ms = (pj && (pj.matchs || pj.matches)) || [];
            h.played = ms.some(function (m) {
              var d = day(m.date || m.dateMatch); if (C.dates.indexOf(d) < 0) return false;
              var a = (m.adversaires || [])[0] || m.adversaire || {};
              return !C.me || nk([a.prenom, a.nom].join(" ")).indexOf(C.me) >= 0 || a.anonyme;
            });
            // Pas trouvé : « non » si ta date tombe dans la période de son palmarès, sinon on ne sait pas
            if (!h.played) { var first = ms.map(function (m) { return day(m.date || m.dateMatch); }).filter(Boolean).sort()[0]; h.played = first && C.dates.some(function (d) { return d >= first; }) ? false : null; }
          }).catch(function () {});
        });
      })).then(function () { r.hits.forEach(function (h) { delete h.licence; }); return r; });
    }); };
    if (KIND === "search") return one(A).then(ok, err);
    // 3.44.4 : plusieurs joueurs en une seule ouverture de Ten'Up (import d'une poule : 4 recherches → 1 chargement)
    if (KIND === "searchMany") {
      var out = [], cfg = A.cfg, i = 0;
      var next = function () {
        if (i >= A.list.length) return Promise.resolve();
        var it = A.list[i++], k = 0, res = { hits: [], error: "" };
        var tryOne = function () {
          if (k >= (it.tries || []).length) return Promise.resolve();
          var tr = it.tries[k++];
          return one({ nom: tr.nom, prenom: tr.prenom, cfg: cfg }).then(function (r) { if (r.cfg) cfg = r.cfg; res.error = ""; if (r.hits && r.hits.length) { res.hits = r.hits; return; } return tryOne(); }, function (e) { if (e && e.message === "auth") throw e; res.error = String((e && e.message) || e); return tryOne(); });
        };
        return tryOne().then(function () { out.push(res); return next(); });
      };
      return next().then(function () { return ok({ many: out, cfg: cfg }); }, err);
    }
    // 3.45.2 : diagnostic « inscriptions » : on cherche dans le code du site Ten'Up les adresses qui parlent d'inscriptions,
    // puis on les essaie avec ta session (lecture seule). Le résultat sert à brancher « À venir » sans deviner.
    if (KIND === "inscriptions") {
      // 3.45.4 : tes inscriptions tournois. Ten'Up (Next.js) les met dans la page /user/mes-inscriptions
      // (requête React Query ["tournois","inscriptions"]). On lit la page avec la session et on extrait l'objet {tournois:[…]}.
      var grab = function (t) {
        var i = t.indexOf('{"tournois":['); if (i < 0) return null;
        var d = 0, q = false, e = false;
        for (var k = i; k < t.length; k++) { var c = t.charAt(k);
          if (q) { if (e) e = false; else if (c === "\\") e = true; else if (c === '"') q = false; continue; }
          if (c === '"') q = true; else if (c === "{" || c === "[") d++; else if (c === "}" || c === "]") { d--; if (!d) { try { return JSON.parse(t.slice(i, k + 1)); } catch (x) { return null; } } } }
        return null;
      };
      var map = function (o) {
        return (o.tournois || []).map(function (x) {
          var ep = (x.epreuves || [])[0] || {}, pa = x.paiement || {}, st = String(ep.etatInscriptionJoueur || ""), ins = x.installation || {};
          return { id: String(x.id || ""), name: x.libelle || "", from: x.dateDebut || "", to: x.dateFin || "", club: x.nomClub || "", city: ins.ville || "",
            cat: ep.categorieAge || "", nature: ep.nature && ep.nature.libelle || "", fee: ep.tarif || 0, state: st, wait: !!ep.statutEnAttente || /ATTENTE/.test(st), ok: !!ep.statutValide,
            paid: !!pa.totalitePaye && !(pa.restantAPayer > 0), due: pa.restantAPayer || 0, idEp: ep.idEpreuve || null, n: (x.epreuves || []).length, more: tuInfos(x) }; // 4.6.0 : juge-arbitre, adresse
        });
      };
      // 3.46.4 : l'API JSON trouvée par le diagnostic v3 (/api/back/v2/profil/inscriptions-tournois) ; la page en secours
      var page = function () { return fetch(location.origin + "/user/mes-inscriptions", { credentials: "include" }).then(function (r) {
        if (r.redirected && /signin|login|auth/i.test(r.url || "")) throw new Error("auth");
        return r.text();
      }); };
      return fetch(location.origin + "/api/back/v2/profil/inscriptions-tournois", { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error("auth");
        if (!r.ok) return null; return r.json().catch(function () { return null; });
      }).catch(function (e) { if (String(e && e.message) === "auth") throw e; return null; }).then(function (j) {
        if (j && Array.isArray(j.tournois)) return { api: j };
        return page();
      }).then(function (h) {
        if (h && h.api) {
          // 4.6.0 : date limite des indispos, lue sur la page de chaque inscription à venir (6 au plus : Ten'Up limite les pages)
          var L = map(h.api), today = new Date().toISOString().slice(0, 10), ch = Promise.resolve();
          L.filter(function (t) { return t.id && (t.to || t.from) >= today; }).slice(0, 6).forEach(function (t) {
            ch = ch.then(function () { return fetch(location.origin + "/user/mes-inscriptions/" + encodeURIComponent(t.id) + "/disponibilites", { credentials: "include" })
              .then(function (r) { return r.ok ? r.text() : ""; }).then(function (x) { var d = dispoLimFrom(x); if (d) t.more.dispoLim = d; if (x) t.more.dispoUrl = "/user/mes-inscriptions/" + t.id + "/disponibilites"; })
              .catch(function () {}); });
          });
          return Promise.race([ch, new Promise(function (r) { setTimeout(r, 12000); })]).then(function () { return ok({ list: L, at: Date.now(), src: "api" }); });
        }
        var flight = "", re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g, m;
        while ((m = re.exec(h))) { try { flight += JSON.parse(m[1]); } catch (e) {} }
        var o = grab(flight);
        if (!o) {
          if (/Aucune inscription|aucun tournoi/i.test(h)) return ok({ list: [], at: Date.now() });
          return fetch(location.origin + "/user/mes-inscriptions", { credentials: "include", headers: { "RSC": "1" } }).then(function (r) { return r.text(); }).then(function (t) {
            var o2 = grab(t); if (!o2) throw new Error("format"); return ok({ list: map(o2), at: Date.now() });
          });
        }
        return ok({ list: map(o), at: Date.now() });
      }).catch(err);
    }
    if (KIND === "tournois") {
      // 4.6.0 : recherche de tournois, adresse relevée sur le vrai Ten'Up le 25/11/2026 (fil Vitre, 57 tournois) : la page de
      // résultats renvoie son flux de composants serveur (en-tête RSC) ; les tournois sont dans {"nbResultats": N, "cards": [...]}, 24 par page.
      var baseT = "/recherche/tournois/resultats?searchType=ville&pratique=TENNIS&ville=" + encodeURIComponent(A.ville || "") + "&lat=" + A.lat + "&lng=" + A.lng +
        "&distance=" + (A.km || 30) + "&dateDebut=" + A.from + "&dateFin=" + A.to + "&utiliserMesDonnees=false&sort=DISTANCE&page=", allT = [], totT = 0;
      var pageT = function (n) { return fetch(location.origin + baseT + n, { credentials: "include", headers: { "RSC": "1" } }).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.text(); }).then(function (t) {
        var o = cardsFrom(t); if (!o) throw new Error("format"); totT = o.nbResultats || 0;
        (o.cards || []).forEach(function (c) { var m = cardMap(c); if (m) allT.push(m); });
        if (allT.length < totT && n < 4 && (o.cards || []).length) return pageT(n + 1);
      }); };
      return pageT(1).then(function () { var seen = {}; return ok({ list: allT.filter(function (c) { if (seen[c.id]) return false; seen[c.id] = 1; return true; }), total: totT, at: Date.now() }); }).catch(err);
    }
    if (KIND === "dispos") {
      // 4.6.0 (relevés de Yann, 25/11/2026) : tes créneaux habituels (profil) et tes dispos jour par jour sur les dates du tournoi
      var numD = String(A.t || "").replace(/^\D+_?/, ""), jD = function (u) { return fetch(location.origin + u, { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error("auth"); if (!r.ok) throw new Error("http " + r.status); return r.json(); }); };
      return jD("/api/back/v2/profil/disponibilites").then(function (pf) {
        return jD("/api/back/v1/tournois/" + numD + "/disponibilites?dateDebut=" + A.from + "&dateFin=" + A.to).then(function (d) {
          var gen = genMap(pf), days = dispoDays(d); return ok({ gen: gen, days: days, map: dzMapping(gen, days), at: Date.now() }); });
      }).catch(err);
    }
    if (KIND === "dispoSave") {
      // 4.6.0 : le même envoi que la page Ten'Up (PUT, relevé le 25/11/2026), puis relecture des mêmes dates pour vérifier
      var numS = String(A.t || "").replace(/^\D+_?/, "");
      return fetch(location.origin + "/api/back/v1/tournois/" + numS + "/disponibilites", { method: "PUT", credentials: "include", headers: { "Accept": "application/json", "Content-Type": "application/json" }, body: JSON.stringify(A.body) }).then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error("auth"); if (!r.ok) return r.text().then(function (t) { throw new Error("http " + r.status + " " + t.slice(0, 160)); });
        return fetch(location.origin + "/api/back/v1/tournois/" + numS + "/disponibilites?dateDebut=" + A.from + "&dateFin=" + A.to, { credentials: "include", headers: { "Accept": "application/json" } }).then(function (x) { return x.json(); });
      }).then(function (d) { return ok({ days: dispoDays(d), at: Date.now() }); }).catch(err);
    }
    if (KIND === "fiche") {
      // 4.6.0 : fiche publique d'un tournoi (relevée le 25/11/2026) : contact du juge-arbitre (mailJa, telephoneJa), clôture,
      // inscription et paiement en ligne, épreuves ; le lieu via /installations/{idLieu} (adresse, lat, lng).
      var numF = String(A.t || "").replace(/^\D+_?/, ""), PB = location.origin + "/api/back/public/v1/";
      var jF = function (u) { return fetch(PB + u, { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); }); };
      return jF("tournois/" + numF).then(function (d) {
        var f = ficheMap(d); if (!d || !d.idLieu) return f;
        return jF("installations/" + d.idLieu).then(function (l) { var x = lieuMap(l); Object.keys(x).forEach(function (k) { f[k] = x[k]; }); return f; }, function () { return f; });
      }).then(function (f) { f.at = Date.now(); return ok(f); }).catch(err);
    }
    if (KIND === "inscrits") {
      // 4.6.0 : les inscrits d'une épreuve (adresse relevée sur le padel le 24/11/2026, même API Ten'Up pour le tennis : à vérifier)
      return fetch(location.origin + "/api/back/v1/tournois/" + encodeURIComponent(A.t) + "/epreuves/" + encodeURIComponent(A.e) + "/joueurs-inscrits", { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error("auth"); if (!r.ok) throw new Error("http " + r.status); return r.json();
      }).then(function (j) { var m = inscritsMap(j); if (!m) throw new Error("format"); m.at = Date.now(); return ok(m); }).catch(err);
    }
    if (KIND === "rencontre") {
      // 3.50 : la feuille de match d'une rencontre (simples, doubles). On essaie l'API publique, sinon l'état de la page Ten'Up.
      var Bq = location.origin + "/api/back/public/", tried = [];
      var jr = function (u) { return fetch(Bq + u, { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) { tried.push(u + " " + r.status); if (!r.ok) throw 0; return r.json(); }); };
      var c = A.c, d = A.d, ph = A.p, q = A.q, rid = A.r;
      var cands = ["v1/championnats-equipes/" + c + "/divisions/" + d + "/phases/" + ph + "/poules/" + q + "/rencontres/" + rid, "v2/championnats-equipes/" + c + "/divisions/" + d + "/phases/" + ph + "/poules/" + q + "/rencontres/" + rid, "v1/championnats-equipes/" + c + "/rencontres/" + rid, "v1/championnats-equipes/rencontres/" + rid, "v1/rencontres/" + rid, "v2/rencontres/" + rid];
      var flR = function (h) { var f = "", re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g, m; while ((m = re.exec(h))) { try { f += JSON.parse(m[1]); } catch (e) {} } return f; };
      var brR = function (t, i) { var dd = 0, qq = false, e = false; for (var k = i; k < t.length; k++) { var ch = t.charAt(k); if (qq) { if (e) e = false; else if (ch === "\\") e = true; else if (ch === '"') qq = false; continue; } if (ch === '"') qq = true; else if (ch === "{" || ch === "[") dd++; else if (ch === "}" || ch === "]") { dd--; if (!dd) return t.slice(i, k + 1); } } return null; };
      var page = function () {
        var u = "/championnat/" + c + "/division/" + d + "/phase/" + ph + "/poule/" + q + "/rencontre/" + rid;
        return fetch(location.origin + u, { credentials: "include" }).then(function (r) { tried.push(u + " " + r.status); return r.text(); }).then(function (h) {
          var f = flR(h), i = 0, best = null, keys = [];
          while ((i = f.indexOf('{"dehydratedAt"', i)) >= 0) { var b = brR(f, i); i += 15; if (!b) continue; try { var qo = JSON.parse(b), k = JSON.stringify(qo.queryKey || ""); keys.push(k); if (/rencontre|feuille|fdm|match/i.test(k) && qo.state && qo.state.data && (!best || b.length > best.len)) best = { key: qo.queryKey, data: qo.state.data, len: b.length }; } catch (e) {} }
          return best ? { src: "page", key: best.key, data: best.data, keys: keys } : { src: "none", keys: keys };
        });
      };
      return cands.reduce(function (ch, u) { return ch.then(function (r) { return r || jr(u).then(function (j) { return { src: u, data: j }; }, function () { return null; }); }); }, Promise.resolve(null))
        .then(function (r) { return r || page(); }).then(function (r) { r.tried = tried; return ok(r); }, err);
    }
    if (KIND === "equipes") {
      // 3.50 : tes championnats par équipes. Ton palmarès Ten'Up (matchs « E », idHomologation = le championnat) → l'API publique
      // /api/back/public/…/championnats-equipes/<id>[/divisions/<d>/phases/<p>/poules/<q>] → la poule où joue une équipe de ton club.
      var B = location.origin + "/api/back/public/";
      var jg = function (u) { return fetch(B + u, { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); }); };
      var flE = function (h) { var f = "", re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g, m; while ((m = re.exec(h))) { try { f += JSON.parse(m[1]); } catch (e) {} } return f; };
      var brE = function (t, i) { var d = 0, q = false, e = false; for (var k = i; k < t.length; k++) { var c = t.charAt(k); if (q) { if (e) e = false; else if (c === "\\") e = true; else if (c === '"') q = false; continue; } if (c === '"') q = true; else if (c === "{" || c === "[") d++; else if (c === "}" || c === "]") { d--; if (!d) return t.slice(i, k + 1); } } return null; };
      var nrm = function (x) { return String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ""); };
      var who = function () {
        if (A.pid && A.club && A.nomClub) return Promise.resolve({ id: String(A.pid), code: String(A.club), nom: A.nomClub });
        return fetch(location.origin + "/recherche/equipes", { credentials: "include" }).then(function (r) { return r.text(); }).then(function (h) {
          var f = flE(h), i = 0, u = null;
          while (!u && (i = f.indexOf('{"dehydratedAt"', i)) >= 0) { var b = brE(f, i); i += 15; if (!b) continue; try { var q = JSON.parse(b); if (q.queryKey && q.queryKey[0] === "profile" && q.state && q.state.data && q.state.data.id) u = q.state.data; } catch (e) {} }
          if (!u) throw new Error("auth");
          var code = String(A.club || u.codeClubActif || ((u.clubs || [])[0] || {}).code || ""), cl = (u.clubs || []).filter(function (c) { return String(c.code) === code; })[0] || (u.clubs || [])[0] || {};
          return { id: String(u.id), code: code, nom: cl.nom || A.nomClub || "" };
        });
      };
      var pal = function (id) {
        var now = new Date(), y0 = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
        var one = function (y) { return fetch(location.origin + "/api/back/v1/personnes/" + id + "/palmares/tennis?millesime" + (y ? "=" + y : "") + "&mobile=false", { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return null; }); };
        return Promise.all([one(0), one(y0 - 1)]).then(function (L) { var ms = []; L.forEach(function (p) { ms = ms.concat((p && (p.matchs || p.matches)) || []); }); return ms; });
      };
      var slim = function (det, id, me) {
        var po = det.poule || {}, ph = det.phase || {}, ch = det.championnat || {};
        return { id: String(id), nom: ch.nom || "", cloture: !!ch.cloture, div: (det.division || {}).nom || "", phase: ph.nom || "", poule: po.nom || "",
          path: { d: (det.division || {}).id, p: ph.id, q: po.id }, pts: { v: ch.pointsVictoire, n: ch.pointsNul, d: ch.pointsDefaite }, ns: ch.nombreSimples, nd: ch.nombreDoubles,
          cal: (ph.calendrier || []).map(function (c) { return { j: c.numeroJournee, d: c.dateJournee }; }), me: me,
          teams: (po.equipes || []).map(function (e) { return { id: e.id, nom: e.nom, cl: e.classement, pts: e.points, j: e.rencontres, v: e.rencontresGagnees, n: e.rencontresNulles, d: e.rencontresPerdues, mg: e.matchsGagnes, mp: e.matchsPerdus, pen: e.pointsPenalites || 0, ex: !!e.exclus }; }),
          renc: (po.rencontres || []).map(function (r) { return { id: r.id, d: r.dateReelle || r.dateTheorique || "", dt: String(r.dateTheorique || "").slice(0, 10), a: r.idEquipe1, b: r.idEquipe2, an: r.nomEquipe1, bn: r.nomEquipe2, dom: r.idEquipeDomicileReelle || r.idEquipeDomicileTheorique, w: r.idEquipeGagnante, f: r.idEquipeForfait, s1: r.scoreEquipe1, s2: r.scoreEquipe2, c1: r.scoreEnCoursEquipe1, c2: r.scoreEnCoursEquipe2, st: r.statutFdm || "", rep: !!r.reportee }; }) };
      };
      // 3.68 (Davy, club à 5 équipes et plusieurs championnats) : avant, toute la recherche tenait dans UNE lecture de 30 s, requête
      // après requête (jusqu'à 24 pages de poules + 30 feuilles de match par championnat) ; au-delà, délai dépassé et TOUT était perdu.
      // Maintenant la recherche est découpée : chaque lecture travaille ~14 s, en parallèle par 3, puis rend son avancement (« job »)
      // que Montée renvoie à la lecture suivante, qui reprend là où on s'était arrêté. Les poules déjà trouvées (A.known) sont relues
      // en premier : en temps normal, une seule lecture courte suffit.
      var T0 = Date.now(), BUDGET = +A.budget || 14000, late = function () { return Date.now() - T0 > BUDGET; };
      var dayN = function (x) { var t = Date.parse(String(x || "").slice(0, 10) + "T12:00:00Z"); return isNaN(t) ? null : Math.floor(t / 864e5); }; // floor : avant, round décalait les jours rendus d'un jour
      var iso = function (x) { return new Date(x * 864e5).toISOString().slice(0, 10); };
      var ME = { id: "", lic: String(A.lic || "").replace(/\D/g, ""), nm: nrm(A.nm), tk: String(A.nm || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(function (x) { return x.length >= 2; }) };
      var isMe = function (o) {
        if (!o || typeof o !== "object") return false;
        var ids = [o.id, o.idPersonne, o.idCrm, o.personneId, o.idJoueur].filter(function (x) { return x != null; }).map(String);
        if (ME.id && (o.nom || o.prenom || o.numeroLicence || o.licence) && ids.indexOf(ME.id) >= 0) return true;
        var lc = String(o.numeroLicence || o.licence || "").replace(/\D/g, ""); if (ME.lic && lc && lc === ME.lic) return true;
        if (ME.nm && (o.nom || o.prenom)) { var a = nrm(String(o.prenom || "") + String(o.nom || "")), b = nrm(String(o.nom || "") + String(o.prenom || "")); if (a === ME.nm || b === ME.nm) return true;
          // 3.68.3 : prénom composé, nom d'usage, ordre ou accents différents entre ton profil et la feuille : tous les mots de ton nom s'y retrouvent
          if (ME.tk.length >= 2) { var full = nrm(String(o.prenom || "") + " " + String(o.nom || "")), wr = (String(o.prenom || "") + " " + String(o.nom || "")).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/); if (ME.tk.every(function (w) { return wr.indexOf(w) >= 0; }) && full) return true; } }
        return false;
      };
      var findMe = function (x, path, d) { if (!x || typeof x !== "object" || d > 9) return null; if (!Array.isArray(x) && isMe(x)) return path || "-"; var ks = Object.keys(x); for (var i = 0; i < ks.length; i++) { var f = findMe(x[ks[i]], path + "." + ks[i], d + 1); if (f) return f; } return null; };
      var fitC = function (cl, team) { var a = nrm(cl), b = nrm(String(team || "").replace(/\s+\d+\s*$/, "")); if (!a || !b) return false; if (a.indexOf(b) === 0 || b.indexOf(a) === 0) return true; var k = 0; while (k < a.length && a.charAt(k) === b.charAt(k)) k++; return k >= 8; };
      var rDay = function (r) { return dayN(r.dateReelle || r.dateTheorique); };
      // Un championnat en cours de recherche : tout ce qu'il faut pour reprendre à la lecture suivante (sérialisable).
      var mkCs = function (c, known) {
        var q = (known || []).filter(function (k) { return k && k.d && k.p && k.q; }).map(function (k) { return { k: "poule", d: k.d, p: k.p, q: k.q }; });
        q.push({ k: "root" });
        return { id: String(c.id), nom: c.nom || "", dates: c.dates, last: c.last, opp: (c.opp || []).filter(function (o) { return o && o.c && dayN(o.d) != null; }),
          ent: (known || []).some(function (k) { return k && k.e; }) ? 1 : 0, q: q, seen: {}, conf: {}, ck: [], done: {}, alt: {}, ak: [], cov: {}, fb: null, fw: null, best: null, d0: null, n: 0, nF: 0, fin: false, ms: 0 };
      };
      var scan = function (cs, club, code) {
        code = code ? String(code) : "";
        var myDays = cs.dates.map(dayN).filter(function (x) { return x != null; });
        var allDone = function () { return myDays.length && myDays.every(function (x) { return cs.done[x]; }); };
        var base = "championnats-equipes/" + cs.id;
        var path = function (v, d, p, q) { return v + "/" + base + (d ? "/divisions/" + d : "") + (d && p ? "/phases/" + p : "") + (d && p && q ? "/poules/" + q : ""); };
        var get = function (d, p, q) { cs.n++; return jg(path("v2", d, p, q)).catch(function () { return jg(path("v1", d, p, q)); }); };
        // 3.74.2 (testé en vrai sur Ten'Up) : seule l'adresse v1 complète répond (v2 et v1 courte : 404). Sans elle, aucune
        // feuille n'était lue et l'équipe était devinée au jour : le 4 oct., deux équipes du club jouaient et l'app prenait la mauvaise.
        // Le juge-arbitre et les arbitres sont retirés : ils ne jouent pas pour l'équipe.
        var sheet = function (cx, rid) { var full = "/divisions/" + cx.d + "/phases/" + cx.p + "/poules/" + cx.q + "/rencontres/" + rid;
          return jg("v1/" + base + full).catch(function () { return jg("v2/" + base + full); }).catch(function () { return jg("v1/" + base + "/rencontres/" + rid); }).then(function (j) {
            if (j && typeof j === "object") { delete j.jugeArbitre; (j.matchs || []).forEach(function (m) { if (m) delete m.arbitre; }); } return j; }).catch(function () { return null; }); };
        // 3.68.3 : le nom de l'équipe commence par celui du club ; sinon (« TC GRANDVILLARS » / « GRANDVILLARS TC », entente…) tous les mots du club s'y trouvent
        var cw = String(club || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(function (x) { return x.length >= 4; });
        var isMine = function (det) {
          var eq = (det && det.poule && det.poule.equipes) || [];
          if (!cs.ex && eq.length) cs.ex = eq.slice(0, 3).map(function (e) { return String(e.nom || "").replace(/\s+\d+\s*$/, ""); });
          if (cs.ent) return eq.map(function (e) { return e.id; });
          // 4.0.4 : une équipe que Ten'Up rattache au club par son code (tennis entreprise au nom d'une société, par ex.) est du club
          var byCode = code ? eq.filter(function (e) { return e && Object.keys(e).some(function (k) { if (!/club/i.test(k)) return false; var v = e[k]; if (v && typeof v === "object") v = v.code || v.codeClub || v.id; return v != null && String(v) === code; }); }) : [];
          var a = eq.filter(function (e) { return nrm(e.nom).indexOf(nrm(club)) === 0 || byCode.indexOf(e) >= 0; });
          // 3.72.1 : le nom des équipes du club déjà connues (« CLAMART (TC) ») quand le nom officiel du club diffère (« TENNIS CLUB DE CLAMART »)
          if (!a.length && A.tn && A.tn.length) a = eq.filter(function (e) { return A.tn.indexOf(nrm(String(e.nom || "").replace(/\s+\d+\s*$/, ""))) >= 0; });
          if (!a.length && cw.length) a = eq.filter(function (e) { var nn = String(e.nom || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); if (!cw.every(function (w) { return nn.indexOf(w) >= 0; })) return false;
            // 3.72.1 : équipes du club (cs.all) : pas d'autre mot que ceux du club ou génériques (« SCHLUMBERGER CLAMART SPORTS » n'est pas « CLAMART (TC) »)
            return !cs.all || nn.split(/[^a-z0-9]+/).every(function (w) { return w.length < 4 || cw.indexOf(w) >= 0 || /^(tennis|club|sport|sports|association|union|ville|entente)$/.test(w); }); });
          return a.map(function (e) { return e.id; });
        };
        var playedBy = function (det, ids) { return ids.filter(function (t) { return ((det.poule || {}).rencontres || []).some(function (r) { var d = rDay(r); return (r.idEquipe1 === t || r.idEquipe2 === t) && d != null && myDays.some(function (x) { return Math.abs(x - d) <= 2; }); }); }); };
        // 3.68 : une équipe du club « couvre » un de tes jours si elle a joué ce jour-là (± 2 j) contre le club de tes adversaires
        // du palmarès (ou, sans club connu, simplement ce jour-là). Plusieurs équipes peuvent couvrir des jours différents.
        var covers = function (det, t, x) { return ((det.poule || {}).rencontres || []).some(function (r) { var d = rDay(r); if (d == null || Math.abs(x - d) > 2 || !(r.idEquipe1 === t || r.idEquipe2 === t)) return false; if (!cs.opp.length) return true; var vs = r.idEquipe1 === t ? r.nomEquipe2 : r.nomEquipe1; return cs.opp.some(function (o) { return Math.abs(dayN(o.d) - x) <= 2 && fitC(o.c, vs); }); }); };
        var pick = function (det, ids, cx, force) {
          var me = force || playedBy(det, ids)[0] || ids[0];
          var o = slim(det, cs.id, { mine: me, club: ids }), c0 = cs.d0 || {};
          if (!o.nom) o.nom = c0.nom || cs.nom || "";
          if (!o.div) { var dv = (c0.divs || []).filter(function (x) { return x.id === o.path.d; })[0]; o.div = dv ? dv.nom : ""; }
          if (o.pts.v == null) o.pts = c0.pts || o.pts;
          if (!det.championnat) o.cloture = !!c0.cloture;
          if (o.path.d == null) o.path.d = cx.d; if (o.path.p == null) o.path.p = cx.p; if (o.path.q == null) o.path.q = cx.q;
          if (!o.div && cx.dn) o.div = cx.dn;
          if (cs.ent) { o.ent = 1; o.path.e = 1; o.me.club = [o.me.mine]; }
          return o;
        };
        // Les feuilles de match de tes jours : l'équipe où ton nom est inscrit est la tienne ce jour-là (3.62).
        var chk = function (det, ids, cx) {
          if (!ME.id && !ME.lic && !ME.nm) return Promise.resolve();
          var R = ((det.poule || {}).rencontres || []).filter(function (r) { var d = rDay(r); return (ids.indexOf(r.idEquipe1) >= 0 || ids.indexOf(r.idEquipe2) >= 0) && d != null && myDays.some(function (x) { return !cs.done[x] && Math.abs(x - d) <= 2; }); });
          return R.reduce(function (ch, r) { return ch.then(function () {
            var d = rDay(r), md = myDays.filter(function (x) { return !cs.done[x] && Math.abs(x - d) <= 2; });
            if (!md.length || cs.nF >= 60) return; cs.nF++;
            return sheet(cx, r.id).then(function (j) {
              // 3.68.3 : forme des feuilles lues (nombre, avec joueurs, noms des champs, sans aucun nom), pour comprendre pourquoi ton nom n'y est pas
              var sh = cs.sh = cs.sh || { n: 0, p: 0, k: {} }; sh.n++;
              var pe = []; (function wk(x, d) { if (!x || typeof x !== "object" || d > 9 || pe.length > 40) return; if (!Array.isArray(x) && (x.nom || x.prenom)) { pe.push(x); Object.keys(x).slice(0, 20).forEach(function (k) { sh.k[k] = 1; }); return; } Object.keys(x).forEach(function (k) { wk(x[k], d + 1); }); })(j, 0);
              if (pe.length) sh.p++;
              var at = j && findMe(j, "", 0);
              // 3.68.3 (Davy : « TC 3 le 4 oct. » alors qu'il n'a pas joué) : une feuille qui liste des joueurs SANS toi prouve que tu n'étais
              // pas dans cette équipe ce jour-là : on ne la déduit plus du club d'en face (avant, seules les feuilles vides laissaient la déduction).
              if (!at) { if (pe.length >= 2) { cs.neg = cs.neg || {}; [r.idEquipe1, r.idEquipe2].forEach(function (tt) { if (ids.indexOf(tt) >= 0) md.forEach(function (x) { cs.neg[String(tt) + "|" + x] = 1; }); }); } return; }
              var i1 = ids.indexOf(r.idEquipe1) >= 0, i2 = ids.indexOf(r.idEquipe2) >= 0, t = i1 && !i2 ? r.idEquipe1 : i2 && !i1 ? r.idEquipe2 : null;
              if (t == null && j) { var ms = j.matchs || [], sd = null; for (var mi = 0; mi < ms.length && sd == null; mi++) { var mm = ms[mi]; if (!mm) continue; if (isMe(mm.joueur1Recevant) || isMe(mm.joueur2Recevant)) sd = (j.equipeRecevante || {}).id; else if (isMe(mm.joueur1Invite) || isMe(mm.joueur2Invite)) sd = (j.equipeInvitee || {}).id; } if (sd != null && ids.indexOf(sd) >= 0) t = sd; }
              if (t == null) { // le club contre lui-même (équipe 2 contre équipe 3) : le côté de la feuille où tu es inscrit
                var dom = r.idEquipeDomicileReelle || r.idEquipeDomicileTheorique, oth = dom === r.idEquipe1 ? r.idEquipe2 : r.idEquipe1;
                t = /recev|domicile|equipe1|\.dom/i.test(at) ? dom : /invit|exterieur|visit|equipe2|\.ext/i.test(at) ? oth : null;
              }
              if (t == null) return;
              var k = String(t); if (!cs.conf[k]) { cs.conf[k] = { o: pick(det, ids, cx, t), days: [] }; cs.ck.push(k); }
              md.forEach(function (x) { cs.done[x] = 1; cs.conf[k].days.push(x); });
            });
          }); }, Promise.resolve());
        };
        // Une poule lue : feuilles de match d'abord (sûr), sinon l'ancienne règle (club d'en face, jour) gardée en secours.
        var step = function (det, cx) {
          var key = cx.d + "/" + cx.p + "/" + cx.q; if (cs.seen[key]) return Promise.resolve(); cs.seen[key] = 1;
          var ids = isMine(det); if (!ids.length) return Promise.resolve();
          // 3.72 (Yann, responsable sportif) : mode « club » : on garde TOUTES les équipes du club de chaque poule lue, sans chercher la tienne
          if (cs.all) { ids.forEach(function (t) { var k = cs.id + "~" + t; if (!cs.cl[k]) cs.clk.push(k); cs.cl[k] = pick(det, ids, cx, t); }); return Promise.resolve(); }
          return chk(det, ids, cx).then(function () {
            if (allDone()) { cs.fin = true; return; }
            if (cs.ent) return;
            if (!myDays.length) { if (!cs.best) cs.best = pick(det, ids, cx); cs.fin = true; return; }
            ids.forEach(function (t) {
              var ds = myDays.filter(function (x) { return !cs.done[x] && !cs.cov[x] && !(cs.neg && cs.neg[String(t) + "|" + x]) && covers(det, t, x); }); if (!ds.length) return;
              var k = String(t); if (!cs.alt[k]) { cs.alt[k] = { o: pick(det, ids, cx, t), days: [] }; cs.ak.push(k); }
              ds.forEach(function (x) { cs.cov[x] = 1; cs.alt[k].days.push(x); });
            });
            // tous tes jours ont leur équipe (feuille de match ou rencontre qui colle) : inutile de lire d'autres poules
            if (myDays.every(function (x) { return cs.done[x] || cs.cov[x]; })) { cs.fin = true; return; }
            var o2 = pick(det, ids, cx); if (playedBy(det, ids).length) { if (!cs.fw) cs.fw = o2; } else if (!cs.fb) cs.fb = o2;
          });
        };
        // Une page lue : sa poule, puis les poules, phases et divisions qu'elle fait découvrir (toutes, plus de plafond à 24 pages).
        var grow = function (det, dv) {
          var dId = (det.division || {}).id || dv.d, pId = (det.phase || {}).id || dv.p, qId = (det.poule || {}).id, dn = dv.dn || (det.division || {}).nom || "";
          var add = function (tk, key) { if (cs.only) return; cs.qd = cs.qd || {}; if (cs.seen[key] || cs.qd[key]) return; cs.qd[key] = 1; cs.q.push(tk); };
          ((det.phase || {}).poules || []).forEach(function (q) { if (q.id !== qId && dId && pId) add({ k: "poule", d: dId, p: pId, q: q.id, dn: dn }, dId + "/" + pId + "/" + q.id); });
          ((det.division || {}).phases || []).forEach(function (p) { if (p && p.id && p.id !== pId && dId) add({ k: "phase", d: dId, p: p.id, dn: dn }, dId + "/" + p.id); });
          return qId && dId && pId ? step(det, { d: dId, p: pId, q: qId, dn: dn }) : Promise.resolve();
        };
        var run = function (tk) {
          if (tk.k === "root") return jg("v1/" + base).then(function (det0) {
            var ch = det0.championnat || {};
            cs.d0 = { nom: ch.nom || cs.nom, cloture: !!ch.cloture, pts: { v: ch.pointsVictoire, n: ch.pointsNul, d: ch.pointsDefaite }, divs: (ch.divisions || []).map(function (d) { return { id: d.id, nom: d.nom }; }) };
            var p = grow(det0, {});
            (ch.divisions || []).forEach(function (d) { if (d.id !== (det0.division || {}).id) cs.q.push({ k: "div", d: d.id, dn: d.nom }); });
            return p;
          });
          if (tk.k === "poule" && cs.seen[tk.d + "/" + tk.p + "/" + tk.q]) return Promise.resolve();
          return get(tk.d, tk.k === "div" ? null : tk.p, tk.k === "poule" ? tk.q : null).then(function (det) { return grow(det, tk); });
        };
        var t0 = Date.now();
        var loop = function () {
          if (cs.fin || !cs.q.length || cs.n > 120) {
            // 3.74.5 (Davy, tennis entreprise) : aucune équipe du club dans ce championnat : l'équipe d'une autre structure (son entreprise)
            // où son nom figure sur les feuilles de match de ses jours. Toutes les équipes de chaque poule sont alors regardées.
            if (!cs.ent && !cs.all && myDays.length && !cs.ck.length && !cs.ak.length && !cs.fw && !cs.fb && !cs.best) { cs.ent = 1; cs.fin = false; cs.seen = {}; cs.qd = {}; cs.q = [{ k: "root" }]; cs.n = 0; return loop(); }
            cs.fin = true; return Promise.resolve(); }
          if (late()) return Promise.resolve();
          var batch = cs.q.splice(0, 3);
          return Promise.all(batch.map(function (tk) { return run(tk).catch(function () { cs.err = (cs.err || 0) + 1; }); })).then(loop);
        };
        return loop().then(function () { cs.ms += Date.now() - t0; });
      };
      var fin = function (cs) {
        var myDays = cs.dates.map(dayN).filter(function (x) { return x != null; }), out;
        var E = {}, K = [], add = function (k, o, days, sure) { if (!E[k]) { E[k] = o; o.me.days = []; o.me.sure = sure; K.push(k); } else if (!sure) E[k].me.sure = E[k].me.sure && sure; days.forEach(function (x) { var d = iso(x); if (E[k].me.days.indexOf(d) < 0) E[k].me.days.push(d); }); };
        cs.ck.forEach(function (k) { add(k, cs.conf[k].o, cs.conf[k].days, true); });
        // 3.68 : jours sans feuille lisible (pas encore saisie) : avant on les jetait dès qu'une feuille avait parlé ; on garde l'équipe qui colle
        cs.ak.forEach(function (k) { var ds = cs.alt[k].days.filter(function (x) { return !cs.done[x] && !(cs.neg && cs.neg[k + "|" + x]); }); if (ds.length) add(k, cs.alt[k].o, ds, !!E[k]); });
        var left = myDays.filter(function (x) { return !cs.done[x] && !cs.cov[x]; }), alt = cs.fw || cs.fb;
        if (alt) left = left.filter(function (x) { return !(cs.neg && cs.neg[String(alt.me.mine) + "|" + x]); });
        if (left.length && alt && (K.length || alt)) add(String(alt.me.mine), alt, K.length ? left : [], !!E[String(alt.me.mine)]);
        if (K.length) { out = K.map(function (k) { var o = E[k]; o.me.days.sort(); if (!o.me.days.length) delete o.me.days; return o; }); if (out.length > 1) out.forEach(function (o) { o.cid = cs.id; o.id = cs.id + "~" + o.me.mine; }); }
        else out = [cs.best || { id: cs.id, nom: (cs.d0 || {}).nom || cs.nom, none: true }];
        return out.map(function (x) { var dd = x.me && x.me.days && x.me.days.length ? x.me.days : cs.dates; x.dates = dd; x.last = dd.slice().sort().pop() || cs.last; return x; });
      };
      var trace = function (job) { return job.cs.map(function (cs) { return { id: cs.id, nom: cs.nom, pages: cs.n, feuilles: cs.nF, poules: Object.keys(cs.seen).length, reste: cs.q.length, fini: cs.fin, trouve: cs.ck.length ? "feuille" : cs.ak.length ? "club" : cs.fw || cs.fb || cs.best ? "jour" : "rien", ms: cs.ms, err: cs.err || 0, dates: cs.dates.slice(0, 8), sh: cs.sh ? { n: cs.sh.n, p: cs.sh.p, k: Object.keys(cs.sh.k).slice(0, 14) } : null, ex: cs.ex || null }; }); };
      var start = function () {
        if (A.job && A.job.cs) return Promise.resolve(A.job);
        // 4.0.4 : au moins depuis le début de la saison précédente (avant : 400 jours, la 1re journée d'un championnat de l'an dernier tombait)
        var lim = new Date(); lim.setDate(lim.getDate() - 400); var limI = lim.toISOString().slice(0, 10), y1 = new Date().getMonth() >= 8 ? new Date().getFullYear() - 1 : new Date().getFullYear() - 2; if (y1 + "-09-01" < limI) limI = y1 + "-09-01";
        return who().then(function (u) {
          return pal(u.id).then(function (ms) {
            var C = {};
            ms.forEach(function (m) { var d = String(m.date || "").slice(0, 10); if (m.typeHomologation !== "E" || !m.idHomologation || d < limI) return; var c = C[m.idHomologation] = C[m.idHomologation] || { id: m.idHomologation, nom: m.nomHomologation || "", dates: [], last: "", opp: [] }; if (c.dates.indexOf(d) < 0) c.dates.push(d); if (d > c.last) c.last = d;
              (m.adversaires || [m.adversaire]).forEach(function (a) { if (!a) return; var oc = (a.club && typeof a.club === "object" ? a.club.nom || a.club.libelle : a.club) || a.nomClub || a.libelleClub || ""; if (oc && !c.opp.some(function (o) { return o.d === d && o.c === oc; })) c.opp.push({ d: d, c: String(oc) }); }); });
            // 3.68 : jusqu'à 8 championnats (avant 4 : un joueur qui fait l'été, l'automne et les +35 en perdait)
            var L = Object.keys(C).map(function (k) { return C[k]; }).sort(function (a, b) { return a.last < b.last ? 1 : -1; }).slice(0, 8), K = A.known || {};
            return { u: u, calls: 0, cs: L.map(function (c) { return mkCs(c, K[String(c.id)]); }) };
          });
        });
      };
      // 3.72 : les championnats du club. Ceux où tu joues (A.cids, déjà connus), plus ceux que Ten'Up liste pour le club (deux adresses
      // essayées ; laquelle répond est notée dans le rapport). Relecture courte : seulement les poules déjà connues (A.known), sauf A.full.
      var startClub = function () {
        if (A.job && A.job.cs) return Promise.resolve(A.job);
        return who().then(function (u) {
          var C = {}, src = [], add = function (id, nom, from) { id = String(id || ""); if (!/^\d+$/.test(id)) return; if (!C[id]) { C[id] = { id: id, nom: nom || "", dates: [], last: "", opp: [] }; if (from && src.indexOf(from) < 0) src.push(from); } else if (!C[id].nom && nom) C[id].nom = nom; };
          (A.cids || []).forEach(function (c) { add(c.id, c.nom, "toi"); });
          var walk = function (o, d, from) { if (!o || typeof o !== "object" || d > 7) return; if (Array.isArray(o)) return o.forEach(function (x) { walk(x, d + 1, from); });
            if (o.idChampionnat || o.championnatId) add(o.idChampionnat || o.championnatId, o.nomChampionnat || o.libelleChampionnat || "", from);
            if (o.championnat && typeof o.championnat === "object" && o.championnat.id) add(o.championnat.id, o.championnat.nom || o.championnat.libelle || "", from);
            Object.keys(o).forEach(function (k) { if (k !== "championnat") walk(o[k], d + 1, from); }); };
          // 3.72.1 (testé en vrai sur Ten'Up) : les adresses « championnats du club » n'existent pas. Ten'Up liste les championnats
          // par niveau : national (N), ligue (R, 2 premiers chiffres du code club) et comité (D, 4 premiers chiffres). Lecture complète :
          // saison en cours et précédente à ces 3 niveaux, puis les poules de chacun (~7 pages par championnat). Relecture courte :
          // seulement les championnats où le club a déjà des équipes (A.known) et les tiens.
          var code = String(u.code || A.club || "").replace(/\D/g, ""), K = A.known || {}, now = new Date(), y0 = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
          Object.keys(K).forEach(function (id) { add(id, "", "déjà trouvés"); });
          var tries = [];
          if (A.full || !Object.keys(K).length) [y0, y0 - 1].forEach(function (y) { tries.push("v1/championnats-equipes?millesime=" + y + "&typeRecherche=N"); if (code.length >= 4) tries.push("v1/championnats-equipes?millesime=" + y + "&typeRecherche=R&codeLigue=" + code.slice(0, 2), "v1/championnats-equipes?millesime=" + y + "&typeRecherche=D&codeComite=" + code.slice(0, 4)); });
          return tries.reduce(function (ch, t) { return ch.then(function () { return jg(t).then(function (j) { var n0 = Object.keys(C).length; var lv = (t.match(/typeRecherche=(\w)/) || [])[1], yy = +(t.match(/millesime=(\d+)/) || [])[1]; (Array.isArray(j) ? j : []).forEach(function (c) { add(c.id, c.nom, "liste"); var e = C[String(c.id)]; if (e && !e.lv) { e.lv = lv; e.y = yy; } }); src.push(t.replace(/^.*\?/, "") + " : " + (Object.keys(C).length - n0) + " en plus"); }, function (e) { src.push(t + " : " + String(e && e.message || e)); }); }); }, Promise.resolve()).then(function () {
            // 3.74.1 (rapport de Davy : 200 championnats lus dans la ligue, lecture jamais finie) : un championnat marqué pour un autre
            // département (« … - 58 », « - 25/90 », « CD57-… ») est écarté ; ensuite les plus probables d'abord : déjà trouvés et les tiens,
            // ton département, la ligue, saison en cours avant la précédente, le national en dernier.
            var dep = code.length >= 4 ? code.slice(2, 4) : "", nDrop = 0;
            var deps = champDeps;
            var rank = function (c) { if (K[c.id] || !c.lv) return 0; var d = deps(c.nom), old = c.y && c.y < y0 ? 3 : 0; if (c.lv === "N") return 6 + (old ? 1 : 0); return (d ? 1 : 2) + old; };
            var L = Object.keys(C).map(function (k) { return C[k]; }).filter(function (c) { var d = dep && c.lv && c.lv !== "N" && !K[c.id] && deps(c.nom); if (d && d.indexOf(dep) < 0) { nDrop++; return false; } return true; });
            L.sort(function (a, b) { return rank(a) - rank(b); }); L = L.slice(0, 120);
            src.push("écartés (autre département que " + (dep || "?") + ") : " + nDrop + " · à lire : " + L.length);
            return { u: u, calls: 0, club: 1, src: src, cs: L.map(function (c) { var cs = mkCs(c, K[String(c.id)]); if (!A.full && K[String(c.id)] && K[String(c.id)].length) { cs.q = cs.q.filter(function (x) { return x.k !== "root"; }); cs.only = true; } cs.all = true; cs.cl = {}; cs.clk = []; return cs; }) };
          });
        });
      };
      if (A.all) return startClub().then(function (job) {
        job.calls = (job.calls || 0) + 1;
        return Promise.all(job.cs.filter(function (cs) { return !cs.fin; }).slice(0, 8).map(function (cs) { return scan(cs, job.u.nom, job.u.code); })).then(function () {
          var done = job.cs.every(function (cs) { return cs.fin; });
          var champs = [].concat.apply([], job.cs.filter(function (cs) { return done || cs.fin; }).map(function (cs) { return cs.clk.map(function (k) { var o = cs.cl[k]; o.id = k; o.cid = cs.id; o.cl = 1; o.me.sure = false; return o; }); }));
          return ok({ at: Date.now(), club: { code: job.u.code, nom: job.u.nom }, champs: champs, job: done ? null : job, partial: !done,
            trace: { calls: job.calls, src: job.src, champs: job.cs.map(function (cs) { return { id: cs.id, nom: (cs.d0 || {}).nom || cs.nom, pages: cs.n, poules: Object.keys(cs.seen).length, equipes: cs.clk.length, reste: cs.q.length, fini: cs.fin, err: cs.err || 0 }; }) } });
        });
      }).catch(err);
      return start().then(function (job) {
        job.calls = (job.calls || 0) + 1; ME.id = String(job.u.id || "");
        var todo = job.cs.filter(function (cs) { return !cs.fin; });
        // les championnats en parallèle (chacun lit 3 pages à la fois), dans le temps de cette lecture
        return Promise.all(todo.map(function (cs) { return scan(cs, job.u.nom, job.u.code); })).then(function () {
          var done = job.cs.every(function (cs) { return cs.fin; });
          var champs = [].concat.apply([], job.cs.filter(function (cs) { return done || cs.fin; }).map(fin));
          return ok({ at: Date.now(), club: { code: job.u.code, nom: job.u.nom }, pid: job.u.id, champs: champs, job: done ? null : job, partial: !done, trace: { calls: job.calls, champs: trace(job) } });
        });
      }).catch(err);
    }
    if (KIND === "probeEquipes") {
      // 3.49.2 : v2 du diagnostic. Ten'Up (Next.js) range ses données dans l'état React Query de la page (« dehydratedAt ») :
      // on lit la page des équipes du club, les rencontres passées, puis un championnat / une poule, et on renvoie la FORME des données.
      var oq = { v: 3, at: new Date().toISOString(), club: String(A.club || ""), pages: [], apis: [], ctx: [] };
      var flq = function (h) { var f = "", re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g, m; while ((m = re.exec(h))) { try { f += JSON.parse(m[1]); } catch (e) {} } return f; };
      var match = function (t, i) { var d = 0, q = false, e = false; for (var k = i; k < t.length; k++) { var c = t.charAt(k); if (q) { if (e) e = false; else if (c === "\\") e = true; else if (c === '"') q = false; continue; } if (c === '"') q = true; else if (c === "{" || c === "[") d++; else if (c === "}" || c === "]") { d--; if (!d) return t.slice(i, k + 1); } } return null; };
      var skel = function (o, d) {
        if (o == null || typeof o !== "object") { var s0 = String(o); return typeof o === "string" ? s0.slice(0, 40) : o; }
        if (d > 5) return Array.isArray(o) ? "[" + o.length + "]" : "{…}";
        if (Array.isArray(o)) return o.length ? ["×" + o.length].concat(o.slice(0, 2).map(function (x) { return skel(x, d + 1); })) : [];
        var r = {}; Object.keys(o).slice(0, 40).forEach(function (k) { r[k] = skel(o[k], d + 1); }); return r;
      };
      var queries = function (f) {
        var out = [], i = 0;
        while ((i = f.indexOf('{"dehydratedAt"', i)) >= 0) { var b = match(f, i); i += 15; if (!b) continue; try { var q = JSON.parse(b); out.push({ key: q.queryKey, data: skel(q.state && q.state.data, 0) }); } catch (e) { out.push({ raw: b.slice(0, 300) }); } }
        return out;
      };
      var links = function (t) { var L = [], m, re = /["'](\/(?:championnat|poule|club\/\d+\/equipe)[^"'\s]{0,120})["']/g; while ((m = re.exec(t)) && L.length < 30) if (L.indexOf(m[1]) < 0) L.push(m[1]); return L; };
      var page = function (u) {
        return fetch(location.origin + u, { credentials: "include" }).then(function (r) { return r.text().then(function (h) {
          var f = flq(h), lk = links(f + h); oq.pages.push({ u: u, st: r.status, url: (r.url || "").replace(location.origin, ""), flen: f.length, queries: queries(f), links: lk });
          return lk;
        }); }).catch(function (e) { oq.pages.push({ u: u, err: String(e) }); return []; });
      };
      var api = function (u) {
        return fetch(location.origin + u, { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) { return r.text().then(function (tx) { var j = null; try { j = JSON.parse(tx); } catch (e) {} oq.apis.push({ u: u, st: r.status, data: j ? skel(j, 0) : tx.slice(0, 200) }); }); }).catch(function (e) { oq.apis.push({ u: u, err: String(e) }); });
      };
      var c = oq.club, pid = String(A.pid || ""), seq = function (arr, fn) { return arr.reduce(function (ch, x) { return ch.then(function () { return fn(x); }); }, Promise.resolve()); };
      oq.v = 5; oq.pal = null;
      // 3.49.3 (v3) : tes matchs par équipes dans TON palmarès : quels identifiants (championnat, division, phase, poule, rencontre) ?
      var jget = function (u) { return fetch(location.origin + u, { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); }); };
      var palm = function () {
        if (!pid) return Promise.resolve(null);
        var now = new Date(), y0 = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
        var one = function (y) { return jget("/api/back/v1/personnes/" + pid + "/palmares/tennis?millesime" + (y ? "=" + y : "") + "&mobile=false").catch(function () { return jget("/back/v1/personnes/" + pid + "/palmares/tennis?millesime" + (y ? "=" + y : "") + "&mobile=false"); }).catch(function () { return null; }); };
        return Promise.all([one(0), one(y0 - 1)]).then(function (L) {
          var ms = []; L.forEach(function (p) { ms = ms.concat((p && (p.matchs || p.matches)) || []); });
          var keys = {}, ids = {}, eq = ms.filter(function (m) { return /equipe|championnat|division|interclub|rencontre|poule|\+\s?\d\d|senior/i.test(JSON.stringify(m)); });
          var walk = function (o, path, d) { if (!o || typeof o !== "object" || d > 4) return; Object.keys(o).forEach(function (k) { var v = o[k], pth = path ? path + "." + k : k; keys[pth] = 1; if (/id|code|numero/i.test(k) && v != null && typeof v !== "object" && /championnat|division|phase|poule|rencontre|equipe|epreuve|competition|homolog/i.test(pth)) (ids[pth] = ids[pth] || []).length < 4 && ids[pth].push(v); walk(v, pth, d + 1); }); };
          eq.forEach(function (m) { walk(m, "", 0); });
          var H = {}; ms.forEach(function (m) { if (m.typeHomologation === "E" && m.idHomologation) H[m.idHomologation] = (m.nomHomologation || "") + " · " + String(m.date || "").slice(0, 10); }); oq.homIds = Object.keys(H); oq.homs = H;
          oq.pal = { total: ms.length, equipes: eq.length, ids: ids };
          return ids;
        });
      };
      // ton identifiant Ten'Up (celui du palmarès) : dans l'état de la page (["profile","user"])
      return page("/club/" + c + "/competitions/rencontres").then(function () {
        oq.pages.forEach(function (pg) { (pg.queries || []).forEach(function (q) { if (q.key && q.key[0] === "profile" && q.data && q.data.id) { pid = String(q.data.id); oq.idp = q.data.idPersonne || null; } }); });
        oq.pages = [];
        return palm();
      }).then(function () {
        // v5 (3.49.5) : l'API JSON (base /api/back d'après le code Ten'Up), et les poules d'un championnat
        var hid = (oq.homIds || []).slice(-1)[0] || "";
        oq.pages = [];
        return seq(["/api/back/public/v1/championnats-equipes/formulaire", "/api/shared/public/v1/championnats-equipes/formulaire",
          "/api/back/public/v1/clubs/" + c + "/rencontres?passe=true", "/api/back/public/v1/clubs/" + c + "/rencontres?passe=false", "/api/back/public/v1/clubs/" + c + "/equipes",
          "/api/back/public/v1/championnats-equipes/clubs/" + c, "/api/back/public/v1/championnats/" + hid, "/api/back/public/v1/championnats-equipes/" + hid], api).then(function () {
          if (!hid) return;
          return page("/championnat/" + hid).then(function () {
            var det = null; (oq.pages[0] && oq.pages[0].queries || []).forEach(function (q) { if (q.key && q.key[0] === "championnat" && q.data && q.data.championnat) det = q.data; });
            oq.det = det ? { divisions: det.championnat.divisions, phase: det.phase && det.phase.poules, poule: det.poule && det.poule.nom } : null;
            var dv = det && det.championnat.divisions && det.championnat.divisions[2]; // la 2e division (1er élément = « ×n »)
            var ph = det && det.phase && det.phase.id;
            oq.pages[0] = { u: oq.pages[0].u, keys: (oq.pages[0].queries || []).map(function (q) { return q.key; }) };
            if (!dv) return;
            return seq(["/championnat/" + hid + "?division=" + dv.id, "/championnat/" + hid + "/division/" + dv.id], function (u) {
              return page(u).then(function () { var pg = oq.pages[oq.pages.length - 1], d2 = null; (pg.queries || []).forEach(function (q) { if (q.key && q.key[0] === "championnat" && q.data && q.data.division) d2 = q; }); oq.pages[oq.pages.length - 1] = { u: pg.u, st: pg.st, url: pg.url, key: d2 && d2.key, division: d2 && d2.data.division && d2.data.division.nom, poule: d2 && d2.data.poule && d2.data.poule.nom, equipes: d2 && d2.data.poule && d2.data.poule.equipes && d2.data.poule.equipes.slice(1).map(function (e) { return e.nom; }) }; });
            });
          });
        });
      }).then(function () {
        // le code qui va chercher le détail d'un championnat et les équipes d'un club
        return fetch(location.origin + "/championnat/" + ((oq.homIds || []).slice(-1)[0] || ""), { credentials: "include" }).then(function (r) { return r.text(); }).then(function (h) {
          var srcs = [], rs = /<script[^>]+src="([^"]+)"/g, m; while ((m = rs.exec(h))) srcs.push(m[1]);
          oq.ctx = [];
          return Promise.all(srcs.slice(0, 80).map(function (u) { return fetch(/^https?:/.test(u) ? u : location.origin + u).then(function (x) { return x.text(); }).then(function (t) {
            var re = /"recherche-equipes","club"|championnat","detail"|public\/v\d\/championnats?[^"`']{0,80}|public\/v\d\/clubs?\/\$\{[^"`']{0,60}|public\/v\d\/(?:rencontres?|poules?|equipes?)[^"`']{0,60}/g, mm;
            while ((mm = re.exec(t)) && oq.ctx.length < 30) { var sn = t.slice(Math.max(0, mm.index - 120), mm.index + 220); oq.ctx.push(sn); re.lastIndex = mm.index + 220; }
          }).catch(function () {}); }));
        }).catch(function () {});
      }).then(function () { return ok(oq); }, err);
    }
    if (KIND === "probePoule") {
      // 3.45.7 : où Ten'Up range-t-il la poule d'un championnat individuel ? Lecture seule.
      var out = { v: 3, at: new Date().toISOString(), pages: [], apis: [], paths: {} }, tu = String(A.tuid || ""), num = tu.replace(/^\D+_?/, ""), ep = String(A.idEp || "");
      var sn = function (t, n, w) { var r = [], m, g = /poule|adversaire|tableau|rencontre|convocation|juge|joueurs?"/gi; while ((m = g.exec(t)) && r.length < n) { r.push(t.slice(Math.max(0, m.index - w), m.index + w)); g.lastIndex = m.index + w; } return r; };
      var fl = function (h) { var f = "", re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g, m; while ((m = re.exec(h))) { try { f += JSON.parse(m[1]); } catch (e) {} } return f; };
      var pages = ["/tournoi/" + num, "/tournoi/" + tu, "/user/mes-inscriptions/" + tu + "/disponibilites", "/user/mes-inscriptions/" + num + "/disponibilites"];
      var apis = []; [tu, num].forEach(function (x) { ["/api/public/v1/tournois/", "/public/v1/tournois/", "/api/v1/public/tournois/"].forEach(function (b) { apis.push(b + x + "/fiche-tournoi"); }); });
      ["/api/v2/profil/inscriptions-tournois", "/api/back/v2/profil/inscriptions-tournois", "/back/v2/profil/inscriptions-tournois", "/api/front/v2/profil/inscriptions-tournois"].forEach(function (x) { apis.push(x); });
      if (ep) ["/api/public/v1/epreuves/" + ep, "/api/public/v1/epreuves/" + ep + "/poules", "/api/v2/epreuves/" + ep + "/poules"].forEach(function (x) { apis.push(x); });
      var srcs = [];
      return pages.reduce(function (ch, u) { return ch.then(function () {
        return fetch(location.origin + u, { credentials: "include" }).then(function (r) { return r.text().then(function (h) {
          var f = fl(h), rs = /<script[^>]+src="([^"]+)"/g, m; while ((m = rs.exec(h))) if (srcs.indexOf(m[1]) < 0) srcs.push(m[1]);
          out.pages.push({ u: u, st: r.status, url: (r.url || "").replace(location.origin, ""), len: h.length, flen: f.length, snips: sn(f || h, 8, 350) });
        }); }).catch(function (e) { out.pages.push({ u: u, err: String(e) }); });
      }); }, Promise.resolve()).then(function () {
        return Promise.all(srcs.slice(0, 50).map(function (u) { return fetch(/^https?:/.test(u) ? u : location.origin + u).then(function (x) { return x.text(); }).then(function (t) {
          var re = /["'`]([^"'`\s]{0,80}(?:poule|epreuve|tableau|rencontre|convocation)[^"'`\s]{0,80})["'`]/gi, m; while ((m = re.exec(t)) && Object.keys(out.paths).length < 90) if (/\//.test(m[1])) out.paths[m[1]] = 1;
        }).catch(function () {}); }));
      }).then(function () {
        out.paths = Object.keys(out.paths);
        return apis.reduce(function (ch, u) { return ch.then(function () {
          return fetch(location.origin + u, { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) { return r.text().then(function (tx) { out.apis.push({ u: u, st: r.status, len: tx.length, head: tx.slice(0, r.status === 200 ? 1500 : 120) }); }); }).catch(function (e) { out.apis.push({ u: u, err: String(e) }); });
        }); }, Promise.resolve());
      }).then(function () { return ok(out); }, err);
    }
    if (KIND === "probeIns") {
      // v2 (3.45.3) : la page /user/mes-inscriptions existe (Next.js). On la lit avec la session : texte visible,
      // données serveur (self.__next_f), scripts de la page → routes /api contenant inscri, puis GET de ces routes.
      var out = { v: 2, at: new Date().toISOString() }, pid = String(A.id || ""), apis = {};
      var cut = function (t, n) { return t.length > n ? t.slice(0, n) + "…" : t; };
      var snips = function (t, re, n, w) { var r = [], m, g = new RegExp(re.source, "gi"); while ((m = g.exec(t)) && r.length < n) { r.push(t.slice(Math.max(0, m.index - w), m.index + w)); g.lastIndex = m.index + w; } return r; };
      var scan = function (t) { var re = /["'`](\/(?:api|back)\/[^"'`\s]{2,140})["'`]/g, m; while ((m = re.exec(t)) && Object.keys(apis).length < 120) apis[m[1]] = 1;
        var re2 = /["'`]([^"'`\s]{0,60}\$\{[^}]{1,30}\}[^"'`\s]{0,80})["'`]/g; while ((m = re2.exec(t)) && Object.keys(apis).length < 160) if (/inscri|personne|tournoi/i.test(m[1])) apis[m[1]] = 1; };
      return fetch(location.origin + "/user/mes-inscriptions", { credentials: "include" }).then(function (r) {
        return r.text().then(function (h) {
          out.page = { st: r.status, url: (r.url || "").replace(location.origin, ""), redirected: !!r.redirected, len: h.length };
          var flight = "", re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g, m;
          while ((m = re.exec(h))) { try { flight += JSON.parse(m[1]); } catch (e) {} }
          out.flightLen = flight.length;
          out.flight = snips(flight, /inscri|statut|attente|pay[eé]|tournoi/, 14, 450);
          var txt = ""; try { var d = new DOMParser().parseFromString(h, "text/html"); ["script", "style", "noscript"].forEach(function (q) { Array.prototype.forEach.call(d.querySelectorAll(q), function (x) { x.remove(); }); }); txt = (d.body && d.body.innerText || d.body.textContent || "").replace(/\s+/g, " ").trim(); } catch (e) {}
          out.text = cut(txt, 4000);
          var srcs = [], rs = /<script[^>]+src="([^"]+)"/g; while ((m = rs.exec(h))) if (srcs.indexOf(m[1]) < 0) srcs.push(m[1]);
          out.pageScripts = srcs.length;
          return fetch(location.origin + "/user/mes-inscriptions", { credentials: "include", headers: { "RSC": "1" } }).then(function (r2) { return r2.text().then(function (t2) { out.rsc = { st: r2.status, len: t2.length, snips: snips(t2, /inscri|statut|attente|pay[eé]/, 10, 450) }; }); }).catch(function (e) { out.rsc = { err: String(e) }; })
            .then(function () { return Promise.all(srcs.slice(0, 40).map(function (u) { return fetch(/^https?:/.test(u) ? u : location.origin + u).then(function (x) { return x.text(); }).then(function (t) { scan(t); if (/mes-inscriptions/.test(t)) (out.near = out.near || []).push.apply(out.near, snips(t, /mes-inscriptions|inscriptions\b/, 3, 300)); }).catch(function () {}); })); });
        });
      }).then(function () {
        out.apis = Object.keys(apis);
        if (out.near) out.near = out.near.slice(0, 12);
        var c = out.apis.filter(function (x) { return /inscri|engag/i.test(x); }).slice(0, 14); out.tries = [];
        return c.reduce(function (ch, x) {
          return ch.then(function () {
            var u = x.replace(/\$\{[^}]*\}|:id\b|\{id\}|\{idPersonne\}|\{idCrm\}/g, pid);
            return fetch(location.origin + u, { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) {
              return r.text().then(function (tx) { out.tries.push({ u: u, st: r.status, len: tx.length, head: tx.slice(0, 1200) }); });
            }).catch(function (e) { out.tries.push({ u: u, err: String(e && e.message || e) }); });
          });
        }, Promise.resolve());
      }).then(function () { return ok(out); }, err);
    }
    if (KIND === "player") {
      var ids = [A.id, A.idp].filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      var pres = ["/api/back/v1/personnes/", "/back/v1/personnes/"];
      var j = function (u, post) {
        var o = { credentials: "include", method: post ? "POST" : "GET", headers: { "Accept": "application/json" } };
        if (post) { o.headers["Content-Type"] = "application/json"; o.body = "{}"; }
        return fetch(location.origin + u, o).then(function (r) { if (r.status === 401 || r.status === 403) throw new Error("auth"); if (!r.ok) throw new Error("http " + r.status); return r.json(); });
      };
      var tries = []; ids.forEach(function (id) { pres.forEach(function (p) { tries.push(p + id); }); });
      var step = function (i) {
        if (i >= tries.length) return Promise.reject(new Error("palmarès introuvable"));
        var b = tries[i];
        return j(b + "/palmares/tennis?millesime&mobile=false").then(function (pal) {
          // 3.47 : ses 3 saisons précédentes (son niveau sur la durée, son ancien classement), 6 s max chacune
          var now = new Date(), y0 = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear(), d0 = ((pal && (pal.matchs || pal.matches)) || []).map(function (m) { return String(m.date || m.dateMatch || ""); }).sort().pop() || "";
          var past = function (y) { return Promise.race([j(b + "/palmares/tennis?millesime=" + y + "&mobile=false"), new Promise(function (_, rej) { setTimeout(function () { rej(new Error("t")); }, 6000); })]).then(function (pp) { var ms = (pp && (pp.matchs || pp.matches)) || []; var dd = ms.map(function (m) { return String(m.date || m.dateMatch || ""); }).sort().pop() || ""; return ms.length && dd !== d0 ? { y: y, raw: ms, cl: palClOf(pp) } : null; }).catch(function () { return null; }); };
          return Promise.all([j(b + "/profil-joueur").catch(function () { return null; }), j(b + "/simulation-classement", true).catch(function () { return null; }), Promise.all([1, 2, 3].map(function (k) { return past(y0 - k); }))]).then(function (r) {
            var p = r[0] || {}, ct = p.classementTennis || {}, club = "";
            (function walk(o, d) { if (!o || d > 3 || club) return; Object.keys(o).forEach(function (k) { var v = o[k]; if (club) return; if (/club/i.test(k) && typeof v === "string" && v.length < 80) club = v; else if (/club/i.test(k) && v && typeof v === "object" && (v.nom || v.libelle)) club = v.nom || v.libelle; else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, d + 1); }); })(p, 0);
            var sim = r[1] || {};
            return { id: A.id, fiche: ficheOf(p), profil: { prenom: p.prenom || A.prenom, nom: p.nom || A.nom, sexe: p.sexe || p.genre || A.sexe || "", age: p.age || A.age || null, club: club || A.club || "",
              lic: p.numeroLicence || A.licence || "", classement: (ct.dernierClassement && ct.dernierClassement.libelle) || A.rank || "", meilleur: ct.meilleurClassement && ct.meilleurClassement.libelle || "", meilleurAn: bestYear(ct.meilleurClassement) },
              raw: (pal && (pal.matchs || pal.matches)) || [], past: (r[2] || []).filter(Boolean), sim: { message: sim.messageSimulation || (sim.messages || []).join(" ") || "", res: (sim.resultatSimulation || []).map(function (x) { var v = [x.valide, x.estValide, x.isValide, x.valid, x.atteint, x.obtenu].filter(function (y) { return typeof y === "boolean"; })[0]; return { c: x.classement && (x.classement.libelle || x.classement) || x.libelle || "", pts: x.pointsCumules, quota: x.quota, ok: v == null ? null : v }; }) } };
          });
        }, function (e) { if (e && e.message === "auth") throw e; return step(i + 1); });
      };
      return step(0).then(ok, err);
    }
    return Promise.resolve("MONTEE-ERR requête inconnue");
  }

  // ---- Code exécuté sur tenup.fft.fr (ne pas utiliser de variable extérieure) ----
  function tenupFetch(LIC, MODE, ORIGIN, KID, WHO) {
    // Fenêtre Montée affichée par-dessus Ten'Up (favori) : un bouton pour copier, un lien pour ouvrir Montée
    function panel(html) {
      var old = document.getElementById("montee-panel"); if (old) old.remove();
      var d = document.createElement("div"); d.id = "montee-panel";
      d.setAttribute("style", "position:fixed;inset:0;z-index:2147483647;background:rgba(18,18,18,.45);display:flex;align-items:flex-end;justify-content:center;font-family:-apple-system,system-ui,sans-serif");
      d.innerHTML = '<div style="width:100%;max-width:480px;background:#F6F2EC;color:#121212;border-radius:28px 28px 0 0;padding:24px 20px calc(28px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px;box-sizing:border-box">' +
        '<div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:20px;letter-spacing:-.03em"><span style="width:26px;height:26px;border-radius:13px;background:#D4E64A;display:inline-block"></span>montée</div>' + html + "</div>";
      document.body.appendChild(d);
      return d;
    }
    function btn(label, primary) {
      return '<button type="button" style="min-height:56px;border:none;border-radius:28px;font-size:17px;font-weight:600;font-family:inherit;cursor:pointer;' +
        (primary ? "background:#121212;color:#fff" : "background:#fff;color:#121212") + '">' + label + "</button>";
    }
    function done(payload) {
      var s = "MONTEE1" + JSON.stringify(payload);
      if (MODE === "shortcut") return completion(s);
      if (MODE === "native") return ORIGIN(s);
      if (MODE === "bookmarklet") { location.href = ORIGIN + "/#import=" + encodeURIComponent(s); return; }
      var n = (payload.matches || []).length;
      var d = panel('<div style="font-size:24px;font-weight:600;letter-spacing:-.02em;line-height:1.15">Ton palmarès est prêt</div>' +
        '<div style="font-size:16px;color:#625B55">' + n + " match" + (n > 1 ? "s" : "") + " et ta simulation officielle.</div>" +
        btn("Copier pour Montée", true) + '<div id="montee-msg" style="font-size:15px;min-height:20px;color:#1F5C3F;font-weight:600"></div>' +
        btn("Fermer", false));
      var b = d.querySelectorAll("button");
      b[0].onclick = function () {
        var ok = function () {
          document.getElementById("montee-msg").textContent = "Copié ! Ouvre Montée et touche « Importer ».";
          b[0].textContent = "Copié ✓"; b[0].style.background = "#1F5C3F";
          b[1].textContent = "Ou ouvrir Montée directement"; b[1].onclick = function () { location.href = ORIGIN + "/#import=" + encodeURIComponent(s); };
        };
        var fb = function () {
          var t = document.createElement("textarea"); t.value = s; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;opacity:0";
          document.body.appendChild(t); t.select(); t.setSelectionRange(0, s.length); try { document.execCommand("copy"); } catch (e) {} t.remove(); ok();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(ok, fb); else fb();
      };
      b[1].onclick = function () { d.remove(); };
    }
    function fail(msg) {
      if (MODE === "shortcut") return completion("MONTEE-ERR " + msg);
      if (MODE === "native") return ORIGIN("MONTEE-ERR " + msg);
      if (MODE === "bookmarklet") { alert("Montée : " + msg); return; }
      var dg = "MONTEE-DIAG " + JSON.stringify(DIAG);
      var d = panel('<div style="font-size:20px;font-weight:600">Ça n\'a pas marché</div><div style="font-size:16px;line-height:1.4">' + msg.charAt(0).toUpperCase() + msg.slice(1) + "</div>" + btn("Copier le diagnostic pour Claude", true) + btn("Fermer", false));
      var bs = d.querySelectorAll("button");
      bs[0].onclick = function () {
        var t = document.createElement("textarea"); t.value = dg; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select();
        var fin = function () { bs[0].textContent = "Copié ✓"; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(dg).then(fin, function () { try { document.execCommand("copy"); } catch (e) {} fin(); }); else { try { document.execCommand("copy"); } catch (e) {} fin(); }
        t.remove();
      };
      bs[1].onclick = function () { d.remove(); };
    }
    if (MODE === "overlay") panel('<div style="font-size:18px;font-weight:600">Lecture de ton palmarès…</div>');
    if (!/(^|\.)tenup\.fft\.fr$/.test(location.hostname)) {
      return fail("ouvre d'abord tenup.fft.fr, connecté à ton compte, puis relance.");
    }
    var base = location.origin + "/back/v1/personnes/";
    function j(url, method) {
      var o = { credentials: "include", method: method || "GET", headers: { "Accept": "application/json" } };
      if (method === "POST") { o.headers["Content-Type"] = "application/json"; o.body = "{}"; }
      return fetch(url, o).then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error("auth");
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      });
    }
    var DIAG = { path: location.pathname, cands: [], probes: [], search: null };
    // Cherche l'identifiant Ten'Up du joueur : on rassemble les nombres candidats présents
    // dans la page, puis on demande à Ten'Up lequel correspond à un profil joueur.
    function findId() {
      var cands = [], add = function (x) { if (x && cands.indexOf(x) < 0 && cands.length < 25) cands.push(x); };
      if (KID) add(String(KID));
      var pm = location.pathname.match(/(\d{5,12})/g); (pm || []).forEach(add);
      try { (performance.getEntriesByType("resource") || []).forEach(function (e) { var mm = e.name.match(/personnes\/(\d{5,12})/); if (mm) add(mm[1]); }); } catch (e) {}
      var h = document.documentElement.innerHTML;
      [/back\/v1\/personnes\/(\d{5,12})/g, /\/palmares\/(\d{5,12})/g, /"(?:idPersonne|personneId|idCrm|idPersonneCrm|personId|userId|uid|id)"\s*:\s*"?(\d{5,12})/g,
        /(?:fiche|joueur|profil|personne|player)[^"'\s<>]{0,40}?(\d{6,12})/gi, /data-[a-z-]*id=["'](\d{5,12})["']/gi].forEach(function (re) {
        var mm; while ((mm = re.exec(h))) add(mm[1]);
      });
      Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (a) { var mm = (a.getAttribute("href") || "").match(/\/(\d{6,12})(?:[/?#]|$)/); if (mm) add(mm[1]); });
      DIAG.cands = cands.slice();
      var lic = LIC || ((document.body.innerText || "").match(/\b(\d{6,8}\s?[A-Z])\b/) || [])[1] || "";
      lic = lic.replace(/\s/g, "");
      function probe(i) {
        if (i >= cands.length) return Promise.reject(new Error("next"));
        var id = cands[i];
        return fetch(base + id + "/profil-joueur", { credentials: "include", headers: { "Accept": "application/json" } }).then(function (r) {
          DIAG.probes.push(id.slice(0, 3) + "…:" + r.status);
          if (!r.ok) throw 0;
          return r.json();
        }).then(function (p) {
          var ok = p && (p.numeroLicence || p.nom || p.prenom);
          if (ok && lic && p.numeroLicence && String(p.numeroLicence).replace(/\s/g, "").toUpperCase() !== lic.toUpperCase()) ok = false;
          if (!ok) throw 0;
          return id;
        }).catch(function (e) { if (e && e.message === "next") throw e; return probe(i + 1); });
      }
      // Repli : la recherche Ten'Up par nom, puis le numéro de licence pour reconnaître le bon joueur
      function search() {
        var who = WHO || {}, L = lic.toUpperCase();
        var pick = function (r) {
          DIAG.search = { n: r.hits.length, cfg: r.cfg };
          var hit = r.hits.filter(function (h) { return L && String(h.licence).replace(/\s/g, "").toUpperCase() === L; })[0];
          if (!hit && r.hits.length === 1) hit = r.hits[0];
          if (!hit) throw new Error("noid");
          return hit.id;
        };
        var byLic = lic ? v2Search("", "", who.cfg, lic).then(pick) : Promise.reject(new Error("noid"));
        return byLic.catch(function (e) {
          if (e && e.message === "auth") throw e;
          if (!who.nom) throw new Error("noid");
          return v2Search(who.nom, who.prenom, who.cfg).then(pick);
        });
      }
      return probe(0).catch(function () { return search(); });
    }
    findId().then(function (id) {
      var b = base + id;
      // 3.55.3 (Yann : 1re synchro lente) : les saisons passées partent tout de suite, en même temps que le palmarès, plus après
      // Tes saisons passées (best effort : on ne sait pas jusqu'où Ten'Up remonte) — millésime N = sept. N-1 → août N
      var now = new Date(), y0 = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
      // 3.83 : une clé où qu'elle soit (formats Ten'Up non documentés), 4 niveaux au plus, sans entrer dans les matchs
      var deepK = function (o, re) { var out; (function w(x, d) { if (out !== undefined || !x || typeof x !== "object" || d > 4) return; Object.keys(x).forEach(function (k) { if (out !== undefined || /^matchs?$|matches$/i.test(k)) return; if (re.test(k) && x[k] != null) out = x[k]; else w(x[k], d + 1); }); })(o, 0); return out; };
      var clOf = function (o) {
        var out = ""; (function walk(x, d) { if (out || !x || typeof x !== "object" || d > 3) return; Object.keys(x).forEach(function (k) { if (out || /^matchs?$|matches|adversaire/i.test(k)) return; var v = x[k];
          if (/classement/i.test(k) && v && typeof v === "object" && typeof v.libelle === "string" && !/meilleur/i.test(k)) out = v.libelle; else if (/classement/i.test(k) && typeof v === "string" && /^(NC|\d|-?\d+\/\d|[0-9]{1,2}\/[0-9])/.test(v) && v.length < 8) out = v; else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, d + 1); }); })(o, 0);
        return out;
      };
      var season = function (y) {
        return Promise.race([j(b + "/palmares/tennis?millesime=" + y + "&mobile=false"), new Promise(function (_, rej) { setTimeout(function () { rej(new Error("t")); }, 12000); })]).then(function (pal) {
          var ms = (pal && (pal.matchs || pal.matches)) || [], v = 0, wl = [];
          ms.forEach(function (m) { if (m.victoireUtilisateur && !m.wo) { v++; var a = (m.adversaires || [])[0] || m.adversaire || {}; var cl = String(a.classementLibelle || (a.classement && (a.classement.libelle || a.classement)) || ""); if (cl && wl.length < 60 && !((m.adversaires || []).length >= 2 || m.partenaire || m.partenaires)) wl.push(cl); } });
          var d0 = ms.map(function (m) { return String(m.date || m.dateMatch || ""); }).sort().pop() || "";
          // 3.40 : les 2 dernières saisons gardent leurs matchs (pour la courbe du bilan sur 12 mois glissants)
          return { y: y, d0: d0, n: ms.filter(function (m) { return !m.wo; }).length, v: v, cl: clOf(pal), wl: wl, keys: Object.keys(pal || {}).slice(0, 12), raw: ms };  // 3.47 : le détail de toutes les saisons (face-à-face sur plusieurs années, comparaison à date égale)
        }).catch(function () { return null; });
      };
      var seasonsP = Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (k) { return season(y0 - k); })) /* 4.0.4 (Davy) : 10 saisons, comme la liste « Tes saisons » */;
      return Promise.all([
        j(b + "/palmares/tennis?millesime&mobile=false"),
        j(b + "/profil-joueur").catch(function () { return null; }),
        j(b + "/bilan-classement", "POST").catch(function () { return null; }),
        j(b + "/simulation-classement", "POST").catch(function () { return null; }),
        // Son compte : club et photo (la photo est réduite ici, dans la page Ten'Up, avec sa session)
        j(location.origin + "/api/back/v1/profil").catch(function () { return null; }).then(function (me) {
          if (!me) return null;
          var ph = me.photo && typeof me.photo === "object" ? (me.photo.url || me.photo.lien || me.photo.src) : me.photo;
          var club = (me.clubs || []).filter(function (c) { return c && c.code === me.codeClubActif; })[0] || (me.clubs || [])[0];
          var out = { club: club && club.nom || "", classement: me.classement || "" };
          // 3.83 (Yann, maquette « Je t'ai reconnu » validée le 23/11/2026) : licence de la saison suivante, paiements en attente
          var dv = function (re) { var v; try { v = deepK(me, re); } catch (e) {} return v == null || typeof v === "object" ? null : v; };
          var l1 = dv(/^licencieMillesimeSuivant$/i); out.licN1 = l1 == null ? null : !!l1;
          var np = dv(/^nbPaiementsEnAttente$/i); out.pay = np == null ? null : +np || 0;
          if (!ph || typeof ph !== "string" || !/^(https?:|\/|data:image)/.test(ph)) return out;
          return new Promise(function (res) {
            var done = false, fin = function (d) { if (!done) { done = true; out.photo = d || null; res(out); } };
            setTimeout(function () { fin(null); }, 5000);
            var draw = function (src) {
              var im = new Image();
              im.onload = function () { try { var S = 240, c = document.createElement("canvas"), k = Math.max(S / im.width, S / im.height); c.width = c.height = S; c.getContext("2d").drawImage(im, (S - im.width * k) / 2, (S - im.height * k) / 2, im.width * k, im.height * k); fin(c.toDataURL("image/jpeg", 0.85)); } catch (e) { fin(null); } };
              im.onerror = function () { fin(null); }; im.src = src;
            };
            if (/^data:/.test(ph)) return draw(ph);
            fetch(ph.charAt(0) === "/" ? location.origin + ph : ph, { credentials: "include" }).then(function (x) { if (!x.ok) throw 0; return x.blob(); }).then(function (bl) {
              if (!/^image\//.test(bl.type)) throw 0; var fr = new FileReader(); fr.onload = function () { draw(fr.result); }; fr.onerror = function () { fin(null); }; fr.readAsDataURL(bl);
            }).catch(function () { fin(null); });
          });
        })
      ]).then(function (r) {
        var pal = r[0] || {}, ms = pal.matchs || pal.matches || [];
        var matches = ms.map(function (m) {
          var a = (m.adversaires || [])[0] || m.adversaire || {};
          var cl = a.classementLibelle || (a.classement && (a.classement.libelle || a.classement)) || "";
          return {
            date: m.date || m.dateMatch || "", v: m.victoireUtilisateur, wo: !!m.wo, ab: !!m.abandon, dq: !!m.disqualification,
            comp: m.nomHomologation || (m.competition && m.competition.libelle) || "",
            nom: [a.prenom, a.nom].filter(Boolean).join(" ") || (a.anonyme ? "Anonyme" : ""), cl: String(cl),
            sets: (m.sets || []).map(function (s) { return [s.scoreUtilisateur, s.scoreAdversaire, s.scoreTieBreak]; })
          };
        });
        var p = r[1] || {}, ct = p.classementTennis || {};
        return seasonsP.then(function (ss) {
        done({
          v: 1, sv: "__SV__", at: new Date().toISOString(), id: id, seasons: ss.filter(Boolean), palD0: ms.map(function (m) { return String(m.date || m.dateMatch || ""); }).sort().pop() || "", palKeys: Object.keys(pal || {}).slice(0, 15), palCl: clOf(pal),
          profil: { prenom: p.prenom, nom: p.nom, sexe: p.sexe, licence: p.numeroLicence, fiche: ficheOf(p), club: (r[4] && r[4].club) || "", photo: (r[4] && r[4].photo) || null,
            classement: ct.dernierClassement && ct.dernierClassement.libelle, meilleur: ct.meilleurClassement && ct.meilleurClassement.libelle,
            // 3.83 : profil rempli tout seul (âge, catégorie, saison du meilleur classement, licence N+1, paiements, bilan par saison)
            meilleurAn: bestYear(ct.meilleurClassement), age: p.age || deepK(p, /^age$/i) || null, cat: (function (c) { return c && typeof c === "object" ? c.libelle || c.code || "" : c || ""; })(deepK(p, /^categorieAge$/i)),
            licN1: r[4] ? r[4].licN1 : null, pay: r[4] ? r[4].pay : null,
            hist: (function (h) { try { var t = JSON.stringify(h); return h && t.length < 6000 ? h : null; } catch (e) { return null; } })(deepK(pal, /^historiqueStats$/i)) },
          matches: matches, raw: ms, bilan: r[2], simulation: r[3], sample: ms[0] || null
        });
        });
      });
    }).catch(function (e) {
      var m = String((e && e.message) || e);
      fail(m === "auth" ? "connecte-toi à Ten'Up, puis relance." :
        m === "noid" ? "ouvre la page de ton palmarès sur Ten'Up (ou renseigne ton numéro de licence dans Montée), puis relance." :
          "Ten'Up n'a pas répondu (" + m + "). Réessaie dans un instant.");
    });
  }

  // ---- 4.6.0 : formats relevés sur le vrai Ten'Up le 25/11/2026 ----
  function cardsFrom(text) { // l'objet {"nbResultats":…,"cards":[…]} dans le flux de la page de résultats
    text = String(text || ""); var i = text.indexOf('{"nbResultats"'); if (i < 0) return null;
    var d = 0, q = false, e = false, k; for (k = i; k < text.length; k++) { var c = text[k]; if (q) { if (e) e = false; else if (c === "\\") e = true; else if (c === '"') q = false; continue; } if (c === '"') q = true; else if (c === "{") d++; else if (c === "}") { d--; if (!d) break; } }
    try { return JSON.parse(text.slice(i, k + 1)); } catch (x) { return null; }
  }
  function cardMap(c) { // une carte de la recherche
    if (!c) return null; var m = String(c.idHomologation || "").match(/(\d+)$/); if (!m) return null;
    return { id: m[1], name: String(c.libelleTournoi || "Tournoi"), from: String(c.dateDebut || "").slice(0, 10), to: String(c.dateFin || c.dateDebut || "").slice(0, 10), club: String(c.club && c.club.libelle || ""),
      city: String(c.ville || ""), km: c.distance != null ? Math.round(c.distance / 1000) : null, online: !!c.inscriptionEnLigne, natures: c.naturesEpreuves || [], eps: null };
  }
  function ficheMap(d) { // la fiche publique d'un tournoi
    if (!d || typeof d !== "object") return {};
    var tel = String(d.telephoneJa || "").replace(/[^\d+]/g, ""), mail = String(d.mailJa || "").trim(), out = { cat: String(d.libelleCategorie || ""), closing: d.dateCloture ? String(d.dateCloture).slice(0, 10) : "",
      opens: d.dateOuvertureInscriptionEnLigne ? String(d.dateOuvertureInscriptionEnLigne).slice(0, 10) : "", online: !!d.inscriptionEnLigne, payOnline: !!d.paiementEnLigne,
      eps: (d.epreuveList || []).map(function (e) { var ty = String(e.typeEpreuve || ""); return { id: String(e.id || ""), name: String(e.nomEpreuve || e.epreuveLibelle || ""), sex: /^[SD]D$/.test(ty) ? "F" : /^[SD]M$/.test(ty) ? "H" : "", dbl: /^D/.test(ty) || /double|mixte/i.test(e.nomEpreuve || "") }; }) };
    if (tel || mail) out.ja = { name: "", tel: tel, mail: mail };
    return out;
  }
  function lieuMap(l) { // /installations/{idLieu}
    if (!l || typeof l !== "object") return {}; var o = {};
    var a = [l.adresse1, l.adresse2].filter(Boolean).join(", "), cv = [l.codePostal, l.ville].filter(Boolean).join(" ");
    if (a || cv) o.addr = [a, cv].filter(Boolean).join(", "); if (l.nomClub) o.place = l.nomClub; if (l.lat && l.lng) { o.lat = +l.lat; o.lng = +l.lng; }
    return o;
  }
  // ---- 4.6.0 : tournois (infos pratiques, recherche, inscrits). Noms de champs Ten'Up non documentés : lecture par motif. ----
  // Première valeur courte (texte ou nombre) dont la clé correspond, en profondeur limitée.
  function tuPick(o, re, d) {
    var out = null; d = d == null ? 3 : d;
    (function walk(x, n) { if (out != null || !x || typeof x !== "object" || n > d) return; Object.keys(x).forEach(function (k) { if (out != null) return; var v = x[k];
      if (re.test(k) && (typeof v === "string" || typeof v === "number") && String(v).trim() !== "" && String(v).length < 160) out = typeof v === "string" ? v.trim() : v; }); Object.keys(x).forEach(function (k) { if (out == null && x[k] && typeof x[k] === "object") walk(x[k], n + 1); }); })(o, 0);
    return out;
  }
  // Premier sous-objet dont la clé correspond (le juge-arbitre, l'installation…)
  function tuObj(o, re, d) {
    var out = null; d = d == null ? 3 : d;
    (function walk(x, n) { if (out || !x || typeof x !== "object" || n > d) return; Object.keys(x).forEach(function (k) { if (out) return; var v = x[k]; if (re.test(k) && v && typeof v === "object" && !Array.isArray(v)) out = v; }); Object.keys(x).forEach(function (k) { if (!out && x[k] && typeof x[k] === "object") walk(x[k], n + 1); }); })(o, 0);
    return out;
  }
  // Juge-arbitre et lieu d'un tournoi (inscription ou résultat de recherche)
  function tuInfos(x) {
    var out = {}; if (!x || typeof x !== "object") return out;
    var ja = tuObj(x, /juge.?arbitre|^ja$|arbitre/i);
    if (ja) {
      var nm = [ja.prenom, ja.nom].filter(Boolean).join(" ") || ja.nomComplet || ja.libelle || ja.nomPrenom || "";
      var tel = tuPick(ja, /t[eé]l|phone|portable|mobile/i, 1), mail = tuPick(ja, /mail|courriel/i, 1);
      if (nm || tel || mail) out.ja = { name: String(nm || "").trim(), tel: tel ? String(tel).replace(/[^\d+]/g, "") : "", mail: mail ? String(mail).trim() : "" };
    }
    var ins = x.installation || tuObj(x, /installation|lieu|site|adresse|club/i) || {};
    var ad = ins.adresse && typeof ins.adresse === "object" ? ins.adresse : ins;
    var l1 = [ad.adresse1 || ad.ligne1 || ad.rue || ad.voie || (typeof ad.adresse === "string" ? ad.adresse : ""), ad.adresse2 || ad.ligne2 || ""].filter(Boolean).join(", ");
    var cp = ad.codePostal || ad.cp || "", city = ad.ville || ad.commune || ins.ville || "";
    if (l1 || cp || city) out.addr = [l1, [cp, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    if (ins.nom || ins.libelle) out.place = ins.nom || ins.libelle;
    var lat = +(tuPick(ins, /^lat(itude)?$/i, 2) || 0), lng = +(tuPick(ins, /^(lng|lon|long|longitude)$/i, 2) || 0);
    if (lat && lng) { out.lat = lat; out.lng = lng; }
    // 4.6.0 (Yann) : date jusqu'à laquelle les indispos se modifient
    var dl = tuPick(x, /(limite|fin|cloture).{0,24}(dispo|modif)|(dispo|modif).{0,24}(limite|fin|cloture)/i, 3); if (dl && /^\d{4}-\d{2}-\d{2}/.test(String(dl))) out.dispoLim = String(dl).slice(0, 10);
    return out;
  }
  // 4.6.0 (relevé de Yann, 25/11) : la page /user/mes-inscriptions/{id}/disponibilites écrit
  // « Vous avez (aviez) jusqu'au JJ/MM/AAAA pour modifier vos disponibilités » → date ISO, ou "".
  function dispoLimFrom(h) {
    var t = String(h || "").replace(/&#x27;|&#39;|&apos;|’/g, "'");
    var m = t.match(/jusqu'au\s*(\d{1,2})\/(\d{1,2})\/(\d{4})[^<]{0,40}modifier/i);
    if (!m) return "";
    return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  }
  function genMap(pf) { // GET /v2/profil/disponibilites → [{jours:[n…], hd:"HH:MM:SS", hf}]
    var p = (pf && (pf.personnes || pf.utilisateurs) || [])[0] || {}, g = (p.disponibilites && p.disponibilites.generales) || [];
    var hh = function (h) { var m = String(h || "").match(/(\d\d):(\d\d)(?::(\d\d))?/); return m ? m[1] + ":" + m[2] + ":" + (m[3] || "00") : ""; };
    return g.map(function (x) { var j = x.jours; j = Array.isArray(j) ? j : typeof j === "number" ? [j] : String(j || "").split(/\D+/).filter(Boolean);
      return { jours: j.map(Number), hd: hh(x.heureDebut), hf: hh(x.heureFin) }; });
  }
  var DZ_MAPS = { iso: function (d) { return (d.getDay() + 6) % 7 + 1; }, sun0: function (d) { return d.getDay(); }, sun1: function (d) { return d.getDay() + 1; } };
  function dzGenSlots(gen, iso, map) { // les créneaux habituels d'une date, selon la numérotation des jours
    var d = new Date(iso + "T12:00:00"), wd = DZ_MAPS[map] ? DZ_MAPS[map](d) : -1;
    return gen.filter(function (g) { return g.jours.indexOf(wd) >= 0; }).map(function (g) { return { from: g.hd.slice(0, 5), to: g.hf.slice(0, 5) }; })
      .sort(function (a, b) { return a.from < b.from ? -1 : 1; });
  }
  function dzSame(a, b) { var k = function (l) { return l.map(function (x) { return x.from + "-" + x.to; }).sort().join(","); }; return k(a) === k(b); }
  function dzMapping(gen, days) { // la numérotation des jours de Ten'Up, déduite des jours sans exception ; null si rien ne colle (on n'écrit pas)
    var plain = days.filter(function (d) { return !d.slots.some(function (x) { return x.ex; }); });
    if (!gen.length || !plain.length) return null;
    var c = ["iso", "sun0", "sun1"].filter(function (m) { return plain.every(function (d) { return dzSame(dzGenSlots(gen, d.date, m), d.slots); }); });
    return c[0] || null;
  }
  function dzBody(gen, ex, map, uuid) { // ex : {date: [{from, to}] créneaux où tu es dispo ce jour-là ([] = pas dispo)} → le contenu envoyé par la page Ten'Up
    var ids = gen.map(function () { return uuid(); }), par = [];
    Object.keys(ex).sort().forEach(function (iso) {
      var on = ex[iso] || [], d = new Date(iso + "T12:00:00"), wd = DZ_MAPS[map](d), gi = -1;
      gen.forEach(function (g, i) { if (gi < 0 && g.jours.indexOf(wd) >= 0) gi = i; });
      gen.forEach(function (g, i) { if (g.jours.indexOf(wd) < 0) return; var s0 = { from: g.hd.slice(0, 5), to: g.hf.slice(0, 5) };
        if (!on.some(function (x) { return x.from === s0.from && x.to === s0.to; })) par.push({ disponible: false, dateDebut: iso + "T" + g.hd, dateFin: iso + "T" + g.hf, generaleId: ids[i] }); });
      on.forEach(function (x) { if (gi >= 0 && gen[gi].hd.slice(0, 5) === x.from && gen[gi].hf.slice(0, 5) === x.to) return;
        par.push({ disponible: true, dateDebut: iso + "T" + x.from + ":00", dateFin: iso + "T" + x.to + ":00", generaleId: ids[gi >= 0 ? gi : 0] || uuid() }); });
    });
    return { generales: gen.map(function (g) { return { jours: g.jours, heureDebut: g.hd, heureFin: g.hf }; }), particulieres: par };
  }
  function dispoDays(d) { // GET …/disponibilites → [{date, slots:[{from:"HH:MM", to:"HH:MM", ex:bool}]}]
    return ((d && d.disponibilites) || []).map(function (j) { return { date: String(j.date || "").slice(0, 10), slots: (j.horaires || []).map(function (h) {
      return { from: String(h.heureDebut || "").slice(11, 16), to: String(h.heureFin || "").slice(11, 16), ex: !!h.particuliere }; }) }; });
  }
  // Un tournoi trouvé par la recherche Ten'Up, en forme Montée
  function tsMap(o) {
    if (!o || typeof o !== "object") return null;
    var rk = function (v) { if (!v) return ""; if (typeof v === "object") v = v.libelle || v.code || v.valeur || ""; return String(v).trim(); };
    var eps = (o.epreuves || o.listeEpreuves || []).map(function (e) {
      var mn = "", mx = "";
      Object.keys(e || {}).forEach(function (k) { if (!/class/i.test(k)) return; if (/min|inf|bas|plancher|depart/i.test(k) && !mn) mn = rk(e[k]); else if (/max|sup|haut|plafond|limite/i.test(k) && !mx) mx = rk(e[k]); });
      var nat = e.nature && (e.nature.libelle || e.nature) || "", sx = String(e.sexe && (e.sexe.libelle || e.sexe) || e.typeEpreuve || nat || e.libelle || "");
      return { id: String(e.id || e.idEpreuve || ""), name: String(e.libelle || e.nom || nat || "Épreuve"), sex: /dame|femin|^f$|simple d/i.test(sx) ? "F" : /mess|mascul|^h$|^m$|simple m/i.test(sx) ? "H" : "",
        dbl: /double|mixte/i.test(String(e.libelle || "") + " " + sx), cat: String(e.categorieAge && (e.categorieAge.libelle || e.categorieAge) || ""), min: mn, max: mx,
        fee: +(e.tarif || e.prix || e.tarifAdulte || 0) || 0, n: +(e.nbInscrits || e.nombreInscrits || e.nbJoueursInscrits || 0) || 0 };
    });
    var lim = tuPick(o, /date.?limite|fin.?inscription|cloture.?inscription/i, 2);
    var r = { id: String(o.id || o.idTournoi || o.numero || ""), name: String(o.libelle || o.nom || o.nomTournoi || "Tournoi"), from: String(o.dateDebut || o.debut || "").slice(0, 10), to: String(o.dateFin || o.fin || "").slice(0, 10),
      club: String(o.nomClub || (o.club && (o.club.nom || o.club.libelle)) || o.organisateur && o.organisateur.nom || ""), limit: lim ? String(lim).slice(0, 10) : "", eps: eps };
    var inf = tuInfos(o); Object.keys(inf).forEach(function (k) { r[k] = inf[k]; });
    r.city = String(tuPick(o.installation || o, /^(ville|commune)$/i, 2) || "");
    var km = tuPick(o, /^distance(km)?$/i, 1); if (km != null && !isNaN(+km)) r.km = Math.round(+km);
    return r.id && r.from ? r : null;
  }
  // Liste des inscrits d'une épreuve : classements (tableau, puis liste d'attente). Les noms ne sont pas gardés.
  function inscritsMap(j) {
    if (!j || typeof j !== "object") return null;
    var rk = function (p) { var c = p && (p.classement || p.classementTennis || p.classementSimple); if (c && typeof c === "object") c = c.libelle || c.code; return c ? String(c).trim() : String(tuPick(p, /classement/i, 2) || ""); };
    var arr = function (v) { return Array.isArray(v) ? v : []; };
    var main = arr(j.tableau).concat(arr(j.qualifications)).concat(arr(j.inscrits)).concat(arr(j.joueurs)).concat(Array.isArray(j) ? j : []);
    var wait = arr(j.listeAttente);
    var flat = function (L) { var out = []; L.forEach(function (x) { if (!x) return; var pl = x.joueur1 || x.joueur || x.personne || x; out.push({ r: rk(pl), id: String(pl.idCrm || pl.id || "") }); }); return out; };
    return { list: flat(main).filter(function (x) { return x.r; }), wait: flat(wait).length };
  }

  var VERSION = "2.4";
  // Version pour l'app iPhone : corps d'une fonction async (WKWebView callAsyncJavaScript)
  // Le script embarque la recherche v2, utilisée en repli par tenupFetch
  function src(fn) { return "var cardsFrom = " + cardsFrom.toString() + ";\nvar cardMap = " + cardMap.toString() + ";\nvar ficheMap = " + ficheMap.toString() + ";\nvar lieuMap = " + lieuMap.toString() + ";\nvar tuPick = " + tuPick.toString() + ";\nvar tuObj = " + tuObj.toString() + ";\nvar tuInfos = " + tuInfos.toString() + ";\nvar genMap = " + genMap.toString() + ";\nvar DZ_MAPS = { iso: function (d) { return (d.getDay() + 6) % 7 + 1; }, sun0: function (d) { return d.getDay(); }, sun1: function (d) { return d.getDay() + 1; } };\nvar dzGenSlots = " + dzGenSlots.toString() + ";\nvar dzSame = " + dzSame.toString() + ";\nvar dzMapping = " + dzMapping.toString() + ";\nvar dispoDays = " + dispoDays.toString() + ";\nvar dispoLimFrom = " + dispoLimFrom.toString() + ";\nvar tsMap = " + tsMap.toString() + ";\nvar inscritsMap = " + inscritsMap.toString() + ";\nvar champDeps = " + champDeps.toString() + ";\nvar v2Search = " + v2Search.toString() + ";\nvar ficheOf = " + ficheOf.toString() + ";\nvar bestYear = " + bestYear.toString() + ";\nvar palClOf = " + palClOf.toString() + ";\n(" + fn.toString().replace("__SV__", VERSION) + ")"; }
  // 3.47 : page de maintenance / file d'attente Ten'Up : on le dit au lieu de « Ten'Up n'a pas répondu »
  var MAINT = "var __mt = (document.title || \"\") + \" \" + Array.prototype.map.call(document.querySelectorAll(\"h1,h2\"), function (e) { return e.innerText; }).slice(0, 3).join(\" \");\n" +
    "if (/maintenance|mise à jour du site|file d'attente|queue-it|service (momentanément )?indisponible/i.test(__mt) || /maintenance/i.test(location.pathname)) return \"MONTEE-ERR maintenance\";\n";
  function nativeScript(licence, knownId, who) {
    return MAINT + "return await new Promise(function (r) { " + src(tenupFetch) + "(" + JSON.stringify(licence || "") + ", \"native\", r, " + JSON.stringify(knownId || "") + ", " + JSON.stringify(who || null) + "); });";
  }
  // 3.43.2 : relance en arrière-plan (iPhone), en alternance (Yann) : ton palmarès au plus toutes les 12 h,
  // les autres relances servent à relire tes joueurs suivis (10 au plus, 5 à la fois, 6 s max chacun).
  // Le moment de ta dernière relecture est gardé dans le stockage de la page Ten'Up (à défaut : une heure sur deux).
  function nativeScriptBg(licence, knownId, who, fol) {
    var base = "var v2Search = " + v2Search.toString() + ";\nvar ficheOf = " + ficheOf.toString() + ";\nvar bestYear = " + bestYear.toString() + ";\nvar __fetch = (" + tenupFetch.toString().replace("__SV__", VERSION) + ");\nvar __query = (" + tenupQuery.toString() + ");\n";
    return MAINT + base + "var F = " + JSON.stringify(fol || []) + ", LK = \"montee_bg_own\", last = -1;\n" +
      "try { last = +(localStorage.getItem(LK) || 0); } catch (e) {}\n" +
      "var ownDue = !F.length || (last < 0 ? Math.floor(Date.now() / 3600000) % 2 === 0 : Date.now() - last > 12 * 3600000);\n" +
      "if (ownDue) { var main = await new Promise(function (r) { __fetch(" + JSON.stringify(licence || "") + ", \"native\", r, " + JSON.stringify(knownId || "") + ", " + JSON.stringify(who || null) + "); });\n" +
      "  if (String(main).indexOf(\"MONTEE1\") === 0) { try { localStorage.setItem(LK, String(Date.now())); } catch (e) {} }\n  return main; }\n" +
      "var t0 = Date.now(), o = { folOnly: true, fol: [] };\nF.sort(function () { return Math.random() - 0.5; }); F.sort(function (a, b) { return (b.w ? 1 : 0) - (a.w ? 1 : 0); });\n" +
      "var one = function (f) { return Promise.race([__query(\"player\", f.hit), new Promise(function (r) { setTimeout(function () { r(\"\"); }, 6000); })]).then(function (q) { q = String(q || \"\"); if (q.indexOf(\"MONTEE1\") === 0) o.fol.push({ id: f.id, d: JSON.parse(q.slice(7)) }); }).catch(function () {}); };\n" +
      "for (var i = 0; i < F.length && i < 14 && Date.now() - t0 < 15000; i += 5) { await Promise.all(F.slice(i, Math.min(i + 5, 14)).map(one)); }\n" +
      "return \"MONTEE1\" + JSON.stringify(o);";
  }
  function script(licence, mode, origin, who) {
    return "(function(){" + src(tenupFetch) + "(" + JSON.stringify(licence || "") + "," + JSON.stringify(mode) + "," + JSON.stringify(origin || "") + ",\"\"," + JSON.stringify(who || null) + ");})();";
  }
  // Requête ponctuelle (recherche, fiche joueur) pour l'app : corps d'une fonction async
  function queryScript(kind, args) {
    var t = src(tenupQuery), i = t.lastIndexOf(";\n(");
    return MAINT + t.slice(0, i) + ";\nreturn await (" + t.slice(i + 3) + "(" + JSON.stringify(kind) + ", " + JSON.stringify(args || {}) + ");";
  }
  function bookmarklet(licence, origin, who) {
    return "javascript:" + encodeURIComponent(script(licence, "overlay", origin, who));
  }

  // ---- Côté Montée : lecture de ce que renvoie le script ----
  function isoDate(s) {
    s = String(s || "");
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + "-" + m[2] + "-" + m[3];
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
    var d = new Date(s); if (!isNaN(d)) return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    return "";
  }
  function normRank(c) {
    c = String(c || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!c) return "";
    if (/^N\.?C\.?$|NONCLASS/.test(c)) return "NC";
    if (/^(N°|NO|N|#|TOP)\d+/.test(c)) return "N°";
    return c;
  }
  // Type de compétition, d'après tout ce que Ten'Up dit du match (nom, type d'homologation, épreuve…)
  function kindOf(comp) {
    var c = " " + String(comp || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\-]+/g, " ") + " ";
    if (/match(s)? libre|\blibre\b/.test(c)) return "libre";
    if (/individuel|\bindiv\b|champ(\.|ionnat)? ind\b/.test(c)) return "champ";
    // 4.5.1 (testeur, 24/11) : le tennis entreprise (« CH. REGIONAL TE MESSIEURS ») se joue comme un championnat par équipes,
    // sans inscription à payer. Lu sur le nom de l'épreuve seul (avant « | »), sauf s'il dit tournoi / open / TMC.
    var head = c.split("|")[0];
    if (/ (te|entreprises?|corpo|corporatifs?) /.test(head) && !/tournoi|\bopen\b|\btmc\b/.test(head)) return "equipes";
    if (/tournoi|\bopen\b|\btmc\b|multi ?chances?|circuit|galaxie/.test(c)) return "tournoi";
    if (/equipe|interclub|rencontre|\bpoule\b|division|championnat|chpt|coupe|\+ ?\d\d\b|\d\d ?ans|plus de \d\d|seniors? plus|veterans?|\bhiver\b|\bete\b|printemps|automne|\S \/ \S/.test(c)) return "equipes";
    return "tournoi";
  }
  // Toutes les infos textuelles d'un match Ten'Up (sauf joueurs et sets), pour reconnaître la compétition
  function compText(m) {
    var out = [];
    (function walk(o, depth) {
      if (!o || depth > 2) return;
      Object.keys(o).forEach(function (k) {
        if (/^(adversaire|adversaires|partenaire|partenaires|coequipier|equipier|joueur|joueurs|sets|utilisateur)$/i.test(k)) return;
        var v = o[k];
        if (typeof v === "string" && v.length < 160 && !/^\d{4}-\d\d-\d\d/.test(v)) out.push(v);
        else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, depth + 1);
      });
    })(m, 0);
    return out.join(" | ");
  }
  // Sets lus dans le bon sens : si le score contredit le résultat (Ten'Up écrit parfois le score
  // du point de vue du vainqueur), on le retourne. Pas sur un abandon : le score peut y être trompeur.
  function orientSets(sets, res, ab) {
    if (!sets.length || ab || (res !== "V" && res !== "D")) return sets;
    var w = 0, l = 0;
    sets.forEach(function (x) { if (+x[0] > +x[1]) w++; else if (+x[0] < +x[1]) l++; });
    if ((res === "D" && w > l) || (res === "V" && l > w)) return sets.map(function (x) { return [x[1], x[0], x[2]]; });
    return sets;
  }
  function decode(text) {
    text = String(text || "").trim();
    if (text.indexOf("MONTEE-ERR") === 0) return { error: text.slice(11) };
    var i = text.indexOf("MONTEE1");
    if (i < 0) return null;
    try { return JSON.parse(text.slice(i + 7)); } catch (e) { return { error: "les données reçues sont incomplètes. Relance le raccourci." }; }
  }
  // Un match de double : deux adversaires, un partenaire, ou « double » dans son type
  function isDouble(m) {
    if (!m || typeof m !== "object") return false;
    if ((m.adversaires || []).length >= 2) return true;
    if (m.partenaire || m.partenaires || m.coequipier || m.equipier) return true;
    var keys = ["type", "typeMatch", "typeEpreuve", "typePartie", "discipline", "nature", "categorie", "libelleEpreuve", "epreuve", "specialite", "format"];
    for (var i = 0; i < keys.length; i++) {
      var v = m[keys[i]]; if (v && typeof v === "object") v = v.libelle || v.code || JSON.stringify(v);
      if (v && /doub|\bDM\b|\bDD\b|\bDX\b|mixte/i.test(String(v))) return true;
    }
    return /\bdouble/i.test(String(m.nomHomologation || ""));
  }
  // 3.47.5 : une personne dans le JSON Ten'Up, quels que soient les noms de champs (nom/prenom, nomJoueur, nomComplet…)
  function personOf(v) {
    var g = function (re) { var k = Object.keys(v).filter(function (x) { return re.test(x) && typeof v[x] === "string" && v[x].trim(); })[0]; return k ? v[k].trim() : ""; };
    var nom = g(/^(nom|nomJoueur|nomPersonne|nomFamille|lastName)$/i), pre = g(/^(prenom|prenomJoueur|prenomPersonne|firstName)$/i), full = g(/^(nomComplet|nomPrenom|prenomNom|nomEtPrenom|fullName|nomAffichage)$/i);
    if (!nom && !pre && !full) return null;
    if (!nom && !pre) { nom = full; }
    return Object.assign({}, v, { nom: nom, prenom: pre });
  }
  // 3.47.5 : squelette d'un match (clés, types, longueurs) pour comprendre où Ten'Up range le partenaire — sans aucune valeur personnelle
  function skelOf(o, d) {
    d = d || 0; if (o == null) return null; if (typeof o !== "object") return typeof o === "string" ? "s" + o.length : typeof o === "number" ? "n" : typeof o === "boolean" ? "b" : "?";
    if (d > 4) return "…"; if (Array.isArray(o)) return o.slice(0, 3).map(function (x) { return skelOf(x, d + 1); });
    var r = {}; Object.keys(o).slice(0, 40).forEach(function (k) { r[k] = skelOf(o[k], d + 1); }); return r;
  }
  function fromRaw(ms) {
    return ms.map(function (m) {
      var a = (m.adversaires || [])[0] || m.adversaire || {};
      var rk = function (x) { return x ? String(x.classementLibelle || (x.classement && (x.classement.libelle || x.classement)) || x.classementDouble || "") : ""; };
      var cl = rk(a);
      var pa = m.partenaire || (m.partenaires || [])[0] || m.coequipier || m.equipier || null; if (typeof pa === "string") pa = pa.trim() ? { prenom: "", nom: pa.trim() } : null; else if (pa && typeof pa === "object") pa = personOf(pa);
      // 3.47 (retour testeur : partenaire absent) : Ten'Up range les doubles par équipes (équipe 1 / équipe 2, joueurs…) :
      // on relève toutes les personnes qui ne sont pas des adversaires ; l'app écartera le joueur lui-même
      var mates = [];
      if (isDouble(m)) {
        var advK = (m.adversaires || []).map(function (x) { return [x.prenom, x.nom].join(" ").toLowerCase(); });
        (function walk(o, d) { if (!o || typeof o !== "object" || d > 4) return; Object.keys(o).forEach(function (k) { if (/^adversaires?$/i.test(k)) return; var v = o[k];
          var pn = v && typeof v === "object" && !Array.isArray(v) ? personOf(v) : null;
          if (pn) { var key = [pn.prenom, pn.nom].join(" ").trim().toLowerCase(); if (advK.indexOf(key) < 0 && !mates.some(function (x) { return x.k === key; })) mates.push({ k: key, p: pn }); }
          else if (typeof v === "string" && v.length > 2 && v.length < 60 && /partenaire|co.?equipier|equipier|binome/i.test(k) && !/id|licence|classement|club/i.test(k)) { var fk = v.toLowerCase(); if (!mates.some(function (x) { return x.k === fk; })) mates.push({ k: fk, p: { prenom: "", nom: v } }); }
          if (v && typeof v === "object") walk(v, d + 1); }); })(m, 0);
        if (pa && (pa.nom || pa.prenom)) { var pk = [pa.prenom, pa.nom].join(" ").trim().toLowerCase(); mates = mates.filter(function (x) { return x.k !== pk; }); mates.unshift({ k: pk, p: pa }); }
      }
      return {
        oppRanks: (m.adversaires || []).map(rk), oppNames: (m.adversaires || []).map(function (x) { return [x.prenom, x.nom].filter(Boolean).join(" "); }),
        partnerRank: rk(pa), partner: pa ? [pa.prenom, pa.nom].filter(Boolean).join(" ") : "",
        mates: mates.slice(0, 4).map(function (x) { return { n: [x.p.prenom, x.p.nom].filter(Boolean).join(" "), r: rk(x.p) }; }), skel: isDouble(m) && mates.length < 2 ? skelOf(m) : null,
        date: m.date || m.dateMatch || "", v: m.victoireUtilisateur, wo: !!m.wo, ab: !!m.abandon, dbl: isDouble(m),
        finPec: m.dateFinPEC || m.dateFinPec || m.dateFinPriseEnCompte || "", // 3.78.1 : date exacte où le match sort du calcul
        comp: m.nomHomologation || (m.competition && m.competition.libelle) || "", ctx: compText(m),
        nom: [a.prenom, a.nom].filter(Boolean).join(" ") || (a.anonyme ? "Anonyme" : ""), cl: String(cl), oid: a.idCrm || a.id || a.idPersonne || a.identifiant || "",
        olic: a.numeroLicence || a.licence || "", oyear: a.anneeNaissance || "", oclub: (a.club && typeof a.club === "object" ? a.club.nom || a.club.libelle : a.club) || a.nomClub || a.libelleClub || "",
        sets: (m.sets || []).map(function (s) { return [s.scoreUtilisateur, s.scoreAdversaire, s.scoreTieBreak]; })
      };
    });
  }
  function rows(payload) {
    var src = payload.raw && payload.raw.length ? fromRaw(payload.raw) : (payload.matches || []);
    return src.filter(function (m) { return !m.dbl; }).map(function (m) {
      var res = m.v === true || m.v === "true" || m.v === 1 ? "V" : m.v === false || m.v === "false" || m.v === 0 ? "D" : "";
      var sets = orientSets((m.sets || []).filter(function (s) { return s && s[0] != null && s[1] != null; }), res, m.ab);
      var score = sets.map(function (s) { return s[0] + "-" + s[1] + (s[2] != null && s[2] !== "" ? "(" + s[2] + ")" : ""); }).join(" ");
      if (m.ab) score += (score ? " " : "") + "ab.";
      var r = { date: isoDate(m.date), opp: m.nom || "", oid: m.oid ? String(m.oid) : "", olic: m.olic ? String(m.olic) : "", oclub: m.oclub ? String(m.oclub) : "", oyear: m.oyear ? +m.oyear : null, oppRank: normRank(m.cl), result: res, wo: !!m.wo, score: score, kind: kindOf((m.comp || "") + " | " + (m.ctx || "")), comp: m.comp || "" };
      if (m.finPec && isoDate(m.finPec)) r.finPec = isoDate(m.finPec);
      r.ok = !!(r.date && r.oppRank && r.result);
      return r;
    }).filter(function (r) { return r.date; });
  }
  // Matchs de double (pour le bonus des doubles au classement de simple)
  function doublesRows(payload) {
    if (!payload.raw || !payload.raw.length) return [];
    return fromRaw(payload.raw).filter(function (m) { return m.dbl; }).map(function (m) {
      var res = m.v === true || m.v === "true" || m.v === 1 ? "V" : m.v === false || m.v === "false" || m.v === 0 ? "D" : "";
      var sets = orientSets((m.sets || []).filter(function (s) { return s && s[0] != null && s[1] != null; }), res, m.ab);
      var ranks = (m.oppRanks || []).map(normRank).filter(Boolean);
      return { date: isoDate(m.date), result: res, wo: !!m.wo, dbl: true, oppRanks: ranks, oppRank: ranks[0] || "",
        opp: (m.oppNames || []).filter(Boolean).join(" / "), partner: m.partner || "", partnerRank: normRank(m.partnerRank) || "", mates: (m.mates || []).map(function (x) { return { n: x.n, r: normRank(x.r) || "" }; }), skel: m.skel || null,
        score: sets.map(function (s) { return s[0] + "-" + s[1]; }).join(" "), comp: m.comp || "", finPec: m.finPec ? isoDate(m.finPec) : "" };
    }).filter(function (r) { return r.date && r.result && r.oppRank; });
  }

  // Bonus double officiel : Ten'Up détaille, dans sa simulation, les points rapportés par
  // chaque victoire en double. On cherche ces lignes (deux adversaires + des points) sans
  // dépendre du nom exact des champs.
  var PTS_KEYS = ["points", "nbPoints", "pointsBonus", "bonus", "pointsDouble", "point", "valeur"];
  function nm(x) { return x && typeof x === "object" ? [x.prenom, x.nom].filter(Boolean).join(" ") || x.libelle || x.nomComplet || "" : String(x || ""); }
  function officialDoubles(obj) {
    var out = [], seen = 0;
    (function walk(o, depth, dbl) {
      if (!o || depth > 7 || seen > 5000) return; seen++;
      if (Array.isArray(o)) { o.forEach(function (x) { walk(x, depth + 1, dbl); }); return; }
      if (typeof o !== "object") return;
      var adv = Array.isArray(o.adversaires) ? o.adversaires : o.adversaire1 ? [o.adversaire1, o.adversaire2] : o.joueur1 && o.joueur2 ? [o.joueur1, o.joueur2] : null;
      var pts = null;
      for (var i = 0; i < PTS_KEYS.length && pts == null; i++) { var v = o[PTS_KEYS[i]]; if (v !== "" && v != null && isFinite(+v)) pts = +v; }
      if (adv && adv.length >= 2 && pts != null && (dbl || adv.filter(Boolean).length >= 2)) {
        var names = adv.map(nm).filter(Boolean);
        if (names.length >= 2) out.push({ names: names, pts: pts, w: adv.map(function (x) { return x && (x.classement != null ? (x.classement.valeur != null ? x.classement.valeur : x.classement.libelle || x.classement) : x.valeur != null ? x.valeur : x.classementLibelle); }) });
      }
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && o[k] && typeof o[k] === "object") walk(o[k], depth + 1, dbl || /doub/i.test(k));
    })(obj, 0, false);
    return out;
  }
  function skeleton(o, depth) {
    if (depth > 5) return "…";
    if (Array.isArray(o)) return o.length ? [skeleton(o[0], depth + 1), o.length] : [];
    if (o && typeof o === "object") { var r = {}; Object.keys(o).slice(0, 40).forEach(function (k) { r[k] = skeleton(o[k], depth + 1); }); return r; }
    return typeof o === "string" ? (o.length > 24 ? o.slice(0, 24) + "…" : o) : o;
  }

  // Simulation officielle : on garde l'essentiel, en tolérant les variations de format
  function official(payload) {
    var sim = payload.simulation || {}, bil = payload.bilan || {};
    var line = function (x) {
      return { c: x.classement && (x.classement.libelle || x.classement) || x.libelle || "", pts: x.pointsCumules, quota: x.quota, manque: x.pointsManquants, V: x.victoires, D: x.defaites };
    };
    return {
      at: payload.at, classement: payload.profil && payload.profil.classement,
      message: sim.messageSimulation || (sim.messages || []).join(" ") || "",
      simulation: (sim.resultatSimulation || []).map(line),
      doubles: officialDoubles(payload.simulation),
      simShape: skeleton(payload.simulation || null, 0),
      dblSample: payload.raw ? (payload.raw.filter(isDouble)[0] || null) : null,
      bilans: (bil.bilans || []).map(line),
      calcule: bil.classement && (bil.classement.calcule || bil.classement.libelle) || ""
    };
  }

  // 3.74.1 : départements indiqués dans le nom d'un championnat (« … - 25/90 », « CD57-… », « … (90) ») ; null si aucun
  function champDeps(n) { n = String(n || ""); var m = n.match(/-\s*(\d{2}[AB]?(?:\s*\/\s*\d{2}[AB]?)*)\s*$/) || n.match(/^CD\s*(\d{2})\b/i) || n.match(/\((\d{2})\)\s*$/); return m ? m[1].split(/\s*\/\s*/) : null; }
  function doublesCount(payload) { return payload.raw ? fromRaw(payload.raw).filter(function (m) { return m.dbl; }).length : 0; }
  var api = { cardsFrom: cardsFrom, cardMap: cardMap, ficheMap: ficheMap, lieuMap: lieuMap, tuInfos: tuInfos, dispoLimFrom: dispoLimFrom, dispoDays: dispoDays, genMap: genMap, dzMapping: dzMapping, dzGenSlots: dzGenSlots, dzBody: dzBody, dzSame: dzSame, tsMap: tsMap, inscritsMap: inscritsMap, champDeps: champDeps, ficheOf: ficheOf, queryScript: queryScript, nativeScriptBg: nativeScriptBg, tenupQuery: tenupQuery, v2Search: v2Search, fromRaw: fromRaw, kindOf: kindOf, orientSets: orientSets, nativeScript: nativeScript, VERSION: VERSION, doublesCount: doublesCount, doublesRows: doublesRows, isDouble: isDouble, script: script, bookmarklet: bookmarklet, decode: decode, rows: rows, official: official, normRank: normRank };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MonteeTenup = api;
})(this);
