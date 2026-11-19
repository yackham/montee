/* Montée — widgets Android dessinés en images.
   Chaque widget est écrit en HTML (mêmes couleurs que les thèmes de l'app), puis converti en PNG
   (SVG foreignObject → canvas) et envoyé au téléphone, qui l'affiche tel quel.
   Aucune donnée ne sort du téléphone. */
(function (root) {
  "use strict";

  // Tailles par défaut (dp), si le téléphone ne donne pas la vraie taille du widget
  var SIZES = {
    classement: [170, 170], sortie: [360, 170], cordage: [170, 170], forme: [170, 82], mini: [82, 82],
    semaine: [360, 170], tableau: [360, 380], truc: [360, 92], defend: [170, 170], sac: [360, 92],
    joueurs: [360, 92], adversaire: [360, 170], objectif: [170, 170],
    adversaire2: [170, 170], suivis: [360, 170], suivis2: [170, 170], suivis3: [360, 380],
    faf: [360, 380], faf2: [360, 170], faf1: [170, 170]
  };
  var VARS = ["bg", "card", "ink", "muted", "line", "chip", "balle", "balle-soft", "on-balle", "gazon", "gazon-dark", "menthe",
    "terre", "terre-dark", "terre-soft", "chart-v", "chart-d", "solid", "on-solid", "panel", "on-panel", "sub", "hl",
    "hero-bg", "hero-ink", "hero-bar", "on-gazon", "on-terre"];

  // Couleurs d'un thème, lues dans la feuille de style de l'app (une seule source de vérité)
  var palCache = {};
  function palette(theme) {
    if (palCache[theme]) return palCache[theme];
    // Thèmes Supporter : bâtis sur Nuit ou Lin (attribut data-skin)
    var SKB = { indoor: "nuit", nocturne: "nuit", retro: "lin" }, base = SKB[theme] || theme;
    var r = document.documentElement, prev = r.getAttribute("data-theme"), prevS = r.getAttribute("data-skin"), out = {};
    if (base === "lin") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", base);
    if (SKB[theme]) r.setAttribute("data-skin", theme); else r.removeAttribute("data-skin");
    var cs = getComputedStyle(r);
    VARS.forEach(function (k) { out[k] = cs.getPropertyValue("--" + k).trim(); });
    if (prev == null) r.removeAttribute("data-theme"); else r.setAttribute("data-theme", prev);
    if (prevS == null) r.removeAttribute("data-skin"); else r.setAttribute("data-skin", prevS);
    out.dark = base === "nuit";
    palCache[theme] = out;
    return out;
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ill() { return root.MonteeIll; }
  function rk(r, h) {
    var I = ill(); if (!I || !r) return "";
    return '<span class="x-rkt" style="height:' + h + 'px;width:' + Math.round(h * 0.42) + 'px">' + I.racket(r.color || "noir", r.accent, r.pattern) + "</span>";
  }
  function ring(pct, col, track, size, stroke) {
    var rr = (size - stroke) / 2, C = 2 * Math.PI * rr, p = Math.max(0, Math.min(100, pct || 0));
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" style="transform:rotate(-90deg)"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + rr + '" fill="none" stroke="' + track + '" stroke-width="' + stroke + '"/>' +
      (p ? '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + rr + '" fill="none" stroke="' + col + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + (C * p / 100).toFixed(1) + " " + C.toFixed(1) + '"/>' : "") + "</svg>";
  }
  function bar(pct, col, track, h) {
    return '<div style="height:' + (h || 8) + 'px;border-radius:' + (h || 8) + 'px;background:' + track + ';overflow:hidden"><div style="height:100%;width:' + Math.max(0, Math.min(100, pct || 0)) + "%;background:" + col + ';border-radius:inherit"></div></div>';
  }
  // Cotillons répartis dans une zone [x0, x1, y0, y1] en %, à l'écart du texte
  function confetti(p, z) {
    z = z || [70, 96, 20, 64];
    var P = [[0.1, 0.05, "hl", 25], [0.55, 0.0, "terre", -30], [0.95, 0.12, "on", 60, 1], [0.35, 0.3, "chart-v", -15], [0.85, 0.42, "hl", 40], [0.15, 0.55, "on", -50, 1], [0.6, 0.62, "terre", 75], [0.95, 0.8, "hl", -35], [0.3, 0.92, "chart-v", 35], [0.75, 1, "on", 20, 1]];
    return P.map(function (q) {
      var col = q[2] === "on" ? p["on-panel"] : p[q[2]], x = z[0] + q[0] * (z[1] - z[0]), y = z[2] + q[1] * (z[3] - z[2]);
      return '<i style="position:absolute;left:' + x.toFixed(1) + "%;top:" + y.toFixed(1) + "%;width:" + (q[4] ? 7 : 11) + "px;height:" + (q[4] ? 7 : 5) + "px;border-radius:" + (q[4] ? "50%" : "2px") + ";background:" + col + ";transform:rotate(" + q[3] + 'deg)"></i>';
    }).join("");
  }
  function mix(a, pct) { return "color-mix(in srgb, " + a + " " + pct + "%, transparent)"; }

  // ---------- États de la carte « Montée » ----------
  function state(d) {
    var s = d.status;
    if (s === "montee") return "up";
    if (s === "descente") return "down";
    if (s === "top") return "top";
    if (!s || s === "none" || !d.rank) return "empty";
    return "norm";
  }
  function skin(st, p) {
    if (st === "up") return { bg: p.panel, fg: p["on-panel"], sub: p.sub, acc: p.hl, track: "rgba(255,255,255,.18)" };
    if (st === "down") return { bg: p.terre, fg: p["on-terre"], sub: mix(p["on-terre"], 80), acc: p["on-terre"], track: mix(p["on-terre"], 25) };
    if (st === "norm") return { bg: p["hero-bg"], fg: p["hero-ink"], sub: mix(p["hero-ink"], 72), acc: p["hero-bar"], track: mix(p["hero-ink"], 12) };
    return { bg: p.card, fg: p.ink, sub: p.muted, acc: p.gazon, track: p.chip };
  }
  function relLabel(d) {
    if (!d.releaseIso) return "";
    var M = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    var x = d.releaseIso.split("-");
    return +x[2] + " " + M[+x[1] - 1];
  }
  function chip(txt, bg, fg) { return '<span class="x-chip" style="background:' + bg + ";color:" + fg + '">' + esc(txt) + "</span>"; }

  var T = {};
  // ---------- 3.29 : mêmes règles que l'appli (carte du thème + lueur d'accent, barre à balle) ----------
  function isDark(p) { var h = String(p.card || "#fff").replace("#", ""); if (h.length < 6) return false; var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (r * 299 + g * 587 + b * 114) / 1000 < 110; }
  function accent(p) { return isDark(p) ? p.balle : p.gazon; }
  function glow(p, col) { return "background:radial-gradient(140% 90% at 100% 0%, " + mix(col, 22) + " 0%, transparent 62%)," + p.card + ";color:" + p.ink; }
  function tball(col, seam, sz) { sz = sz || 20; return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 22 22" style="display:block"><circle cx="11" cy="11" r="10" fill="' + col + '"/><path d="M3.2 5.5C7.5 8.5 7.5 13.5 3.2 16.5M18.8 5.5C14.5 8.5 14.5 13.5 18.8 16.5" stroke="' + seam + '" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>'; }
  function bbar(p, pct, col) {
    var f = Math.max(0, Math.min(100, pct || 0)) / 100;
    return '<div style="position:relative;height:20px;width:100%"><div style="position:absolute;left:0;right:0;top:5px;height:10px;border-radius:5px;background:' + p.chip + '"></div>' +
      '<div style="position:absolute;left:0;top:5px;height:10px;border-radius:5px;background:' + col + ';width:calc((100% - 20px) * ' + f.toFixed(3) + ' + 10px)"></div>' +
      '<div style="position:absolute;top:0;left:calc((100% - 20px) * ' + f.toFixed(3) + ')">' + tball(col, p.card) + "</div></div>";
  }
  function pill(t, col) { return '<span style="align-self:flex-start;font-size:11px;font-weight:800;border-radius:99px;padding:3px 9px;white-space:nowrap;background:' + mix(col, 18) + ";color:" + col + '">' + esc(t) + "</span>"; }
  function eyeb(t, col) { return '<span class="x-ey x-ell" style="font-size:10px;color:' + col + '">' + esc(t) + "</span>"; }

  // 1. Montée (2 × 2)
  T.classement = function (d, p, W, H) {
    var st = state(d), k = skin(st, p), rel = relLabel(d), ey = rel ? "Sortie du " + rel : "Montée";
    var s = '<div class="x-w" style="background:' + k.bg + ";color:" + k.fg + '">';
    if (st === "up") {
      s += confetti(p, [72, 94, 26, 60]) + '<span class="x-ey" style="color:' + k.acc + '">' + esc(ey) + '</span><div class="x-sp"></div>' +
        '<span class="x-huge" style="color:' + k.acc + '">' + esc(d.rank) + '</span><span class="x-t2">Tu montes !</span><span class="x-sm" style="color:' + k.sub + '">C\'est dans la poche.</span>';
    } else if (st === "empty") {
      s += '<span class="x-ey" style="color:' + k.sub + '">Montée</span><div class="x-sp"></div><span class="x-t1">Tu montes ce mois-ci ?</span><span class="x-sm" style="color:' + k.sub + '">Ouvre Montée et synchronise Ten\'Up.</span>';
    } else if (st === "top") {
      s += '<span class="x-ey" style="color:' + k.sub + '">' + esc(ey) + '</span><div class="x-sp"></div><span class="x-huge">' + esc(d.rank) + '</span><span class="x-sm" style="color:' + k.sub + '">Joueur numéroté</span>';
    } else {
      // 3.29 : carte du thème + lueur, rang sur sa ligne, barre à balle
      var ac = st === "down" ? p.terre : accent(p);
      // 3.34 : montée en cours : les deux classements en pastilles, « Il te manque N pts », la barre, J-n
      if (st === "norm" && d.norme && d.target) {
        var tg = String(d.target).split("→").map(function (x) { return x.trim(); }), jn = d.releaseIso ? Math.max(0, Math.round((new Date(d.releaseIso + "T12:00:00") - new Date()) / 864e5)) : null;
        var cp = function (t, bg, fg) { return '<span style="font-size:12px;font-weight:800;border-radius:8px;padding:3px 7px;background:' + bg + ";color:" + fg + '">' + esc(t) + "</span>"; };
        return '<div class="x-w" style="' + glow(p, ac) + ';gap:2px">' +
          '<div class="x-row" style="align-items:center;gap:5px">' + cp(tg[0] || d.rankNow || d.rank, p.chip, p.ink) + '<b style="color:' + p.muted + ';font-size:13px">→</b>' + cp(tg[1] || "", ac, isDark(p) ? "#121212" : "#fff") + "</div>" +
          '<span style="font-size:13px;font-weight:700;color:' + p.muted + ';margin-top:8px">Il te manque</span>' +
          '<b style="font-size:30px;line-height:1;letter-spacing:-.03em">' + Math.max(0, d.norme - d.total) + " pts</b>" +
          '<div class="x-sp"></div>' + bbar(p, d.pct, ac) +
          '<div class="x-row x-sm" style="color:' + p.muted + ';font-weight:700"><span>' + d.total + " / " + d.norme + '</span><div class="x-sp"></div>' + (jn != null ? '<b style="color:' + p.ink + '">J-' + jn + "</b>" : "") + "</div></div>";
      }
      return '<div class="x-w" style="' + glow(p, ac) + ';gap:4px">' + eyeb(ey, st === "down" ? p.terre : p.muted) +
        (d.target ? '<b style="font-size:15px;color:' + p.muted + '">' + esc(st === "down" ? "Maintien " + (d.rankNow || d.rank) : d.target).replace("→ ", '→ <span style="color:' + p.ink + '">') + (st === "down" ? "" : "</span>") + "</b>" : "") +
        '<b style="font-size:23px;line-height:1.08;letter-spacing:-.02em">' + esc(st === "norm" && d.norme ? "−" + Math.max(0, d.norme - d.total) + " pts" : d.short || d.headline) + "</b>" +
        '<div class="x-sp"></div>' + (d.norme ? bbar(p, d.pct, ac) + '<span class="x-sm" style="color:' + p.muted + '"><b style="color:' + p.ink + '">' + d.total + "</b> / " + d.norme + "</span>" : d.sub ? '<span class="x-sm" style="color:' + p.muted + '">' + esc(d.sub) + "</span>" : "") + "</div>";
    }
    return s + "</div>";
  };

  // 2. Montée large (4 × 2)
  T.sortie = function (d, p, W, H) {
    var st = state(d), k = skin(st, p), rel = relLabel(d), ey = rel ? "Sortie du " + rel : "Montée";
    var s = '<div class="x-w" style="background:' + k.bg + ";color:" + k.fg + '">';
    if (st === "up") {
      s += confetti(p, [80, 96, 8, 86]) + '<span class="x-ey" style="color:' + k.acc + '">' + esc(ey) + '</span><div class="x-sp"></div><div style="display:flex;align-items:flex-end;gap:12px"><span class="x-huge" style="color:' + k.acc + ';font-size:58px">' + esc(d.rank) + '</span><span class="x-t2" style="margin-bottom:6px">Tu montes !<br/>C\'est dans la poche.</span></div>' +
        (d.next ? '<span class="x-sm" style="margin-top:6px;color:' + k.sub + '">' + esc(d.next) + "</span>" : "");
      return s + "</div>";
    }
    if (st === "empty" || st === "top") return T.classement(d, p, W, H);
    // 3.29 : carte du thème + lueur, barre à balle
    var ac2 = st === "down" ? p.terre : accent(p);
    s = '<div class="x-w" style="' + glow(p, ac2) + ';gap:5px">';
    s += '<div class="x-row" style="align-items:center;gap:8px"><span class="x-ey x-ell" style="flex:1;font-size:10px;color:' + (st === "down" ? p.terre : p.muted) + '">' + esc(ey + (d.days != null ? " · dans " + d.days + " j" : "")) + "</span>" + (d.target ? chip(st === "down" ? "Maintien " + (d.rankNow || d.rank) : d.target, p.chip, p.ink) : "") + "</div>" +
      '<span class="x-t1 x-clamp2" style="font-size:21px;margin-top:3px">' + esc(d.headline) + "</span>" + (d.sub ? '<span class="x-sm x-ell" style="color:' + p.muted + '">' + esc(d.sub) + "</span>" : "") + '<div class="x-sp"></div>';
    if (d.norme) s += bbar(p, d.pct, ac2) + '<div class="x-row x-sm" style="color:' + p.muted + '"><span><b style="color:' + p.ink + '">' + d.total + "</b> / " + d.norme + " pts au bilan " + esc(d.label || "") + '</span><div class="x-sp"></div><span>il en faut ' + d.norme + "</span></div>";
    return s + "</div>";
  };

  // 3. Raquette (2 × 2)
  T.cordage = function (d, p) {
    var r = d.racket;
    if (!r) return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + '"><span class="x-ey" style="color:' + p.muted + '">Ton sac</span><div class="x-sp"></div><span class="x-t1">Ajoute ta raquette</span><span class="x-sm" style="color:' + p.muted + '">Montée suivra l\'usure du cordage.</span></div>';
    var lv = r.level, warn = lv === "soon", bad = lv === "change" || lv === "broken";
    var bg = bad ? p.terre : p.card, fg = bad ? p["on-terre"] : p.ink, sub = bad ? mix(p["on-terre"], 80) : p.muted;
    var col = bad ? p["on-terre"] : warn ? p["chart-d"] : p["chart-v"], track = bad ? mix(p["on-terre"], 22) : p.chip;
    var pill = lv === "broken" ? "Cordage cassé" : lv === "change" ? "À recorder" : lv === "soon" ? "Bientôt à recorder" : !r.known ? "Date de cordage ?" : "Cordage en forme";
    var pillBg = bad ? mix(p["on-terre"], 18) : warn ? p["terre-soft"] : p.menthe, pillFg = bad ? fg : warn ? p["terre-dark"] : p["gazon-dark"];
    return '<div class="x-w" style="background:' + bg + ";color:" + fg + '"><span class="x-ey" style="color:' + sub + '">' + esc(r.title || r.name) + "</span>" +
      '<div class="x-row" style="flex:1;align-items:center;gap:6px;margin:4px 0"><div style="position:relative;width:84px;height:84px">' + ring(r.pct, col, track, 84, 8) +
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><b style="font-size:20px;letter-spacing:-.03em">' + esc((r.hours || "?").replace("≈ ", "")) + '</b><span style="font-size:10px;color:' + sub + '">' + esc(r.max || "") + "</span></div></div>" +
      '<div class="x-sp"></div>' + rk(r, 78) + "</div>" + chip(pill, pillBg, pillFg) + "</div>";
  };

  // 4. Forme (2 × 1)
  T.forme = function (d, p) {
    var f = d.form || [];
    var dots = f.map(function (r) {
      var v = r === "V";
      return '<span class="x-vd" style="background:' + (v ? p["chart-v"] : p["terre-soft"]) + ";color:" + (v ? p["on-gazon"] : p["terre-dark"]) + '">' + r + "</span>";
    }).join("");
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';padding:10px 14px;gap:6px"><div class="x-row"><span class="x-ey" style="color:' + p.muted + '">Forme</span><div class="x-sp"></div><span class="x-sm" style="color:' + p.muted + '">' + esc(d.recordShort || "") + "</span></div>" +
      '<div class="x-row" style="gap:5px">' + (dots || '<span class="x-sm" style="color:' + p.muted + '">Pas encore de match</span>') + "</div>" +
      '<span class="x-sm x-ell" style="font-weight:600">' + esc(d.streak || "") + "</span></div>";
  };

  // 5. Sortie (1 × 1)
  T.mini = function (d, p) {
    var st = state(d), up = st === "up", rel = relLabel(d);
    var bg = up ? p.panel : st === "down" ? p.terre : p["hero-bg"], fg = up ? p["on-panel"] : st === "down" ? p["on-terre"] : p["hero-ink"];
    return '<div class="x-w" style="background:' + bg + ";color:" + fg + ';padding:8px;align-items:center;justify-content:center;text-align:center;gap:1px">' + (up ? confetti(p, [84, 95, 10, 88]) : "") +
      '<span class="x-ey" style="font-size:9.5px;color:' + (up ? p.hl : mix(fg, 70)) + '">' + (up ? "Tu montes" : "Sortie") + "</span>" +
      '<span style="font-size:' + (up ? 26 : 22) + "px;font-weight:800;letter-spacing:-.04em;line-height:1.05;position:relative;color:" + (up ? p.hl : fg) + '">' + esc(up ? d.rank : rel || "—") + "</span>" +
      '<span style="font-size:10px;font-weight:600;opacity:.8;position:relative">' + esc(up ? rel : d.rank ? d.rank : "") + "</span></div>";
  };

  // 6. Ta semaine (4 × 2)
  T.semaine = function (d, p) {
    var w = d.week || {}, L = ["L", "M", "M", "J", "V", "S", "D"], days = w.days || [], mins = w.mins || [];
    var cells = L.map(function (l, i) {
      var k = days[i], today = i === w.todayIdx;
      var fill = k === "m" ? p.balle : k === "t" ? p.gazon : "transparent", bd = k ? "transparent" : today ? p.ink : p.line;
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px"><span style="width:24px;height:24px;border-radius:50%;background:' + fill + ";box-shadow:inset 0 0 0 2px " + bd + '"></span>' +
        '<b style="font-size:11px;line-height:1;color:' + (today ? p.ink : p.muted) + '">' + l + '</b><span style="font-size:9.5px;line-height:1;color:' + p.muted + ';height:10px">' + esc(mins[i] || (today && !k ? "auj." : "")) + "</span></div>";
    }).join("");
    var sl = w.slot;
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';gap:6px;padding:13px 16px 12px"><div class="x-row" style="align-items:flex-start"><div><span class="x-ey" style="color:' + p.muted + '">Ta semaine</span>' +
      '<div style="font-size:22px;font-weight:800;letter-spacing:-.03em;line-height:1.1;margin-top:1px">' + esc(w.total || "0 h") + (w.count ? ' <span style="font-size:13px;font-weight:600;color:' + p.muted + '">· ' + esc(w.count) + "</span>" : "") + "</div></div>" +
      '<div class="x-sp"></div>' + (w.streak ? chip(w.streak, p.menthe, p["gazon-dark"]) : "") + "</div>" +
      '<div class="x-sp"></div><div class="x-row">' + cells + '</div><div class="x-sp"></div>' +
      '<div class="x-row" style="margin-top:auto;align-items:center;gap:8px"><span class="x-sm" style="color:' + p.muted + '">' +
      '<i class="x-dot" style="background:' + p.gazon + '"></i> entraînement  <i class="x-dot" style="background:' + p.balle + '"></i> match</span><div class="x-sp"></div>' +
      (sl && sl.ask ? '<span class="x-btn" style="background:' + p.solid + ";color:" + p["on-solid"] + '">T\'as joué ?</span>' : sl ? '<span class="x-sm" style="font-weight:600;text-align:right">' + esc(sl.label) + "</span>" : "") + "</div></div>";
  };

  // 7. Tableau de bord (4 × 3)
  // Grand format : le palmarès, avec une petite zone pour les points en cours (plus de « truc à savoir »)
  T.tableau = function (d, p, W, H) {
    H = H || 380;
    var st = state(d), rel = relLabel(d);
    var s = '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';gap:9px"><div class="x-row" style="align-items:center"><span class="x-ey" style="color:' + p.muted + '">Palmarès</span><div class="x-sp"></div>' +
      chip(d.rank || "—", p.solid, p["on-solid"]) + "</div>";
    // Points en cours : une ligne et une barre fine
    var ptsTxt = st === "up" ? "Tu montes à " + (d.rank || "") + (rel ? " le " + rel : "") : st === "norm" && d.norme ? "" : d.short || "";
    s += '<div style="background:' + p.chip + ';border-radius:14px;padding:9px 12px;display:flex;flex-direction:column;gap:6px">' +
      (st === "norm" && d.norme ? '<div class="x-row" style="align-items:baseline;gap:6px"><b style="font-size:16px">' + d.total + '</b><span class="x-sm" style="color:' + p.muted + '">/ ' + d.norme + " pts pour " + esc(d.label || "") + '</span><div class="x-sp"></div><span class="x-sm" style="color:' + p.muted + '">' + esc(rel ? "sortie " + rel : "") + "</span></div>" + bar(d.pct, p.gazon, p.card, 5)
        : '<span class="x-sm x-ell" style="font-weight:700">' + esc(ptsTxt || "Ouvre Montée") + "</span>") + "</div>";
    var rows = Math.max(1, Math.min(12, Math.floor((H - 122) / 25)));
    var last = (d.last || []).slice(0, rows).map(function (m) {
      var v = m.r === "V";
      return '<div class="x-row" style="gap:8px;align-items:center;height:20px"><span class="x-vd" style="width:20px;height:20px;font-size:10px;background:' + (v ? p.gazon : p["terre-soft"]) + ";color:" + (v ? p["on-gazon"] : p["terre-dark"]) + '">' + (v ? "V" : "D") + "</span>" +
        '<span class="x-sm x-ell" style="flex:1;font-size:13px">' + esc(m.opp) + "</span>" + (m.date ? '<span class="x-sm" style="color:' + p.muted + '">' + esc(m.date) + "</span>" : "") +
        '<b class="x-sm" style="min-width:64px;text-align:right;color:' + (v ? p.gazon : p.muted) + '">' + esc(m.right) + "</b></div>";
    }).join("");
    s += '<div style="flex:1;display:flex;flex-direction:column;gap:5px;min-height:0;overflow:hidden">' + (last || '<span class="x-sm" style="color:' + p.muted + '">Pas encore de match</span>') + "</div>";
    return s + "</div>";
  };

  // 8. Le truc à savoir (4 × 1)
  T.truc = function (d, p) {
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';padding:12px 16px 12px 20px;justify-content:center;gap:4px"><i style="position:absolute;left:0;top:0;bottom:0;width:5px;background:' + p.balle + '"></i>' +
      '<span class="x-ey" style="color:' + p.gazon + '">Le truc à savoir</span><span style="font-size:15px;font-weight:600;line-height:1.28;letter-spacing:-.01em" class="x-clamp2">' + esc(d.truc || "Annote tes matchs : Montée te dira où tu gagnes le plus.") + "</span></div>";
  };

  // 9. Points à défendre (2 × 2)
  T.defend = function (d, p) {
    // 3.29 : « rien ce mois-ci » d'abord, puis les 6 prochaines sorties en petites barres
    var f = d.defend, T2 = p.terre, now = d.defNow || 0;
    var head = eyeb("À défendre", T2);
    if (!f || !f.pts || !f.pts.length) return '<div class="x-w" style="' + glow(p, p.gazon) + '">' + head + '<div class="x-sp"></div><b style="font-size:18px;line-height:1.2">Rien ne sort d\'ici 6 mois</b></div>';
    var nx = null, nm = "";
    for (var i = 1; i < f.pts.length; i++) { var dd = f.pts[i - 1].total - f.pts[i].total; if (dd > 0) { nx = dd; nm = f.pts[i].m; break; } }
    var mx = Math.max.apply(null, f.pts.map(function (x) { return x.total; })) || 1;
    var bars = f.pts.map(function (x, i) { var moved = i === 0 || f.pts[i - 1].total > x.total; return '<i style="flex:1;height:' + Math.max(4, x.total / mx * 40).toFixed(0) + "px;border-radius:4px;background:" + (x.norme && x.total < x.norme ? T2 : p.gazon) + (moved ? "" : ";opacity:.4") + '"></i>'; }).join("");
    return '<div class="x-w" style="' + glow(p, now ? T2 : p.gazon) + ';gap:4px">' + head +
      (now ? '<b style="font-size:24px;line-height:1.05;letter-spacing:-.02em;color:' + T2 + '">−' + now + ' pts</b><span class="x-sm" style="font-weight:700;margin-top:-2px">ce mois-ci</span>' : '<b style="font-size:17px;line-height:1.2">Rien ce mois-ci</b>') +
      (nx ? '<span class="x-sm" style="color:' + p.muted + '">ensuite <b style="color:' + T2 + '">−' + nx + " pts</b> en " + esc(nm) + "</span>" : '<span class="x-sm" style="color:' + p.muted + '">rien d\'autre d\'ici 6 mois</span>') +
      '<div class="x-sp"></div><div style="display:flex;align-items:flex-end;gap:4px;height:40px">' + bars + "</div></div>";
  };

  // 10. Ton sac (4 × 1)
  T.sac = function (d, p) {
    var list = (d.bag || []).slice(0, 3);
    if (!list.length) return T.cordage(d, p);
    var items = list.map(function (r) {
      var bad = r.level === "change" || r.level === "broken", warn = r.level === "soon";
      var col = bad ? p.terre : warn ? p["chart-d"] : p["chart-v"];
      return '<div style="flex:1;min-width:0;display:flex;gap:8px;align-items:center;background:' + (bad ? p["terre-soft"] : p.chip) + ';border-radius:16px;padding:8px 10px">' + rk(r, 50) +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><b style="font-size:14px" class="x-ell">' + esc(r.name) + "</b>" + bar(r.pct, col, p.line, 5) +
        '<span style="font-size:11px;color:' + (bad ? p["terre-dark"] : p.muted) + '" class="x-ell">' + esc((r.hours || "?") + " · " + (r.short || "")) + "</span></div></div>";
    }).join("");
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';flex-direction:row;gap:8px;padding:10px">' + items + "</div>";
  };


  // 11. Chercher un joueur (4 × 1) : une barre de recherche, et tes derniers adversaires
  T.joueurs = function (d, p, W) {
    var rec = (d.recent || []).slice(0, W >= 300 ? 3 : 0);
    var av = rec.map(function (o) { return '<span class="x-vd" style="width:30px;height:30px;font-size:11px;background:' + p.menthe + ";color:" + p["gazon-dark"] + ';box-shadow:0 0 0 2px ' + p.card + '">' + esc(o.ini) + "</span>"; }).join("");
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';padding:10px 12px;justify-content:center;gap:6px">' +
      '<div class="x-row" style="align-items:center;gap:10px;background:' + p.chip + ';border-radius:16px;padding:0 6px 0 14px;height:46px;box-shadow:0 0 0 1.5px ' + mix(p.gazon, 40) + '">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + p.muted + '" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>' +
      '<span style="flex:1;font-size:15px;color:' + p.muted + '" class="x-ell">Chercher un joueur</span>' +
      (av ? '<span class="x-row" style="gap:0;margin-right:2px">' + av.replace(/box-shadow/g, "margin-left:-6px;box-shadow") + "</span>" : "") + "</div></div>";
  };

  // 12. Prochain adversaire (4 × 2) : le match programmé (« Ton match · sam. 7 »), sinon « Dernière recherche » ; tes chances et la clé du match
  T.adversaire = function (d, p) {
    var o = d.scout, ac = accent(p);
    if (!o) return '<div class="x-w" style="' + glow(p, ac) + '">' + eyeb("Adversaire", p.muted) + '<div class="x-sp"></div><span class="x-t1">Prépare ton prochain match</span><span class="x-sm" style="margin-top:4px;color:' + p.muted + '">Cherche ton adversaire : tes chances, ton plan de jeu.</span></div>';
    var pc = o.p, col = pc == null ? p.muted : pc >= 60 ? p.gazon : pc >= 40 ? ac : p.terre;
    var ini = (o.name || "?").split(" ").map(function (x) { return x.charAt(0); }).join("").slice(0, 2).toUpperCase();
    return '<div class="x-w" style="' + glow(p, ac) + ';gap:8px;padding:13px 16px">' +
      '<div class="x-row" style="align-items:center;gap:10px"><span class="x-vd" style="width:38px;height:38px;font-size:13px;background:' + p.chip + ";color:" + p.ink + '">' + esc(ini) + "</span>" +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column">' + eyeb(o.when ? "Ton match · " + o.when : "Consulté récemment", p.muted) + '<b style="font-size:17px;letter-spacing:-.02em" class="x-ell">' + esc(String(o.name || "").toLowerCase().replace(/(^|[\s'-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); })) + "</b></div>" +
      chip(o.rank || "?", p.chip, p.ink) + "</div>" +
      (pc != null ? '<div class="x-row" style="align-items:center;gap:10px"><b style="font-size:26px;letter-spacing:-.04em;line-height:1">' + pc + ' %</b><div style="flex:1">' + bbar(p, pc, col) + "</div></div>" : "") +
      (o.tip ? '<div style="margin-top:auto;background:' + p.chip + ';border-radius:14px;padding:7px 10px;border-left:3px solid ' + ac + '"><span class="x-sm x-ell" style="display:block;font-weight:700">' + esc(o.tip) + '</span><span class="x-sm x-ell" style="display:block;color:' + p.muted + '">' + esc(o.tipS || "") + "</span></div>" : "") + "</div>";
  };

  // 13. Objectif de saison (2 × 2)
  T.objectif = function (d, p) {
    var g = d.goal, ac = accent(p);
    if (!g) return '<div class="x-w" style="' + glow(p, ac) + '">' + eyeb("Ton objectif", p.muted) + '<div class="x-sp"></div><span class="x-t1" style="font-size:18px">Jusqu\'où tu veux monter ?</span><span class="x-sm" style="margin-top:4px;color:' + p.muted + '">Fixe un classement et une date.</span></div>';
    var ok = g.state === "atteint", late = g.state === "en retard", col = late ? p.terre : p.gazon;
    var lbl = ok ? "Atteint !" : late ? "En retard" : g.state === "en avance" ? "En avance" : "À l'heure";
    var foot = ok ? "Fixe-toi le suivant" : g.wins ? "≈ " + g.wins + " victoire" + (g.wins > 1 ? "s" : "") : "";
    return '<div class="x-w" style="' + glow(p, ac) + ';gap:4px">' + eyeb("Objectif", p.muted) +
      '<b style="font-size:30px;line-height:1;letter-spacing:-.03em;color:' + (isDark(p) ? p.balle : p.gazon) + '">' + esc(g.rank) + "</b>" + pill(lbl, col) +
      '<span class="x-sm x-ell" style="color:' + p.muted + '">' + esc(g.by) + " · auj. " + esc(g.now) + "</span>" +
      '<div class="x-sp"></div>' + bbar(p, g.pct || 4, ac) + '<span class="x-sm" style="font-weight:700">' + esc(foot) + "</span></div>";
  };

  // 13. Adversaire en carré (2 × 2) : son nom, tes chances, la clé du match
  // 3.34 : nom sur une ligne : « Gérard Durand », sinon « G. Durand »
  function shortName(n) {
    var t = String(n || "").toLowerCase().replace(/(^|[\s'-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }).trim();
    if (t.length <= 15) return t;
    var w = t.split(/\s+/); return w.length > 1 ? w[0].charAt(0) + ". " + w.slice(1).join(" ") : t;
  }
  T.adversaire2 = function (d, p) {
    var o = d.scout, ac = accent(p);
    if (!o) return '<div class="x-w" style="' + glow(p, ac) + '">' + eyeb("Adversaire", p.muted) + '<div class="x-sp"></div><span class="x-t1" style="font-size:18px">Qui tu joues ?</span><span class="x-sm" style="margin-top:4px;color:' + p.muted + '">Cherche-le : tes chances et ton plan de jeu.</span></div>';
    var pc = o.p, col = pc == null ? p.muted : pc >= 60 ? p.gazon : pc >= 40 ? ac : p.terre;
    return '<div class="x-w" style="' + glow(p, ac) + ';gap:4px">' +
      '<div class="x-row" style="align-items:center;gap:6px"><span style="flex:1;min-width:0">' + eyeb(o.when ? o.when : "Recherche", p.muted) + "</span>" + chip(o.rank || "?", p.chip, p.ink) + "</div>" +
      '<b class="x-ell" style="font-size:16px;letter-spacing:-.02em;line-height:1.2;display:block">' + esc(shortName(o.name)) + "</b>" +
      '<div class="x-sp"></div>' +
      (pc != null ? '<b style="font-size:26px;letter-spacing:-.04em;line-height:1">' + pc + ' %</b>' + bbar(p, pc, col) +
        // 3.34 : le conseil seulement s'il tient en entier
        ((o.tip || o.head || "").length <= 26 ? '<span class="x-sm" style="font-weight:700">' + esc(o.tip || o.head || "") + "</span>" : "") : '<span class="x-sm" style="color:' + p.muted + '">Ouvre sa fiche pour tes chances.</span>') + "</div>";
  };

  // 14. Joueurs suivis : qui a joué, qui monte (2 × 2 ou 4 × 2)
  T.suivis = function (d, p, W) {
    var big = W >= 300, L = (d.follows || []).slice(0, 3);
    if (!L.length) return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + '"><span class="x-ey" style="color:' + p.muted + '">Joueurs suivis</span><div class="x-sp"></div><span class="x-t1" style="font-size:18px">Suis tes adversaires</span><span class="x-sm" style="margin-top:4px;color:' + p.muted + '">Une cloche sur leur fiche : tu vois ici quand ils jouent ou montent.</span></div>';
    var tone = function (k) { return k === "up" ? [p.menthe, p["gazon-dark"]] : k === "dn" ? [p["terre-soft"], p["terre-dark"]] : [p.chip, p.ink]; };
    var rows = L.map(function (f) {
      var t = tone(f.k);
      return '<div class="x-row" style="flex:1;align-items:center;gap:' + (big ? 10 : 7) + 'px;min-width:0">' +
        '<span class="x-vd" style="flex:none;width:' + (big ? 32 : 26) + "px;height:" + (big ? 32 : 26) + "px;font-size:" + (big ? 11 : 9.5) + "px;background:" + p.menthe + ";color:" + p["gazon-dark"] + (f.fresh ? ";box-shadow:0 0 0 2px " + p.card + ",0 0 0 3.5px " + p.balle : "") + '">' + esc(f.ini) + "</span>" +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="x-ell" style="font-size:' + (big ? 14.5 : 13) + 'px;font-weight:700">' + esc(big ? f.name : f.short) + (big ? ' <span style="font-weight:500;color:' + p.muted + '">' + esc(f.rank) + "</span>" : "") + "</span>" +
        '<span class="x-ell" style="font-size:' + (big ? 12 : 11) + "px;color:" + p.muted + '">' + esc(big ? f.line : f.when || f.rank) + "</span></div>" +
        (f.tag ? chip(f.tag, t[0], t[1]).replace('class="x-chip"', 'class="x-chip" style="flex:none;font-size:' + (big ? 11.5 : 10) + 'px"').replace('" style="background', ';background') : big ? "" : '<span style="font-size:11px;font-weight:700;color:' + p.muted + '">' + esc(f.rank) + "</span>") + "</div>";
    }).join("");
    var px = big ? 16 : 13;
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';padding:0"><span class="x-ey" style="position:absolute;left:' + px + 'px;top:14px;color:' + p.muted + ';font-size:10px">Joueurs suivis</span>' +
      '<div style="position:absolute;left:' + px + "px;right:" + px + 'px;top:34px;bottom:8px;display:flex;flex-direction:column">' + rows + "</div></div>";
  };
  T.suivis2 = function (d, p) { return T.suivis(d, p, 170); };
  T.suivis3 = function (d, p) {
    var L = (d.followsAll || d.follows || []).slice(0, 6);
    if (!L.length) return T.suivis(d, p, 364);
    var tone = function (k) { return k === "up" ? [p.menthe, p["gazon-dark"]] : k === "dn" ? [p["terre-soft"], p["terre-dark"]] : [p.chip, p.ink]; };
    var rows = L.map(function (f) {
      var t = tone(f.k);
      return '<div class="x-row" style="flex:1;align-items:center;gap:11px;min-width:0;border-top:1px solid ' + p.line + '">' +
        '<span class="x-vd" style="flex:none;width:36px;height:36px;font-size:12px;background:' + p.menthe + ";color:" + p["gazon-dark"] + (f.fresh ? ";box-shadow:0 0 0 2px " + p.card + ",0 0 0 3.5px " + p.balle : "") + '">' + esc(f.ini) + "</span>" +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span class="x-ell" style="font-size:15px;font-weight:700">' + esc(f.name) + ' <span style="font-weight:500;color:' + p.muted + '">' + esc(f.rank) + "</span></span>" +
        '<span class="x-ell" style="font-size:12.5px;color:' + p.muted + '">' + esc(f.line) + "</span></div>" +
        (f.tag ? '<span class="x-chip" style="flex:none;font-size:11.5px;background:' + t[0] + ";color:" + t[1] + '">' + esc(f.tag) + "</span>" : "") + "</div>";
    }).join("");
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';padding:0"><div class="x-row" style="position:absolute;left:16px;right:16px;top:15px;align-items:center"><span class="x-ey" style="color:' + p.muted + '">Joueurs suivis</span><div class="x-sp"></div><span class="x-sm" style="color:' + p.muted + '">' + L.length + " sur " + (d.followsN || L.length) + "</span></div>" +
      '<div style="position:absolute;left:16px;right:16px;top:44px;bottom:10px;display:flex;flex-direction:column">' + rows + "</div></div>";
  };


  // ---- 3.49 : Tes face-à-face (grand, moyen, petit) : d.fa = [{ name, ini, rank, v, d, seq: "VDDV" (plus ancien → plus récent), last, when, next }] ----
  function faSq(p, seq, sz, max) {
    var L = String(seq || "").slice(-(max || 8)).split("");
    return '<span style="display:inline-flex;gap:3px">' + L.map(function (r) { return '<i style="display:block;width:' + sz + "px;height:" + sz + "px;border-radius:" + Math.round(sz / 3.5) + "px;background:" + (r === "V" ? p["chart-v"] : mix(p.terre, 55)) + '"></i>'; }).join("") + "</span>";
  }
  function faCol(p, x) { return x.v > x.d ? accent(p) : x.v < x.d ? p.terre : p.ink; }
  function faSc(p, x, fs) { return '<b style="font-size:' + fs + 'px;font-weight:800;letter-spacing:-.04em;line-height:1;white-space:nowrap;color:' + faCol(p, x) + '">' + x.v + '<span style="color:' + p.muted + ';font-weight:600"> – </span>' + x.d + "</b>"; }
  function faEmpty(p, big) {
    return '<div class="x-w" style="' + glow(p, accent(p)) + '">' + eyeb("Tes face-à-face", p.muted) + '<div class="x-sp"></div><span class="x-t1"' + (big ? ' style="font-size:24px"' : "") + ">Rejoue un adversaire</span><span class=\"x-sm\" style=\"margin-top:4px;color:" + p.muted + '">Dès que tu joues quelqu\'un une 2e fois, votre bilan s\'affiche ici.</span></div>';
  }
  T.faf = function (d, p, W, H) {
    // Android : le widget se redimensionne ; trop petit pour la grande version → la moyenne ou la petite
    if (W && W < 250) return T.faf1(d, p); if (H && H < 250) return T.faf2(d, p);
    var L = (d.fa || []).slice(); if (!L.length) return faEmpty(p, true);
    var bete = L.filter(function (x) { return x.d >= 2 && x.d > x.v; }).sort(function (a, b) { return (b.d - b.v) - (a.d - a.v) || b.d - a.d; })[0];
    var cli = L.filter(function (x) { return x.v >= 2 && x.v > x.d; }).sort(function (a, b) { return (b.v - b.d) - (a.v - a.d) || b.v - a.v; })[0];
    var tile = function (x, lab, col) {
      if (!x) return '<div style="flex:1;min-width:0;border-radius:18px;padding:12px;background:' + p.chip + ';display:flex;flex-direction:column;justify-content:center"><span class="x-ey" style="color:' + p.muted + '">' + lab + '</span><span class="x-sm" style="margin-top:6px;color:' + p.muted + '">Pas encore</span></div>';
      return '<div style="flex:1;min-width:0;border-radius:18px;padding:11px 12px;background:radial-gradient(130% 100% at 100% 0%,' + mix(col, 20) + ',transparent 65%),' + p.chip + ';display:flex;flex-direction:column;gap:5px">' +
        '<span class="x-ey" style="color:' + col + '">' + lab + '</span><span class="x-ell" style="font-size:15px;font-weight:700">' + esc(x.name) + "</span>" + faSc(p, x, 34) + '<div class="x-row" style="align-items:center;justify-content:space-between;gap:6px">' + faSq(p, x.seq, 10, 6) + '<span class="x-sm" style="color:' + p.muted + '">' + esc(x.rank) + "</span></div></div>";
    };
    var used = [bete, cli], rest = L.filter(function (x) { return used.indexOf(x) < 0; }).slice(0, 3);
    if (rest.length < 3) rest = L.slice(0, 3);
    var rows = rest.map(function (x) {
      return '<div class="x-row" style="flex:1;align-items:center;gap:10px;min-width:0;border-top:1px solid ' + p.line + '">' +
        '<span class="x-vd" style="flex:none;width:34px;height:34px;font-size:12px;background:' + p.chip + ";color:" + p.ink + '">' + esc(x.ini) + "</span>" +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span class="x-ell" style="font-size:14.5px;font-weight:700">' + esc(x.name) + ' <span style="font-weight:500;color:' + p.muted + '">' + esc(x.rank) + "</span>" + (x.next ? ' <span class="x-chip" style="font-size:10.5px;padding:2px 7px;background:' + p.balle + ";color:" + p["on-balle"] + '">' + esc(x.next) + "</span>" : "") + "</span>" + faSq(p, x.seq, 9, 10) + "</div>" + faSc(p, x, 22) + "</div>";
    }).join("");
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';gap:10px"><div class="x-row" style="align-items:center;justify-content:space-between">' + eyeb("Tes face-à-face", p.muted) + '<span class="x-sm" style="color:' + p.muted + '">' + L.length + " rivaux</span></div>" +
      '<div class="x-row" style="gap:8px">' + tile(bete, "Ta bête noire", p.terre) + tile(cli, "Ton client", accent(p)) + "</div>" +
      '<div style="flex:1;display:flex;flex-direction:column;min-height:0">' + rows + "</div></div>";
  };
  T.faf2 = function (d, p) {
    var L = d.fa || []; if (!L.length) return faEmpty(p);
    var x = L.filter(function (y) { return y.next; })[0] || L[0], col = faCol(p, x);
    var ey = x.next ? (x.v < x.d ? x.next + " · c'est la revanche" : x.next + " · face-à-face") : "Ton plus grand rival";
    return '<div class="x-w" style="' + glow(p, col) + '"><div class="x-row" style="align-items:center;justify-content:space-between">' + eyeb(ey, x.next ? accent(p) : p.muted) + '<span class="x-sm" style="color:' + p.muted + '">' + (x.v + x.d) + " matchs</span></div>" +
      '<div class="x-sp"></div><div class="x-row" style="align-items:flex-end;gap:12px"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><span class="x-t1 x-ell">' + esc(x.name) + '</span><span class="x-sm" style="color:' + p.muted + '">' + esc(x.rank) + (x.last ? " · dernier : " + esc(x.last) : "") + "</span>" + faSq(p, x.seq, 13, 10) + "</div>" + faSc(p, x, 50) + "</div></div>";
  };
  T.faf1 = function (d, p) {
    var L = d.fa || []; if (!L.length) return faEmpty(p);
    var x = L.filter(function (y) { return y.next; })[0] || L[0];
    return '<div class="x-w" style="' + glow(p, faCol(p, x)) + '">' + eyeb(x.next || "Face-à-face", x.next ? accent(p) : p.muted) + '<span class="x-ell" style="margin-top:5px;font-size:16px;font-weight:700">' + esc(shortName(x.name)) + '</span><span class="x-sm" style="color:' + p.muted + '">' + esc(x.rank) + '</span><div class="x-sp"></div>' + faSc(p, x, 46) + '<div style="margin-top:8px">' + faSq(p, x.seq, 11, 8) + "</div></div>";
  };
  var CSS = "*{box-sizing:border-box;margin:0;padding:0}" +
    ".x-w{position:relative;overflow:hidden;width:100%;height:100%;border-radius:24px;padding:15px 16px;display:flex;flex-direction:column;font-family:Fig,Figtree,system-ui,sans-serif;-webkit-font-smoothing:antialiased}" +
    ".x-w>*{position:relative}.x-w>i{position:absolute}" +
    ".x-ey{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;line-height:1.2}" +
    ".x-sp{flex:1}.x-row{display:flex;flex-direction:row}" +
    ".x-t1{font-size:21px;font-weight:700;letter-spacing:-.025em;line-height:1.12}" +
    ".x-t2{font-size:18px;font-weight:700;letter-spacing:-.02em;line-height:1.15}" +
    ".x-huge{font-size:50px;font-weight:800;letter-spacing:-.05em;line-height:.95}" +
    ".x-sm{font-size:12px;line-height:1.3}" +
    ".x-chip{display:inline-block;font-size:12px;font-weight:700;padding:4px 9px;border-radius:99px;white-space:nowrap}" +
    ".x-btn{font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:99px;white-space:nowrap}" +
    ".x-vd{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}" +
    ".x-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 2px 0 6px}" +
    ".x-rkt{display:inline-block;flex-shrink:0}.x-rkt svg{width:100%;height:100%}" +
    ".x-ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".x-clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
    ".x-clamp3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}";

  function html(kind, d, theme, W, H) {
    var p = palette(theme || "lin"), sz = SIZES[kind] || [170, 170];
    W = W || sz[0]; H = H || sz[1];
    return '<div style="width:' + W + "px;height:" + H + 'px;position:relative">' + T[kind](d || {}, p, W, H) + "</div>";
  }

  // Police embarquée (le rendu en image ne voit pas les polices de la page)
  var fontCss = null;
  function loadFonts(base) {
    if (fontCss) return Promise.resolve(fontCss);
    var W = [400, 600, 700, 800];
    return Promise.all(W.map(function (w) {
      return fetch((base || "") + "vendor/fonts/figtree-latin-" + w + "-normal.woff2").then(function (r) { return r.arrayBuffer(); }).then(function (b) {
        var s = "", u = new Uint8Array(b); for (var i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
        return "@font-face{font-family:Fig;font-weight:" + w + ";src:url(data:font/woff2;base64," + btoa(s) + ') format("woff2")}';
      });
    })).then(function (a) { fontCss = a.join(""); return fontCss; }).catch(function () { fontCss = ""; return ""; });
  }

  // Rendu en PNG (base64 sans en-tête). scale = densité de l'écran.
  function render(kind, d, theme, W, H, scale) {
    var sz = SIZES[kind] || [170, 170];
    W = Math.round(W || sz[0]); H = Math.round(H || sz[1]); scale = scale || 2.5;
    return loadFonts().then(function (fc) {
      var holder = document.createElement("div");
      holder.innerHTML = html(kind, d, theme, W, H);
      var xhtml = new XMLSerializer().serializeToString(holder.firstChild);
      var PW = Math.round(W * scale), PH = Math.round(H * scale);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + PW + '" height="' + PH + '"><foreignObject x="0" y="0" width="' + PW + '" height="' + PH + '">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" style="transform:scale(' + scale + ');transform-origin:0 0;width:' + W + "px;height:" + H + 'px"><style>' + fc + CSS + "</style>" + xhtml + "</div></foreignObject></svg>";
      return new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () {
          // petit délai : laisse le temps à la police embarquée d'être appliquée
          setTimeout(function () {
            var c = document.createElement("canvas"); c.width = PW; c.height = PH;
            var g = c.getContext("2d"); g.drawImage(img, 0, 0);
            try { res(c.toDataURL("image/png").split(",")[1]); } catch (e) { rej(e); }
          }, 30);
        };
        img.onerror = function () { rej(new Error("widget " + kind)); };
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      });
    });
  }

  root.MonteeWidgetArt = { SIZES: SIZES, KINDS: Object.keys(SIZES), html: html, render: render, palette: palette, css: CSS, loadFonts: loadFonts };
})(typeof window !== "undefined" ? window : this);
