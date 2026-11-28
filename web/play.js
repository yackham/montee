/* Montée — le match point par point, compté à la montre (4.28.0).
   Un seul calcul pour la fiche du match, la bulle et la conversation d'Ace, la carte « Au service ».
   Entrées : ev (une lettre par touche : m = ton point, l = son point, f = faute de service, a = ace du serveur),
   srv0 (0 = tu sers en premier), fmt ("full" ou "stb"), evT (secondes depuis le début, une par touche, facultatif).
   Rien ne sort du téléphone. Module pur : testé dans tests/point-par-point.test.js. */
(function (root) {
  "use strict";

  // Le match rejoué point par point (doubles fautes, balles de break, jeu gagné par qui)
  function replay(ev, srv0, fmt) {
    var M = { sets: [], games: [0, 0], pts: [0, 0], inTB: false, sup: false, tbFirst: 0, gi: 0, second: false, win: null }, out = [], gameStart = 0;
    var srvFor = function (gi) { return gi % 2 === 0 ? srv0 : 1 - srv0; };
    var cur = function () { if (M.inTB) { var n = M.pts[0] + M.pts[1], k = n === 0 ? 0 : Math.floor((n + 1) / 2); return k % 2 === 0 ? M.tbFirst : 1 - M.tbFirst; } return srvFor(M.gi); };
    var won = function () { return [M.sets.filter(function (x) { return x.a > x.b; }).length, M.sets.filter(function (x) { return x.b > x.a; }).length]; };
    var gameEnd = function (w) { for (var j = gameStart; j < out.length; j++) out[j].gw = w; gameStart = out.length; };
    var point = function (w) {
      if (M.inTB) {
        M.pts[w]++; var t = M.sup ? 10 : 7, a = M.pts[0], b = M.pts[1];
        if (Math.max(a, b) >= t && Math.abs(a - b) >= 2) { M.sets.push(M.sup ? { a: a, b: b } : { a: a > b ? 7 : 6, b: a > b ? 6 : 7 }); M.inTB = false; M.sup = false; M.gi++; M.games = [0, 0]; M.pts = [0, 0]; gameEnd(a > b ? 0 : 1); }
      } else {
        M.pts[w]++;
        if (M.pts[w] >= 4 && M.pts[w] - M.pts[1 - w] >= 2) {
          M.games[w]++; M.gi++; M.pts = [0, 0]; gameEnd(w); var g = M.games;
          if ((Math.max(g[0], g[1]) >= 6 && Math.abs(g[0] - g[1]) >= 2) || Math.max(g[0], g[1]) === 7) { M.sets.push({ a: g[0], b: g[1] }); M.games = [0, 0]; }
          else if (g[0] === 6 && g[1] === 6) { M.inTB = true; M.sup = false; M.tbFirst = srvFor(M.gi); }
        }
      }
      var wn = won(); if (wn[0] === 2 || wn[1] === 2) { M.win = wn[0] === 2 ? 0 : 1; return; }
      if (!M.inTB && wn[0] === 1 && wn[1] === 1 && fmt === "stb" && M.games[0] + M.games[1] === 0 && M.sets.length === 2) { M.inTB = true; M.sup = true; M.tbFirst = srvFor(M.gi); }
    };
    String(ev || "").split("").forEach(function (e, i) {
      if (M.win != null) return;
      var sv = cur(), bp = !M.inTB && M.pts[1 - sv] >= 3 && M.pts[1 - sv] > M.pts[sv], set = M.sets.length, g = [M.games[0], M.games[1]], sc = [M.pts[0], M.pts[1]], tb = M.inTB;
      if (e === "f") { if (!M.second) { M.second = true; return; } M.second = false; out.push({ df: true, s: sv, w: 1 - sv, bp: bp, set: set, tb: tb, i: i, g: g, sc: sc, sec: true }); point(1 - sv); return; }
      var w = e === "a" ? sv : e === "m" ? 0 : 1, sec = M.second; M.second = false;
      out.push({ s: sv, w: w, bp: bp, set: set, tb: tb, i: i, g: g, sc: sc, sec: sec, ace: e === "a" }); point(w);
    });
    return { pts: out, sets: M.sets.length + (M.games[0] + M.games[1] ? 1 : 0), win: M.win };
  }

  var pc = function (a, n) { return n ? Math.round(a * 100 / n) : null; };
  var tally = function (L) { var w = 0; L.forEach(function (p) { if (p.w === 0) w++; }); return { n: L.length, won: w, pct: pc(w, L.length) }; };

  // La longueur des échanges, estimée : entre deux touches il y a le temps habituel (ramasser, servir) plus l'échange.
  // On retire le temps habituel du match (le 10e centile, à part après une 1re faute) et on range les points en trois paquets égaux.
  // Pas comptés : 1er point de chaque jeu (changement de côté), aces, doubles fautes, pauses (> 75 s) et points saisis d'un coup (< 3 s).
  function rallies(P, ev, T) {
    if (!T || T.length !== ev.length) return null;
    var it = [];
    P.forEach(function (p) {
      var i = p.i; if (p.df || p.ace || i === 0 || p.sc[0] + p.sc[1] === 0 || p.tb && p.sc[0] + p.sc[1] === 0) return;
      if (T[i] == null || T[i - 1] == null || T[i] < 0 || T[i - 1] < 0) return;
      var dt = T[i] - T[i - 1]; if (dt > 75 || dt < 3) return;
      it.push({ p: p, dt: dt, c: ev.charAt(i - 1) === "f" ? 2 : 1 });
    });
    if (it.length < 30) return null;
    var base = {};
    [1, 2].forEach(function (c) { var v = it.filter(function (x) { return x.c === c; }).map(function (x) { return x.dt; }).sort(function (a, b) { return a - b; }); base[c] = v.length ? v[Math.floor(v.length * 0.1)] : 0; });
    it.forEach(function (x) { x.est = Math.max(0, x.dt - base[x.c]); });
    it.sort(function (a, b) { return a.est - b.est || a.p.i - b.p.i; });
    var k = Math.floor(it.length / 3), S = it.slice(0, k), Mi = it.slice(k, it.length - k), L = it.slice(it.length - k);
    var pts = function (A) { return A.map(function (x) { return x.p; }); }, on = function (A, s) { return tally(pts(A).filter(function (p) { return p.s === s; })); };
    return { n: it.length, short: tally(pts(S)), mid: tally(pts(Mi)), long: tally(pts(L)), shortSrv: on(S, 0), shortRet: on(S, 1), longSrv: on(L, 0), longRet: on(L, 1), cutShort: S.length ? S[S.length - 1].est : 0, cutLong: L.length ? L[0].est : 0 };
  }

  // Tout ce qu'on lit d'un match compté à la montre : des faits, pas de phrases (les phrases sont dans l'app)
  function read(ev, srv0, fmt, evT) {
    if (!ev || srv0 == null) return null;
    var R = replay(ev, srv0, fmt || "full"), P = R.pts; if (P.length < 20) return null;
    // les jeux, dans l'ordre (tie-break = un jeu)
    var games = [], key = null;
    P.forEach(function (p) { var k = p.set + ":" + p.g[0] + "-" + p.g[1] + (p.tb ? "t" : ""); if (k !== key) { key = k; games.push({ set: p.set, s: p.s, tb: p.tb, pts: [] }); } games[games.length - 1].pts.push(p); });
    games.forEach(function (g) { g.w = g.pts[g.pts.length - 1].gw; });
    games = games.filter(function (g) { return g.w != null; }); // un jeu pas fini (match arrêté) ne compte pas
    var sets = []; games.forEach(function (g) { var x = sets[g.set] = sets[g.set] || { me: 0, him: 0, games: [] }; if (g.tb) { x.tb = true; } if (g.w === 0) x.me++; else x.him++; x.games.push({ me: g.s === 0, w: g.w === 0, tb: !!g.tb }); });
    var mine = games.filter(function (g) { return g.s === 0 && !g.tb; }), his = games.filter(function (g) { return g.s === 1 && !g.tb; });
    var srvP = P.filter(function (p) { return p.s === 0; }), retP = P.filter(function (p) { return p.s === 1; });
    // le 1er point de tes jeux de service
    var f1w = mine.filter(function (g) { return g.pts[0].w === 0; }), f1l = mine.filter(function (g) { return g.pts[0].w === 1; });
    var held = function (L) { return L.filter(function (g) { return g.w === 0; }).length; };
    // points chauds : balle de break, 30-30 ou plus (égalité, avantage) ; hors tie-break
    var hot = function (p) { return !p.tb && (p.bp || (p.sc[0] >= 2 && p.sc[1] >= 2)); };
    // par set : tes points au service et au retour
    var bySet = sets.map(function (x, i) { return { srv: tally(srvP.filter(function (p) { return p.set === i; })), ret: tally(retP.filter(function (p) { return p.set === i; })) }; });
    // la plus longue série de points perdus (et où elle a commencé)
    var run = { n: 0 }, r = 0, st = null;
    P.forEach(function (p) { if (p.w === 1) { if (!r) st = p; r++; if (r > run.n) run = { n: r, set: st.set, g: st.g }; } else r = 0; });
    var runW = { n: 0 }; r = 0;
    P.forEach(function (p) { if (p.w === 0) { if (!r) st = p; r++; if (r > runW.n) runW = { n: r, set: st.set, g: st.g }; } else r = 0; });
    return {
      n: P.length, win: R.win, all: tally(P), srv: tally(srvP), ret: tally(retP),
      held: { n: mine.length, won: held(mine) }, brk: { n: his.length, won: held(his) },
      first: { won: { n: f1w.length, held: held(f1w) }, lost: { n: f1l.length, held: held(f1l) } },
      hot: { srv: tally(srvP.filter(hot)), ret: tally(retP.filter(hot)) },
      sets: sets.map(function (x, i) { return { me: x.me, him: x.him, tb: !!x.tb, games: x.games, srv: bySet[i].srv, ret: bySet[i].ret }; }),
      run: run, runW: runW, rally: rallies(P, String(ev), evT)
    };
  }

  var api = { replay: replay, read: read };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MonteePlay = api;
})(this);
