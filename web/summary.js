/* Montée — résumé d'un import Ten'Up pour les notifications.
   Utilisé dans l'app (premier plan) et par l'app iPhone en arrière-plan (JavaScriptCore,
   sans page web) : ne dépend que de MonteeEngine et MonteeTenup.
   monteeSummary(payload, state) → JSON { title, body, state } ou { state } s'il n'y a rien de neuf. */
(function (root) {
  "use strict";
  var JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  function jour(d) { return JOURS[d.getDay()] + " " + d.getDate() + " " + MOIS[d.getMonth()]; }
  function key(r) { return r.date + "|" + r.oppRank + "|" + r.result; }
  // 3.43.2 : « Prénom NOM » comme dans l'app
  function nameCase(n) {
    n = String(n || "").replace(/\s+/g, " ").trim(); if (!n) return "";
    var p = n.split(" "), up = function (x) { return x.length > 1 && !/\.$/.test(x) && x === x.toUpperCase() && /[A-ZÀ-Ý]/.test(x); };
    if (p.length < 2) return n.toUpperCase();
    var caps = p.filter(up), low = p.filter(function (x) { return !up(x); }), pre = caps.length && low.length ? low.join(" ") : p[0], nom = caps.length && low.length ? caps.join(" ") : p.slice(1).join(" ");
    return pre.charAt(0).toUpperCase() + pre.slice(1).toLowerCase() + " " + nom.toUpperCase();
  }
  function toks(n) { return String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z]+/).filter(function (t) { return t.length >= 3; }); }
  function days(a, b) { var x = Date.parse(a), y = Date.parse(b); return isNaN(x) || isNaN(y) ? 99 : Math.abs(x - y) / 864e5; }
  // Un match Ten'Up déjà saisi à la main dans Montée ? (même résultat, à 7 jours près, même nom ou même classement + même score)
  function claimManual(r, manual, used) {
    for (var i = 0; i < manual.length; i++) {
      var m = manual[i]; if (used[i] || m.res !== r.result) continue;
      var d = m.d ? days(m.d, r.date) : 0; if (d > 7) continue;
      var tn = toks(r.opp), nm = toks(m.n).some(function (t) { return tn.indexOf(t) >= 0; }), rk = m.r && m.r === r.oppRank;
      if (nm || (rk && d <= 2)) { used[i] = 1; return true; }
    }
    return false;
  }

  // Phrase d'état du classement, réutilisée par les notifications
  function statusLine(p) {
    var E = root.MonteeEngine;
    if (!p || p.status === "top") return "";
    var rel = jour(p.release);
    if (p.status === "montee") return "D'après Montée, tu montes à " + E.label(p.projected) + " le " + rel + ".";
    if (p.status === "descente") return "Attention : risque de descente à " + E.label(p.projected) + " le " + rel + ".";
    var nx = p.next;
    if (p.gap === 0 && p.needWin) return "Il te manque une victoire contre un " + nx.label + " pour monter le " + rel + ".";
    return "Bilan à " + nx.label + " : " + nx.total + " / " + nx.norme + " pts. Il en manque " + p.gap + " pour monter le " + rel + ".";
  }


  // ---- 3.43.2 : ton profil de compétiteur, version légère (même calcul avant / après les nouveaux matchs) ----
  function setsOf(score) { var out = []; String(score || "").replace(/(\d{1,2})\s*[-\/]\s*(\d{1,2})(\s*\(\s*\d+(?:\s*[-\/]\s*\d+)?\s*\))?/g, function (_, x, y) { out.push([+x, +y]); return _; }); return out; }
  function expWin(o, cur) { return 1 / (1 + Math.exp(0.75 * (o - (cur < 0 ? 0 : cur)))); }
  function setP(p) { var lo = 0, hi = 1; for (var k = 0; k < 30; k++) { var md = (lo + hi) / 2; if (md * md * (3 - 2 * md) < p) lo = md; else hi = md; } return (lo + hi) / 2; }
  var CPL = { perf: ["Perf", "contre les mieux classés", "gagne"], solid: ["Solidité", "contre les moins bien classés", "gagne"], mental: ["Mental", "après un 1er set perdu", "renverse"], endu: ["Endurance", "dans les matchs en 3 sets", "gagne"] };
  function cpLight(rows, cur, todayD) {
    var E = root.MonteeEngine, lim = new Date(todayD.getTime()); lim.setFullYear(lim.getFullYear() - 1);
    var ms = rows.filter(function (r) { return r.ok && !r.wo && (r.result === "V" || r.result === "D") && E.idx(r.oppRank) != null && r.date && E.parseDate(r.date) > lim; });
    var c0 = cur < 0 ? 0 : cur, out = {};
    var g = function (k, list, ef) { var v = 0, e = 0; list.forEach(function (m) { var p = expWin(E.idx(m.oppRank), c0); e += ef ? ef(p) : p; if (m.result === "V") v++; }); var n = list.length;
      out[k] = { n: n, v: v, e: e, st: n < 4 ? "lock" : v - e >= 1 ? "fort" : e - v >= 0.9 ? "faible" : "norme" }; };
    g("perf", ms.filter(function (m) { return E.idx(m.oppRank) > c0; }));
    g("solid", ms.filter(function (m) { return E.idx(m.oppRank) < c0; }));
    g("mental", ms.filter(function (m) { var x = setsOf(m.score); return x.length && x[0][0] < x[0][1]; }), function (p) { var x = setP(p); return x * x; });
    g("endu", ms.filter(function (m) { return setsOf(m.score).length >= 3; }), function (p) { return setP(p); });
    return out;
  }
  function cpNotes(before, after, curL, plus) {
    var out = [];
    Object.keys(CPL).forEach(function (k) {
      var a = before[k], b = after[k]; if (!a || !b || a.st === b.st || a.st === "lock" || b.st === "lock") return;
      var L = CPL[k], line = b.v + " sur " + b.n + " " + L[1] + ", un " + curL + " en " + L[2] + " " + Math.round(b.e) + ".";
      var t = b.st === "fort" ? L[0] + " devient un point fort" : b.st === "faible" ? L[0] + " passe à travailler" : a.st === "faible" ? "Ton profil a bougé : " + L[0] + " passe dans la norme" : L[0] + " n'est plus un point fort";
      out.push({ title: t.charAt(0).toUpperCase() + t.slice(1), body: line + " Touche pour voir ta fleur." });
    });
    if (!out.length) return [];
    if (!plus) return [{ title: "Ton profil de compétiteur a bougé", body: (out.length > 1 ? out.length + " de tes compétences ont changé" : "Une de tes compétences a changé") + " avec tes derniers matchs. Découvre laquelle avec Montée+." }];
    return out.slice(0, 2);
  }
  // ---- 3.43.2 : joueurs suivis relus en arrière-plan ----
  function folNotes(pl, st, cur) {
    var T = root.MonteeTenup, E = root.MonteeEngine, out = [], snap = Object.assign({}, st.fol || {});
    (pl.fol || []).forEach(function (x) {
      var o = snap[x.id], d = x.d || {}; if (!o || d.error) return;
      var rank = T.normRank(d.profil && d.profil.classement) || o.r, ri = E.idx(rank), ro = E.idx(o.r);
      var rows = []; try { rows = T.rows({ raw: d.raw }) || []; } catch (e) {}
      rows = rows.filter(function (r) { return r.ok && r.date && (r.result === "V" || r.result === "D"); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      var fresh = rows.filter(function (r) { return r.date > (o.last || ""); }), big = fresh.filter(function (r) { return r.result === "V" && E.idx(r.oppRank) >= (cur < 0 ? 0 : cur); })[0];
      if (ri != null && ro != null && ri > ro) out.push({ title: o.n + " est monté " + rank, body: "Il était " + o.r + "." });
      else if (big && o.last) out.push({ title: o.n + " a battu un joueur de ton niveau", body: "Victoire " + (big.score ? big.score + " " : "") + "contre un " + big.oppRank + "." });
      snap[x.id] = { n: o.n, r: rank || o.r, last: rows[0] ? rows[0].date : o.last };
    });
    return { notes: out, fol: snap };
  }
  // 3.44.2 : « le vainqueur de A / B » : leur match est sur Ten'Up, on te dit contre qui tu joues
  function invSc(sc) { return String(sc || "").replace(/(\d{1,2})\s*([-\/])\s*(\d{1,2})/g, function (_, a, s, b) { return b + "-" + a; }); }
  function watchNotes(pl, st) {
    var T = root.MonteeTenup, out = [], W = (st.watch || []).map(function (w) { return Object.assign({}, w); });
    (pl.fol || []).forEach(function (x) {
      var d = x.d || {}; if (d.error) return;
      W.forEach(function (w) {
        if (w.done || String(w.id) !== String(x.id)) return;
        var rows = []; try { rows = T.rows({ raw: d.raw }) || []; } catch (e) {}
        var vt = toks(w.vs), r = rows.filter(function (r) { return r.ok && r.date && r.date >= (w.from || "") && !r.wo && (r.result === "V" || r.result === "D") && toks(r.opp).some(function (t) { return vt.indexOf(t) >= 0; }); })[0];
        if (!r) return;
        w.done = true;
        var won = r.result === "V", win = won ? w.n : nameCase(w.vs), lose = won ? nameCase(w.vs) : w.n, sc = won ? r.score : invSc(r.score);
        out.push({ title: w.lab + " : tu joues " + win, body: "Il a battu " + lose + (sc ? " " + sc : "") + ". Voir l'analyse dans Montée." });
      });
    });
    return { notes: out, watch: W };
  }
  // ---- 3.49 : réglages des notifications (st.np), « Combien », jamais entre 21 h et 8 h ----
  function npOn(st, k) { var p = st.np || {}; return p[k] == null ? true : !!p[k]; }
  function nowD() { return root.__monteeNow ? new Date(root.__monteeNow) : new Date(); }
  function quietNow(st) { if ((st.np || {}).quiet === false) return false; var h = nowD().getHours(); return h >= 21 || h < 8; }
  function weekKey(d) { var x = new Date(d.getTime()); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x.getFullYear() + "-" + (x.getMonth() + 1) + "-" + x.getDate(); }
  // L'essentiel : tes matchs, ta poule, ton classement. Normal : 3 autres (copains, jalons…) par semaine au plus. Tout : sans limite.
  function capMore(st, more) {
    var lvl = (st.np || {}).lvl || "norm", wk = st.wk && st.wk.w === weekKey(nowD()) ? { w: st.wk.w, n: st.wk.n } : { w: weekKey(nowD()), n: 0 };
    var out = more.filter(function (n) { if (n.ess || lvl === "tout") return true; if (lvl === "ess" || wk.n >= 3) return false; wk.n++; return true; });
    return { more: out.map(function (n) { return { title: n.title, body: n.body }; }), wk: wk };
  }
  // ---- 3.49 : ta poule a bougé (fiches de tes adversaires de poule relues en arrière-plan) ----
  function pKey(date, a, b) { return date + "|" + [toks(a).join(" "), toks(b).join(" ")].sort().join("|"); }
  function samePl(a, b) { var ta = toks(a), tb = toks(b), n = ta.filter(function (t) { return tb.indexOf(t) >= 0; }).length; return n > 0 && n >= Math.min(2, ta.length, tb.length); }
  function first(n) { return String(n || "").split(" ")[0]; }
  function poolNotes(pl, st) {
    var T = root.MonteeTenup, out = [], P = (st.pool || []).map(function (q) { return Object.assign({}, q, { seen: (q.seen || []).slice() }); });
    (pl.fol || []).forEach(function (x) {
      var d = x.d || {}; if (d.error) return;
      P.forEach(function (q) {
        var me = (q.mem || []).filter(function (m) { return String(m.id) === String(x.id); })[0]; if (!me) return;
        var rows = []; try { rows = T.rows(d.raw ? { raw: d.raw } : d) || []; } catch (e) {}
        rows.forEach(function (r) {
          if (!r.ok || !r.date || r.date < (q.lo || "") || r.wo || !(r.result === "V" || r.result === "D")) return;
          var o = (q.mem || []).filter(function (m) { return m !== me && ((r.oid && m.id && String(r.oid) === String(m.id)) || (!(r.oid && m.id) && samePl(m.n, r.opp))); })[0];
          if (!o) return;
          var k = pKey(r.date, me.n, o.n); if (q.seen.indexOf(k) >= 0) return; q.seen.push(k);
          var won = r.result === "V", W = won ? me : o, L = won ? o : me, sc = won ? r.score : invSc(r.score);
          var next = W.p != null ? " Il te reste " + first(W.n) + " à jouer : tes chances " + W.p + " %." : L.p != null ? " Tu joues encore " + first(L.n) + " : tes chances " + L.p + " %." : "";
          out.push({ title: "Ta poule a bougé", body: W.n + " a battu " + L.n + (sc ? " " + sc : "") + "." + next, ess: true });
        });
      });
    });
    return { notes: out.slice(0, 2), pool: P };
  }
  // ---- 3.49 : jalons de saison (une fois par mois au plus, sauf un record) ----
  var JAL = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];
  function jalNotes(fresh, st, today) {
    var E = root.MonteeEngine, y0 = today.getMonth() >= 8 ? today.getFullYear() + 1 : today.getFullYear(), from = (y0 - 1) + "-09-01";
    var w = fresh.filter(function (r) { return r.result === "V" && !r.wo && r.date >= from; }).length;
    if (!w || st.sv == null) return null;
    var n0 = st.sv, n = n0 + w, rec = st.rec || null, mo = today.getFullYear() + "-" + (today.getMonth() + 1);
    var recL = rec ? (rec.y - 1) + "-" + String(rec.y).slice(2) : "";
    if (rec && rec.n >= 5 && n0 <= rec.n && n > rec.n) return { title: "Record battu : " + n + " victoires cette saison", body: "Ton ancien record : " + rec.n + " en " + recL + ". Et la saison n'est pas finie.", jal: mo };
    if (st.jalM === mo) return null;
    var hit = JAL.filter(function (j) { return n0 < j && n >= j; }).pop(); if (!hit) return null;
    var body = "";
    if (rec && rec.n > n) {
      var start = E.parseDate(from), days = Math.max(14, (today - start) / 864e5), eta = new Date(today.getTime() + (rec.n + 1 - n) / (n / days) * 864e5);
      body = "Ton record : " + rec.n + " en " + recL + "." + (eta < new Date(y0, 7, 31) ? " À ce rythme, tu le bats en " + MOIS[eta.getMonth()] + "." : " Il t'en manque " + (rec.n + 1 - n) + " pour le battre.");
    } else body = rec && rec.n ? "Ton record (" + rec.n + " en " + recL + ") est déjà battu : chaque victoire l'allonge." : "Depuis le 1er septembre.";
    return { title: hit + "e victoire de la saison", body: body, jal: mo };
  }
  function monteeSummary(payloadStr, stateStr, todayIso) {
    var T = root.MonteeTenup, E = root.MonteeEngine;
    var pl = T.decode(payloadStr);
    if (!pl || pl.error) return null;
    var st = {};
    try { st = JSON.parse(stateStr || "{}") || {}; } catch (e) { st = {}; }
    // 3.49 : jamais entre 21 h et 8 h : on ne touche à rien, la prochaine relance (ou l'ouverture de Montée) reprendra
    if (!todayIso && quietNow(st)) return JSON.stringify({});
    var fin = function (o, more) { var C = capMore(st, more || []), x = JSON.parse(o.state || "{}"); x.wk = C.wk; o.state = JSON.stringify(x); if (C.more.length) o.more = C.more; else delete o.more; return JSON.stringify(o); };
    // 3.43.2 : relance « joueurs suivis » seulement : ton palmarès n'a pas été relu
    if (pl.folOnly) {
      var FN0 = folNotes(pl, st, E.idx(st.rank || "") == null ? -1 : E.idx(st.rank || "")), WN0 = watchNotes(pl, st), PN0 = poolNotes(pl, st);
      var o3 = { state: JSON.stringify(Object.assign({}, st, { fol: FN0.fol, watch: WN0.watch, pool: PN0.pool })) };
      var f0 = npOn(st, "fol") ? FN0.notes : [];
      var m3 = (npOn(st, "poule") ? WN0.notes.map(function (n) { n.ess = true; return n; }).concat(PN0.notes) : []).concat(f0.length > 2 ? [{ title: f0.length + " joueurs que tu suis ont bougé", body: f0.map(function (n) { return n.title; }).join(" · ") + "." }] : f0);
      return fin(o3, m3);
    }
    var rows = T.rows(pl).filter(function (r) { return r.ok; });
    var known = st.keys || [];
    var manual = st.manual || [], usedM = {};
    // les matchs déjà saisis à la main ne sont pas « nouveaux » : pas de notification pour eux
    var fresh = rows.filter(function (r) { return known.indexOf(key(r)) < 0 && !claimManual(r, manual, usedM); });
    var rank = T.normRank(pl.profil && pl.profil.classement) || st.rank || "";
    var cur = E.idx(rank); if (cur == null) cur = -1;
    var today = todayIso ? E.parseDate(todayIso) : new Date();
    var matches = rows.map(function (r) { return { id: key(r), date: r.date, opp: r.opp, oppRank: r.oppRank, result: r.result, wo: r.wo, kind: r.kind }; });
    if (T.doublesRows) matches = matches.concat(T.doublesRows(pl));
    var p = E.project(matches, cur, st.sex === "F" ? "F" : "H", { today: today, extra: st.extra || 0 });
    // plus de 2 joueurs suivis qui bougent : une seule notification qui les regroupe
    var FN = folNotes(pl, st, cur), fN = npOn(st, "fol") ? FN.notes : [], more = fN.length > 2 ? [{ title: fN.length + " joueurs que tu suis ont bougé", body: fN.map(function (n) { return n.title; }).join(" · ") + "." }] : fN;
    var jal = null;
    if (known.length && fresh.length) {
      var freshK = fresh.map(key), bef = cpLight(rows.filter(function (r) { return freshK.indexOf(key(r)) < 0; }), cur, today), aft = cpLight(rows, cur, today);
      if (npOn(st, "jalons")) { jal = jalNotes(fresh, st, today); more = (jal ? [jal] : []).concat(cpNotes(bef, aft, rank || "joueur de ton classement", !!st.plus)).concat(more); }
    }
    var base = Object.assign({}, st, { keys: rows.map(key), rank: rank, fol: FN.fol });
    if (jal) base.jalM = jal.jal;
    if (st.sv != null && known.length) { var y1 = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1; base.sv = st.sv + fresh.filter(function (r) { return r.result === "V" && !r.wo && r.date >= y1 + "-09-01"; }).length; }
    var newState = JSON.stringify(base);
    // Premier import : on mémorise sans notifier
    var b0 = p.next || p.here;
    if (!known.length || !fresh.length) { var o0 = { state: JSON.stringify(Object.assign({}, JSON.parse(newState), { status: p.status, total: b0 ? b0.total : null })) }; return fin(o0, known.length ? more : []); }
    var f = fresh[0], title, body = statusLine(p), rel = jour(p.release);
    var ptsOf = function (r) { if (r.result !== "V" || !p.next) return 0; return E.BAREME.win(E.idx(r.oppRank) - p.next.calc); };
    var who = function (r) { return (r.opp ? nameCase(r.opp) : "un " + r.oppRank) + " (" + r.oppRank + ")"; };
    var what = function (r) { var x = ptsOf(r); return (r.result === "V" ? "Victoire" : "Défaite") + " contre " + who(r) + (x > 0 ? " : +" + x + " pts" : ""); };
    var prev = st.status || "";
    var bil = p.next || p.here, tot = bil ? bil.total : null, lost = st.total != null && tot != null ? st.total - tot : 0;
    var onlyD = fresh.every(function (r) { return r.result !== "V"; });
    var stOnly = function () { return fin({ state: JSON.stringify(Object.assign({}, JSON.parse(newState), { status: p.status, total: tot })) }, more); };
    // 3.49 : « Match homologué » coupé dans les réglages
    if (!npOn(st, "hom")) return stOnly();
    // Les changements de situation passent en titre : c'est ce que le joueur veut savoir
    if (p.status === "montee" && prev !== "montee") {
      title = "Tu montes à " + E.label(p.projected) + " !";
      body = (fresh.length > 1 ? fresh.length + " nouveaux matchs sur Ten'Up" : what(f)) + ". C'est dans la poche pour la sortie du " + rel + ".";
    } else if (p.status === "descente" && prev !== "descente") {
      title = "Attention : risque de descente à " + E.label(p.projected);
      body = (fresh.length > 1 ? fresh.length + " nouveaux matchs sur Ten'Up" : what(f)) + ". Il te manque " + (p.here.norme - p.here.total) + " pts pour te maintenir à la sortie du " + rel + ".";
    } else if (prev === "descente" && p.status !== "descente") {
      title = "Maintien assuré à " + (rank || "ton classement");
      body = (fresh.length > 1 ? fresh.length + " nouveaux matchs sur Ten'Up" : what(f)) + ". Tu restes " + rank + " à la sortie du " + rel + ".";
    } else {
      // Une défaite seule ne vaut une notification que si elle coûte des points (une victoire comptée en moins)…
      if (onlyD && lost <= 0) {
        // 3.49 (Montée+) : … ou pour le bilan du coach, une seule fois par défaite
        if (!st.plus || fresh.length !== 1) return stOnly();
        var o4 = { title: "Défaite contre " + who(f) + " homologuée", body: "Elle ne te coûte aucun point. Ton bilan du coach est à jour : ce qui a coincé et quoi changer la prochaine fois ›", state: JSON.stringify(Object.assign({}, JSON.parse(newState), { status: p.status, total: tot })) };
        return fin(o4, more);
      }
      if (fresh.length > 1) title = fresh.length + " nouveaux matchs sur Ten'Up";
      else title = (f.result === "V" ? "Victoire homologuée" : "Défaite homologuée") + (ptsOf(f) > 0 ? " · +" + ptsOf(f) + " pts" : "") + (onlyD && lost > 0 ? " · −" + lost + " pts" : "");
      if (onlyD && lost > 0) body = (fresh.length > 1 ? "Ces défaites réduisent" : "Elle réduit") + " le nombre de victoires qui comptent" + (fresh.length > 1 ? " (−" + lost + " pts)" : "") + ". " + body;
      if (fresh.length === 1) body = "Contre " + who(f) + ". " + body;
    }
    if (fresh.length === 1) body = (body ? body + " " : "") + "Raconte-le en 20 s ?";
    var o2 = { title: title, body: body, state: JSON.stringify(Object.assign({}, JSON.parse(newState), { status: p.status, total: tot })) };
    return fin(o2, more);
  }

  root.monteeSummary = monteeSummary;
  root.monteeStatusLine = statusLine;
})(this);
