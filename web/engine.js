/* Montée — moteur de calcul du classement FFT (tennis, simple).
   Rejoue le bilan tel que décrit par la FFT : 12 mois glissants, barème selon
   l'écart d'échelons, V-E-2I-5G, nombre de victoires prises en compte, bonus.
   Les valeurs viennent des normes publiées par la FFT (mise à jour janvier 2023).
   À vérifier à chaque changement de règlement : tout est dans BAREME ci-dessous.
   Calcul indicatif : seul le classement officiel fait foi. */
(function (root) {
  "use strict";

  var ECHELONS = ["40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1",
    "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6", "-15", "N°"];
  var TOP = 22;   // numérotés (Top 100, Top 60…) : bilan non simulable
  var MAX_CALC = 21; // -15

  var BAREME = {
    // Points d'une victoire selon (échelon adversaire − échelon de calcul)
    win: function (diff) {
      if (diff >= 2) return 120;
      if (diff === 1) return 90;
      if (diff === 0) return 60;
      if (diff === -1) return 30;
      if (diff === -2) return 20;
      if (diff === -3) return 15;
      return 0;
    },
    // Bonus championnats individuels (France et phases qualificatives) : par victoire selon la série du bilan,
    // 3 meilleures bonifications jusqu'à 0, 5 à partir de -2/6
    champ: function (calc) { return { par: calc <= 5 ? 15 : calc <= 11 ? 20 : 25, max: calc >= 19 ? 5 : 3 }; },
    // Bonus des victoires en double (depuis 2023) : perf / poids égal / contre, et nombre max de doubles bonifiés
    double: function (calc) {
      if (calc <= 5) return { perf: 5, egal: 3, contre: 1, max: 5 };
      if (calc <= 11) return { perf: 5, egal: 3, contre: 1, max: 7 };
      if (calc <= 18) return { perf: 7, egal: 4, contre: 2, max: 7 };
      return { perf: 10, egal: 6, contre: 3, max: 7 };
    },
    // Bilan minimum (norme) pour être classé à l'échelon, index = ECHELONS
    norme: {
      H: [0, 6, 70, 120, 170, 210, 285, 305, 315, 325, 335, 360, 420, 435, 435, 475, 505, 550, 610, 765, 865, 930],
      F: [0, 6, 70, 120, 170, 210, 265, 295, 305, 305, 325, 345, 385, 395, 430, 500, 560, 610, 630, 760, 740, 780]
    },
    // Nombre de victoires de base prises en compte
    base: {
      H: [6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 9, 9, 9, 10, 10, 11, 12, 15, 17, 19],
      F: [6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 9, 9, 9, 10, 11, 12, 14, 15, 16, 17]
    },
    // Bonus « absence de défaite significative » : aucune défaite (WO compris) contre un joueur classé
    // à l'échelon du bilan ou en dessous. Montant et seuil selon l'échelon du bilan.
    bonusSansDefaite: function (idx, nMatchs) {
      if (idx >= 12 && idx <= MAX_CALC) return nMatchs >= 10 ? 100 : 0;
      if (idx >= 6 && idx <= 11) return nMatchs >= 10 ? 50 : 0;
      if (idx === 4 || idx === 5) return nMatchs >= 5 ? 50 : 0;
      return 0;
    },
    woIgnores: 3 // les 3 premières défaites par WO ne comptent pas (vérifié sur Ten'Up : 3 WO, aucune pénalité dans V-E-2I-5G)
  };

  function serie(idx) {
    if (idx <= 5) return 4;
    if (idx <= 11) return 3;
    if (idx <= 18) return 2;   // 2e série positive
    return 1;                  // 2e série négative (et au-delà)
  }
  function serieLabel(idx) {
    if (idx < 0) return "Non classé";
    if (idx <= 5) return "4e série";
    if (idx <= 11) return "3e série";
    if (idx <= MAX_CALC) return "2e série";
    return "1re / 2e série numérotée";
  }

  // Ajustement du nombre de victoires selon V-E-2I-5G
  function ajustement(idx, v) {
    var s = serie(idx);
    if (s === 4) {
      if (v < 0) return 0;
      return v >= 25 ? 6 : v >= 20 ? 5 : v >= 15 ? 4 : v >= 10 ? 3 : v >= 5 ? 2 : 1;
    }
    var pos = v >= 40 ? 6 : v >= 30 ? 5 : v >= 23 ? 4 : v >= 15 ? 3 : v >= 8 ? 2 : 1;
    if (s === 3) return v < 0 ? 0 : pos;
    if (s === 2) {
      if (v >= 0) return pos;
      return v > -21 ? 0 : v > -31 ? -1 : v > -41 ? -2 : -3;
    }
    if (v >= 0) return v >= 45 ? 7 : v >= 35 ? 6 : v >= 30 ? 5 : v >= 25 ? 4 : v >= 20 ? 3 : v >= 10 ? 2 : 1;
    return v > -21 ? 0 : v > -31 ? -1 : v > -41 ? -2 : v > -61 ? -3 : v > -81 ? -4 : -5;
  }

  // "15/2", "15 / 2", "NC", "N°45", "-2/6"… → index (NC = -1)
  function idx(label) {
    if (label == null) return null;
    var s = String(label).trim().toUpperCase().replace(/\s+/g, "").replace("–", "-").replace("—", "-");
    if (s === "" ) return null;
    if (s === "NC" || s === "N.C." || s === "40/1" || s === "40/2") return s === "NC" || s === "N.C." ? -1 : 0;
    if (/^(N°|NO|N|#|TOP)\d*/.test(s) && s !== "N") return TOP;
    var i = ECHELONS.indexOf(s);
    return i >= 0 ? i : null;
  }
  function label(i) { return i < 0 ? "NC" : i >= TOP ? "Numéroté" : ECHELONS[i]; }

  // ---------- Dates ----------
  function d(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(dt) {
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  }
  function firstTuesday(y, m) {
    var dt = new Date(y, m, 1);
    while (dt.getDay() !== 2) dt.setDate(dt.getDate() + 1);
    return dt;
  }
  // Prochaine sortie du classement : premier mardi du mois
  function nextRelease(today) {
    var t = today ? new Date(today.getFullYear(), today.getMonth(), today.getDate()) : new Date();
    t.setHours(0, 0, 0, 0);
    var ft = firstTuesday(t.getFullYear(), t.getMonth());
    if (t < ft) return ft;
    return firstTuesday(t.getFullYear(), t.getMonth() + 1);
  }
  function minus12Months(dt) { return new Date(dt.getFullYear() - 1, dt.getMonth(), dt.getDate()); }
  function plus12Months(dt) { return new Date(dt.getFullYear() + 1, dt.getMonth(), dt.getDate()); }
  // Dernier jour où un match compte encore : la date de fin de prise en compte de Ten'Up (dateFinPEC, en pratique
  // le jour de la dernière sortie qui le compte) quand on l'a, sinon 12 mois jour pour jour après le match.
  // Relevé sur Ten'Up (23/11/2026) : la sortie du 5 janv. 2027 compte les matchs du 5 janv. 2026 au 4 janv. 2027.
  function lastDay(m) {
    if (m && m.finPec && /^\d{4}-\d{2}-\d{2}/.test(m.finPec)) return d(m.finPec.slice(0, 10));
    return m && m.date ? plus12Months(d(m.date)) : null;
  }
  // Sortie du classement à partir de laquelle le match ne compte plus
  function leaveDate(m) { var l = lastDay(m); return l ? nextRelease(l) : null; }
  // Matchs pris en compte pour un calcul à la date `at`, joués au plus tard le `upTo`
  // Les matchs sans date (import Ten'Up : la date n'est pas affichée) sont ceux de la période en cours.
  function windowMatches(matches, at, upTo, undated) {
    var from = minus12Months(at);
    var lim = upTo || at, ym = at.getFullYear() * 12 + at.getMonth();
    return matches.filter(function (m) {
      if (!m.date) return undated !== false && idx(m.oppRank) !== null;
      var md = d(m.date);
      // la période de calcul s'arrête la veille de la sortie (Ten'Up : « du 5 janv. 2026 au 4 janv. 2027 »)
      if (idx(m.oppRank) === null || md > lim || md >= at) return false;
      // Ten'Up donne la dernière sortie qui compte le match (dateFinPEC) : elle fait foi
      if (m.finPec && /^\d{4}-\d{2}-\d{2}/.test(m.finPec)) { var f = d(m.finPec.slice(0, 10)); return ym <= f.getFullYear() * 12 + f.getMonth(); }
      return md >= from; // 12 mois, premier jour compris
    });
  }

  // ---------- Bonus des doubles ----------
  // Poids d'une paire : somme des échelons des deux joueurs au jour du match (plus c'est haut, plus la paire est forte).
  // Victoire en perf (paire adverse plus forte), à poids égal, ou en contre.
  function pairIdx(r) { var i = idx(r); return i == null ? -1 : Math.min(i, TOP); }
  function doublesBonus(dbl, calc, playerIdx) {
    var sc = BAREME.double(calc), list = [];
    dbl.forEach(function (m) {
      if (m.officialPts != null && isFinite(m.officialPts)) {
        // Ten'Up donne les points (5/3/1, 7/4/2 ou 10/6/3) : on en déduit perf / égal / contre
        var op = +m.officialPts, k = op >= 5 ? "perf" : op <= 2 ? "contre" : "egal";
        list.push({ m: m, kind: k, pts: sc[k], official: true }); return;
      }
      var me = playerIdx < 0 ? -1 : playerIdx;
      var mine = me + (m.partnerRank ? pairIdx(m.partnerRank) : me);
      var opp = (m.oppRanks || [m.oppRank]).map(pairIdx);
      if (opp.length < 2) opp.push(opp[0]);
      var theirs = opp[0] + opp[1];
      var kind = theirs > mine ? "perf" : theirs === mine ? "egal" : "contre";
      list.push({ m: m, kind: kind, pts: sc[kind] });
    });
    list.sort(function (a, b) { return b.pts - a.pts || (a.m.date < b.m.date ? 1 : -1); });
    var counted = list.slice(0, sc.max);
    return { total: counted.reduce(function (s, x) { return s + x.pts; }, 0), counted: counted, max: sc.max };
  }

  // Bonus d'une victoire en championnat individuel : selon la série du bilan, 15 pts en seniors+ (relevé Ten'Up :
  // « Individuels seniors 3e série » 20 pts, « Individuels seniors+ » 15 pts, pour un bilan à 15/4)
  function champBonusOf(m, calc) {
    var par = BAREME.champ(calc).par;
    return /s[ée]niors?\s*\+|seniors?\s*plus|\+\s*\d{2}\s*ans/i.test(m.comp || "") ? Math.min(par, 15) : par;
  }

  // ---------- Bilan à un échelon ----------
  function bilanAt(matches, calc, sex, playerIdx, extra) {
    sex = sex === "F" ? "F" : "H";
    var wins = [], E = 0, I = 0, G = 0, V = 0, woLoss = 0, champVals = [], sigLoss = false, nSingles = 0, dbl = [];
    var sorted = matches.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    sorted.forEach(function (m) {
      if (m.dbl) { if (m.result === "V" && !m.wo) dbl.push(m); return; }
      if (!m.wo) nSingles++;
      var o = idx(m.oppRank);
      if (m.result === "V") {
        if (m.wo) return; // victoire par WO : ne rapporte pas de points
        V += 1;
        var pts = BAREME.win(o - calc);
        wins.push({ m: m, pts: pts, opp: o });
        if (m.kind === "champ") champVals.push(champBonusOf(m, calc));
      } else if (m.result === "D") {
        if (o <= calc) sigLoss = true;
        if (m.wo) {
          woLoss++;
          if (woLoss > BAREME.woIgnores) G += 1;
          return;
        }
        var diff = o - calc;
        if (diff === 0) E++;
        else if (diff === -1) I++;
        else if (diff <= -2) G++;
      }
    });
    var ve = V - E - 2 * I - 5 * G;
    var n = Math.max(0, BAREME.base[sex][Math.min(calc, MAX_CALC)] + ajustement(calc, ve));
    wins.sort(function (a, b) { return b.pts - a.pts || (a.m.date < b.m.date ? 1 : -1); });
    var counted = wins.slice(0, n), extraWins = wins.slice(n);
    var sum = counted.reduce(function (s, w) { return s + w.pts; }, 0);
    var bonusSD = sigLoss ? 0 : BAREME.bonusSansDefaite(calc, nSingles);
    // les meilleures bonifications seulement (3, ou 5 à partir de -2/6)
    var bonusCh = champVals.sort(function (a, b) { return b - a; }).slice(0, BAREME.champ(calc).max).reduce(function (a, v) { return a + v; }, 0);
    var db = doublesBonus(dbl, calc, playerIdx);
    if (extra && typeof extra === "object") {
      // écart Ten'Up par échelon : celui de l'échelon, sinon le plus proche
      var ks = Object.keys(extra).map(Number).sort(function (a, b) { return Math.abs(a - calc) - Math.abs(b - calc) || b - a; });
      extra = ks.length ? +extra[ks[0]] || 0 : 0;
    }
    extra = extra || 0;
    var total = sum + bonusSD + bonusCh + db.total + extra;
    var norme = calc <= 0 ? 0 : BAREME.norme[sex][Math.min(calc, MAX_CALC)];
    var winAtLevel = wins.some(function (w) { return w.opp >= calc; });
    return {
      calc: calc, label: label(calc), V: V, E: E, I: I, G: G, ve: ve, n: n,
      counted: counted, extra: extraWins, adjust: extra, sum: sum, bonusSD: bonusSD, bonusCh: bonusCh,
      bonusDbl: db.total, doubles: db.counted, doublesWon: dbl.length,
      total: total, norme: norme, reached: total >= norme, winAtLevel: winAtLevel,
      weakest: counted.length >= n && counted.length ? counted[counted.length - 1].pts : 0,
      slotsFree: Math.max(0, n - counted.length), descente100: serie(calc) <= 2 && ve <= -100
    };
  }

  // ---------- D'une sortie à la suivante ----------
  // Tout ce qui fait bouger le bilan entre deux calculs au même échelon, pour que la liste
  // s'additionne exactement à l'écart des totaux :
  //  out   : victoire comptée qui sort des 12 mois (−)
  //  drop  : victoire encore là mais plus comptée (moins de victoires prises en compte) (−)
  //  in    : victoire qui prend le relais (hors quota jusqu'ici, ou plus de victoires comptées) (+)
  //  bonus : bonus qui part ou qui revient (sans défaite significative, championnat indivs, doubles) (±)
  var BONUS_KEYS = [["bonusSD", "Bonus sans défaite significative"], ["bonusCh", "Bonus championnat (indivs)"], ["bonusDbl", "Bonus doubles"]];
  function releaseDiff(prev, next) {
    var nowC = next.counted.map(function (w) { return w.m; }), nowX = (next.extra || []).map(function (w) { return w.m; });
    var wasC = prev.counted.map(function (w) { return w.m; });
    var rows = [];
    prev.counted.forEach(function (w) {
      if (nowC.indexOf(w.m) >= 0) return;
      rows.push({ k: nowX.indexOf(w.m) >= 0 ? "drop" : "out", w: w, pts: -w.pts });
    });
    next.counted.forEach(function (w) { if (wasC.indexOf(w.m) < 0) rows.push({ k: "in", w: w, pts: w.pts }); });
    BONUS_KEYS.forEach(function (b) {
      var dl = (next[b[0]] || 0) - (prev[b[0]] || 0);
      if (dl) rows.push({ k: "bonus", key: b[0], label: b[1], pts: dl });
    });
    var adj = (next.adjust || 0) - (prev.adjust || 0);
    if (adj) rows.push({ k: "adjust", label: "Ajustement d'après Ten'Up", pts: adj });
    return rows;
  }

  // ---------- Classement projeté ----------
  // current : index du classement actuel ; sex : "H" | "F"
  function project(matches, current, sex, opts) {
    opts = opts || {};
    var today = opts.today || new Date();
    var release = opts.release || nextRelease(today);
    var win = windowMatches(matches, release, today);
    var cur = current < 0 ? 0 : current;
    if (current >= TOP) {
      return { status: "top", release: release, current: current, matches: win.filter(function (m) { return !m.dbl; }) };
    }
    var result = cur, steps = [];
    // Montée : on teste l'échelon au-dessus, puis encore au-dessus…
    for (var k = cur + 1; k <= MAX_CALC; k++) {
      var b = bilanAt(win, k, sex, cur, opts.extra);
      steps.push(b);
      if (b.reached && b.winAtLevel) result = k; else break;
    }
    var next = bilanAt(win, Math.min(cur + 1, MAX_CALC), sex, cur, opts.extra);
    var here = bilanAt(win, cur, sex, cur, opts.extra);
    var status;
    if (result > cur) status = "montee";
    else if (cur === 0 || (here.reached && !here.descente100)) status = "maintien";
    else status = "descente";
    // 3.55.3 (Yann) : règle FFT, la descente est limitée à 1 échelon par période de 12 mois. Déjà descendu
    // il y a moins de 12 mois (sans être remonté depuis) : pas de nouvelle descente à cette sortie.
    var kept = false;
    if (status === "descente" && opts.protectUntil && release < opts.protectUntil) { status = "maintien"; kept = true; }
    if (current < 0 && win.some(function (m) { return !m.dbl && (m.result === "V" || m.result === "D"); })) {
      // Non classé : il suffit d'un match homologué pour entrer à 40 ;
      // on garde le calcul pour la suite.
      if (status === "maintien") status = "entree";
    }
    return {
      status: status, release: release, current: current, projected: status === "descente" ? cur - 1 : result,
      here: here, next: next, steps: steps, matches: win.filter(function (m) { return !m.dbl; }),
      gap: Math.max(0, next.norme - next.total), needWin: !next.winAtLevel,
      margin: here.total - here.norme, kept: kept, protectUntil: opts.protectUntil || null
    };
  }

  // Effet d'une victoire hypothétique contre un adversaire classé `oppIdx`
  function simulateWin(matches, current, sex, oppIdx, opts) {
    opts = opts || {};
    var today = opts.today || new Date();
    var fake = { id: "_sim", date: iso(today), result: "V", oppRank: label(oppIdx), kind: opts.kind || "tournoi" };
    var before = project(matches, current, sex, opts);
    var after = project(matches.concat([fake]), current, sex, opts);
    var gain = after.next.total - before.next.total;
    return { before: before, after: after, gain: gain, pts: BAREME.win(oppIdx - Math.min(current + 1, MAX_CALC)) };
  }

  // Victoires qui sortent des 12 mois d'ici la sortie (et rapportaient des points)
  function dropOuts(matches, current, sex, opts) {
    opts = opts || {};
    var today = opts.today || new Date();
    var release = opts.release || nextRelease(today);
    return matches.filter(function (m) {
      if (m.dbl || m.result !== "V" || !m.date) return false;
      var lv = leaveDate(m);
      return lv > today && lv <= release;
    }).map(function (m) {
      return { m: m, leaves: leaveDate(m), pts: BAREME.win(idx(m.oppRank) - Math.min((current < 0 ? 0 : current) + 1, MAX_CALC)) };
    });
  }

  // Historique : bilan à l'échelon `calc` à chaque sortie des 12 derniers mois
  function history(matches, calc, sex, playerIdx, today, extra) {
    today = today || new Date();
    var out = [];
    for (var i = 11; i >= 0; i--) {
      var rel = firstTuesday(today.getFullYear(), today.getMonth() - i);
      var w = windowMatches(matches, rel, rel, false);
      var b = bilanAt(w, calc, sex, playerIdx);
      out.push({ date: rel, total: b.total, norme: b.norme });
    }
    var nr = nextRelease(today);
    var bn = bilanAt(windowMatches(matches, nr, today), calc, sex, playerIdx, extra);
    out.push({ date: nr, total: bn.total, norme: bn.norme, projected: true });
    return out;
  }

  // Score "6-4 3-6 7-6" → sets
  function parseScore(score) {
    var sets = [];
    String(score || "").replace(/(\d{1,2})\s*[-\/]\s*(\d{1,2})(?:\s*\(\s*\d+\s*\))?/g, function (_, a, b) {
      sets.push([+a, +b]); return _;
    });
    return sets;
  }

  var api = {
    ECHELONS: ECHELONS, TOP: TOP, MAX_CALC: MAX_CALC, BAREME: BAREME,
    idx: idx, label: label, serie: serie, serieLabel: serieLabel, ajustement: ajustement,
    bilanAt: bilanAt, project: project, simulateWin: simulateWin, dropOuts: dropOuts,
    history: history, nextRelease: nextRelease, windowMatches: windowMatches, doublesBonus: doublesBonus,
    parseScore: parseScore, iso: iso, parseDate: d, plus12Months: plus12Months, leaveDate: leaveDate, lastDay: lastDay, releaseDiff: releaseDiff
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MonteeEngine = api;
})(this);
