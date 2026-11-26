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
    faf: [360, 380], faf2: [360, 170], faf1: [170, 170],
    // 3.81 : Ace, Ce qui arrive, ton équipe, tes chances ; formats iPhone de la raquette, de la forme et du sac
    ace: [170, 170], ace2: [360, 170], avenir: [360, 380], avenir2: [360, 170], equipe: [170, 170], chances: [170, 170],
    cordage2: [360, 170], forme2: [170, 170], sac2: [360, 170]
  };
  var VARS = ["bg", "card", "ink", "muted", "line", "chip", "balle", "balle-soft", "on-balle", "gazon", "gazon-dark", "menthe",
    "terre", "terre-dark", "terre-soft", "chart-v", "chart-d", "solid", "on-solid", "panel", "on-panel", "sub", "hl",
    "hero-bg", "hero-ink", "hero-bar", "on-gazon", "on-terre"];

  // Couleurs d'un thème, lues dans la feuille de style de l'app (une seule source de vérité)
  var palCache = {};
  function palette(theme) {
    if (palCache[theme]) return palCache[theme];
    // Thèmes Supporter : bâtis sur Nuit ou Lin (attribut data-skin)
    // 4.4.8 : même table que l'appli (window.MonteeSkinBase) ; avant, Dur, Vert, Crépuscule et Moquette sortaient en Lin
    var SKB = window.MonteeSkinBase || { indoor: "nuit", nocturne: "nuit", retro: "lin", dur: "nuit", vert: "nuit", crep: "nuit", moquette: "nuit" }, base = SKB[theme] || theme;
    var r = document.documentElement, prev = r.getAttribute("data-theme"), prevS = r.getAttribute("data-skin"), out = {};
    if (base === "lin") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", base);
    if (SKB[theme]) r.setAttribute("data-skin", theme); else r.removeAttribute("data-skin");
    var cs = getComputedStyle(r);
    VARS.forEach(function (k) { out[k] = cs.getPropertyValue("--" + k).trim(); });
    if (prev == null) r.removeAttribute("data-theme"); else r.setAttribute("data-theme", prev);
    if (prevS == null) r.removeAttribute("data-skin"); else r.setAttribute("data-skin", prevS);
    out.dark = base === "nuit";
    // 4.4.8 (Yann, piste A validée le 24/11) : en Terre battue, les widgets sont sur l'argile de l'appli (texte blanc, barres sable, boutons vert bâche)
    if (theme === "terre") { var T = { bg: "#A9502A", card: "#A9502A", ink: "#FFFFFF", muted: "#FFE2CC", line: "#C2683F", chip: "#8E401D", balle: "#F6E6CF", "on-balle": "#2A140A", gazon: "#F6E6CF", "gazon-dark": "#FFE9D6", menthe: "#8E401D", terre: "#FFD0B0", "balle-soft": "#8E401D", "hero-bg": "#A9502A", "hero-ink": "#FFFFFF", solid: "#0B4D35", "on-solid": "#FFFFFF" }; for (var k in T) out[k] = T[k]; out.dark = true; }
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
  // 4.16 (Yann, 26/11) : tes chances = une balle de tennis qui se remplit, aux couleurs du thème.
  // Une seule fonction pour l'appli, les widgets et la montre : du « terre » (chances faibles) au « gazon » (toutes tes chances)
  // du thème, mélangés en OKLCH (le milieu passe par le jaune), le milieu éclairci pour rester lisible.
  function hexRgb(c) {
    c = String(c || "").trim(); var m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c);
    if (m) return [+m[1], +m[2], +m[3]];
    c = c.replace("#", ""); if (c.length === 3) c = c.replace(/./g, "$&$&");
    return c.length >= 6 ? [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)] : [128, 128, 128];
  }
  function toOklch(c) {
    var v = hexRgb(c).map(function (x) { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    var l = Math.cbrt(0.4122214708 * v[0] + 0.5363325363 * v[1] + 0.0514459929 * v[2]), m = Math.cbrt(0.2119034982 * v[0] + 0.6806995451 * v[1] + 0.1073969566 * v[2]), s = Math.cbrt(0.0883024619 * v[0] + 0.2817188376 * v[1] + 0.6299787005 * v[2]);
    var L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.sqrt(a * a + b * b), Math.atan2(b, a)];
  }
  function oklchRgb(L, C, H) {
    var a = C * Math.cos(H), b = C * Math.sin(H);
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  }
  function ballCol(p, terre, gazon) {
    var t = Math.max(0, Math.min(1, (p - 0.1) / 0.8)), A = toOklch(terre), B = toOklch(gazon), dh = B[2] - A[2];
    if (dh > Math.PI) dh -= 2 * Math.PI; else if (dh < -Math.PI) dh += 2 * Math.PI;
    var L = Math.max(A[0] + (B[0] - A[0]) * t, 0.5 + 0.22 * (1 - Math.abs(2 * t - 1))), C = A[1] + (B[1] - A[1]) * t, H = A[2] + dh * t, rgb;
    // hors des couleurs affichables : on baisse la saturation, pas la clarté
    for (var i = 0; i < 30; i++) { rgb = oklchRgb(L, C, H); if (rgb.every(function (x) { return x >= -0.001 && x <= 1.001; })) break; C *= 0.93; }
    return "#" + rgb.map(function (x) { x = Math.max(0, Math.min(1, x)); x = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; return ("0" + Math.round(x * 255).toString(16)).slice(-2); }).join("");
  }
  // Ce qu'on écrit dans la balle : jamais 0, 3, 97 ni 100 (« < 5 % », « > 95 % »)
  function ballLab(p, big) { return p < 0.05 ? (big ? "< 5 %" : "<5") : p > 0.95 ? (big ? "> 95 %" : ">95") : String(Math.round(p * 100)); }
  var ballN = 0;
  // o : col (remplissage), empty (vide), ring (contour), ink (chiffre), halo (autour du chiffre) ; S = taille en px
  function ballSvg(p, S, o) {
    o = o || {}; var id = "obq" + (++ballN), big = S >= 60, lvl = (98 - 96 * Math.max(0, Math.min(1, p))).toFixed(1), lb = ballLab(p, big), ex = /[<>]/.test(lb);
    var ink = o.ink || "var(--ink)", halo = o.halo || "var(--card)", fs = (big ? 27 : 38) * (lb.length > 3 && !big ? 0.8 : ex && big ? 0.78 : 1);
    var txt = ex || !big ? esc(lb) : esc(lb) + '<tspan font-size="' + Math.round(fs * 0.5) + '" dx="2">%</tspan>';
    return '<svg class="obq" viewBox="0 0 100 100" width="' + S + '" height="' + S + '" role="img" aria-label="' + esc(ballLab(p, true)) + ' de chances" style="display:block;flex:none;overflow:visible">' +
      '<defs><clipPath id="' + id + '"><circle cx="50" cy="50" r="48"/></clipPath></defs>' +
      '<circle cx="50" cy="50" r="48" fill="' + (o.empty || "color-mix(in srgb, var(--ink) 9%, var(--card))") + '"/>' +
      '<g clip-path="url(#' + id + ')"><path class="obq-f" d="M-5 ' + lvl + " Q12 " + (lvl - 4) + " 28 " + lvl + " T62 " + lvl + " T96 " + lvl + " T130 " + lvl + ' V110 H-5 Z" fill="' + (o.col || "#D4E64A") + '"/>' +
      '<g fill="none" stroke="#fff" stroke-width="' + (big ? 3 : 5) + '" opacity=".6"><path d="M14 8 Q46 50 14 92"/><path d="M86 8 Q54 50 86 92"/></g></g>' +
      '<circle cx="50" cy="50" r="47" fill="none" stroke="' + (o.ring || "color-mix(in srgb, var(--ink) 22%, transparent)") + '" stroke-width="' + (big ? 1.6 : 2.5) + '"/>' +
      '<text x="50" y="' + (big ? 59 : 63) + '" text-anchor="middle" font-size="' + fs.toFixed(1) + '" font-weight="800" font-family="inherit" fill="' + ink + '" stroke="' + halo + '" stroke-width="' + (big ? 5 : 7) + '" paint-order="stroke" letter-spacing="-1">' + txt + "</text></svg>";
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
    // 3.81 (Yann) : cartes neutres partout, la couleur seulement en accent (plus de fond vert, jaune-vert ou terre)
    var a = st === "down" ? p.terre : st === "up" || st === "norm" ? accent(p) : p.gazon;
    return { bg: p.card, fg: p.ink, sub: p.muted, acc: a, track: p.chip };
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
  // 3.81 (Yann) : un classement = la petite balle jaune devant, comme .rk-tag dans l'app
  function rkb(r, p, fs, col) {
    if (!r) return ""; fs = fs || 13; var z = Math.max(6, Math.round(fs * 0.6));
    return '<span style="white-space:nowrap;font-weight:800;font-size:' + fs + "px;color:" + (col || p.ink) + '"><span style="display:inline-block;width:' + z + "px;height:" + z + "px;border-radius:50%;background:" + p.balle +
      ";box-shadow:inset 0 0 0 1px " + mix(p.ink, 25) + ";margin-right:" + Math.round(fs * 0.3) + "px;vertical-align:" + Math.round(fs * 0.06) + 'px"></span>' + esc(r) + "</span>";
  }
  // 3.81 : Ace (la Balle, balle.js) en image fixe, dans l'humeur du moment
  function aceArt(mood, sz) {
    var B = root.Balle;
    if (B && B.make) {
      try {
        var w = B.make(sz), f = B.M[mood] || B.M.repos;
        w.pose(f(mood === "repos" ? 0.05 : mood === "joie" || mood === "arrivee" ? 1 : 0.55));
        return '<span style="display:block;flex:none;width:' + sz + "px;height:" + Math.round(sz * 1.1) + 'px">' + w.innerHTML + "</span>";
      } catch (e) {}
    }
    return '<span style="display:block;flex:none">' + tball("#D4E64A", "#F4F7E1", sz) + "</span>";
  }
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

        return '<div class="x-w" style="' + glow(p, ac) + ';gap:2px">' +
          '<div class="x-row" style="align-items:center;gap:6px">' + rkb(tg[0] || d.rankNow || d.rank, p, 14) + '<b style="color:' + p.muted + ';font-size:13px">→</b>' + rkb(tg[1] || "", p, 14, ac) + "</div>" +
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
    s += '<div class="x-row" style="align-items:center;gap:8px"><span class="x-ey x-ell" style="flex:1;font-size:10px;color:' + (st === "down" ? p.terre : p.muted) + '">' + esc(ey + (d.days != null ? " · dans " + d.days + " j" : "")) + "</span>" + (d.target ? (st === "down" ? '<span class="x-sm" style="font-weight:700">Maintien ' + rkb(d.rankNow || d.rank, p, 12) + "</span>" : rkb(String(d.target).split("→")[0].trim(), p, 12) + '<b style="color:' + p.muted + ';font-size:12px">→</b>' + rkb((String(d.target).split("→")[1] || "").trim(), p, 12, ac2)) : "") + "</div>" +
      '<span class="x-t1 x-clamp2" style="font-size:21px;margin-top:3px">' + esc(d.headline) + "</span>" + (d.sub ? '<span class="x-sm x-ell" style="color:' + p.muted + '">' + esc(d.sub) + "</span>" : "") + '<div class="x-sp"></div>';
    if (d.norme) s += bbar(p, d.pct, ac2) + '<div class="x-row x-sm" style="color:' + p.muted + '"><span><b style="color:' + p.ink + '">' + d.total + "</b> / " + d.norme + " pts au bilan " + esc(d.label || "") + '</span><div class="x-sp"></div><span>il en faut ' + d.norme + "</span></div>";
    return s + "</div>";
  };

  // 3. Raquette (2 × 2)
  // 3.81 (maquette B3 validée) : ta raquette à ses couleurs ; les cordes prennent la couleur de l'usure, du bas vers le haut
  var rkN = 0;
  function rkCol(p, r) { var bad = r.level === "change" || r.level === "broken"; return bad ? p.terre : r.level === "soon" ? p["chart-d"] : p.gazon; }
  function rkWear(p, r, h) {
    var I = ill(); if (!I) return "";
    var f = r.known ? Math.max(0.04, Math.min(1, (r.pct || 0) / 100)) : 0, col = rkCol(p, r), id = "rw" + (rkN++);
    var svg = I.racket(r.color || "noir", r.accent, r.pattern).replace(/(id="|url\(#)(rk[^"\)]*?)(f|c)(["\)])/g, "$1$2" + id + "$3$4");
    var cid = (svg.match(/clipPath id="([^"]+)"/) || [])[1], str = "";
    for (var x = 13; x <= 47; x += 4) str += "M" + x + " 6V68";
    for (var y = 12; y <= 64; y += 4) str += "M6 " + y + "H54";
    var y0 = (6 + 62 * (1 - f)).toFixed(1);
    if (f > 0 && cid) svg = svg.replace("</defs>", '<clipPath id="' + id + 'w"><rect x="0" y="' + y0 + '" width="60" height="' + (68 - y0).toFixed(1) + '"/></clipPath></defs>')
      .replace('<path d="M22 64', '<g clip-path="url(#' + cid + ')"><g clip-path="url(#' + id + 'w)"><rect x="6" y="4" width="48" height="66" fill="' + col + '" opacity=".14"/><path d="' + str + '" stroke="' + col + '" stroke-width="1.15"/></g></g><path d="M22 64');
    return '<span class="x-rkt" style="height:' + h + "px;width:" + Math.round(h * 0.484) + "px;transform:rotate(-8deg)" + (isDark(p) ? ";filter:drop-shadow(0 0 .7px rgba(242,243,245,.85)) drop-shadow(0 0 4px rgba(242,243,245,.16))" : "") + '">' + svg + "</span>";
  }
  function rkState(r, d, big) {
    if (r.level === "broken") return "Cordage cassé";
    if (r.level === "change") return "À recorder" + (big && d.racketBefore ? " avant " + d.racketBefore : "");
    if (r.level === "soon") return "Bientôt à recorder";
    if (!r.known) return "Date de cordage ?";
    return r.left != null ? "Encore " + r.left + " h" + (big ? ", tout va bien" : "") : "Cordage en forme";
  }
  T.cordage = function (d, p, W) {
    var r = d.racket;
    if (!r) return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + '"><span class="x-ey" style="color:' + p.muted + '">Ton sac</span><div class="x-sp"></div><span class="x-t1">Ajoute ta raquette</span><span class="x-sm" style="color:' + p.muted + '">Montée suivra l\'usure du cordage.</span></div>';
    var big = W >= 300, col = rkCol(p, r), hN = r.known ? String(r.hN || (r.hours || "").replace(/[^0-9,]/g, "")) : "?";
    var sub = r.known ? (r.maxH ? "sur " + r.maxH + " h" + (big ? " prévues" : "") : "de jeu") : "depuis le cordage";
    var foot = big ? (r.level === "change" || r.level === "broken") && d.racketOpp ? '<span class="x-sm x-ell" style="color:' + p.muted + ';margin-top:2px">contre ' + esc(d.racketOpp.name) + (d.racketOpp.rank ? " " + rkb(d.racketOpp.rank, p, 12) : "") + "</span>" : r.since ? '<span class="x-sm x-ell" style="color:' + p.muted + ';margin-top:2px">Cordée le ' + esc(r.since) + "</span>" : "" : "";
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';flex-direction:row;padding:0;align-items:stretch">' +
      '<div style="width:' + (big ? 96 : 66) + "px;flex:none;display:flex;align-items:center;justify-content:center;padding-left:" + (big ? 18 : 10) + 'px">' + rkWear(p, r, big ? 140 : 128) + "</div>" +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;padding:15px 14px 15px 10px">' +
      '<span class="x-ey x-ell" style="color:' + p.muted + ';font-size:9.5px;letter-spacing:.03em">' + esc(big ? r.title || r.name : r.name || "Raquette") + '</span><div class="x-sp"></div>' +
      (big ? '<div class="x-row" style="align-items:baseline;gap:8px">' : "") + '<b style="font-size:34px;font-weight:800;letter-spacing:-.035em;line-height:1">' + esc(hN) + '<span style="font-size:17px;letter-spacing:0"> h</span></b>' +
      '<span class="x-sm" style="color:' + p.muted + '">' + esc(sub) + "</span>" + (big ? "</div>" : "") +
      '<b class="x-ell" style="font-size:13px;margin-top:7px;color:' + col + '">' + esc(rkState(r, d, big)) + "</b>" + foot + "</div></div>";
  };
  T.cordage2 = function (d, p) { return T.cordage(d, p, 360); };

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
    // 3.81 : carte neutre, la couleur en accent seulement
    var st = state(d), up = st === "up", rel = relLabel(d), ac = st === "down" ? p.terre : accent(p);
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';padding:8px;align-items:center;justify-content:center;text-align:center;gap:1px">' + (up ? confetti(p, [84, 95, 10, 88]) : "") +
      '<span class="x-ey" style="font-size:9.5px;color:' + (up ? ac : p.muted) + '">' + (up ? "Tu montes" : "Sortie") + "</span>" +
      '<span style="font-size:' + (up ? 24 : 22) + "px;font-weight:800;letter-spacing:-.04em;line-height:1.05;position:relative;color:" + (up ? ac : p.ink) + '">' + esc(up ? d.rank : rel || "—") + "</span>" +
      '<span style="font-size:10px;font-weight:600;position:relative;color:' + p.muted + '">' + esc(up ? rel : d.rank ? d.rank : "") + "</span></div>";
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
      rkb(d.rank || "—", p, 14) + "</div>";
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
  // 3.81 (maquette validée) : « Le truc à savoir » devient la voix d'Ace, sans liseré, avec sa tête
  T.truc = function (d, p) {
    var a = d.ace || {}, t = a.t || d.truc || "Annote tes matchs : je te dirai où tu gagnes le plus.";
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';flex-direction:row;align-items:center;gap:10px;padding:10px 16px 10px 12px">' + aceArt(a.m || "repos", 46) +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span class="x-ey" style="color:' + accent(p) + '">Ace</span><span style="font-size:14.5px;font-weight:700;line-height:1.28;letter-spacing:-.01em" class="x-clamp2">' + esc(t) + "</span></div></div>";
  };
  T.ace = function (d, p, W) {
    if (W && W >= 300) return T.ace2(d, p); // Android : widget agrandi
    var a = d.ace || {}, t = a.t || "Ajoute tes matchs : je te dirai comment monter.";
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + '"><span class="x-ey" style="color:' + accent(p) + '">Ace</span>' +
      '<span style="position:absolute;right:10px;top:8px">' + aceArt(a.m || "repos", 54) + '</span><div class="x-sp"></div>' +
      '<span class="x-clamp3" style="font-size:15px;font-weight:800;line-height:1.25;letter-spacing:-.01em">' + esc(t) + "</span></div>";
  };
  T.ace2 = function (d, p) {
    var a = d.ace || {}, t = a.t || "Ajoute tes matchs : je te dirai comment monter.";
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';flex-direction:row;align-items:center;gap:14px">' + aceArt(a.m || "repos", 84) +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span class="x-ey" style="color:' + accent(p) + '">Ace</span>' +
      '<span class="x-clamp3" style="font-size:18px;font-weight:800;line-height:1.22;letter-spacing:-.015em">' + esc(t) + '</span><span class="x-sm" style="color:' + p.muted + '">Touche pour en parler</span></div></div>';
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
      return '<div style="flex:1;min-width:0;display:flex;gap:8px;align-items:center;background:' + p.chip + ';border-radius:16px;padding:8px 10px">' + rk(r, 50) +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><b style="font-size:14px" class="x-ell">' + esc(r.name) + "</b>" + bar(r.pct, col, p.line, 5) +
        '<span style="font-size:11px;font-weight:' + (bad ? 700 : 400) + ";color:" + (bad ? p.terre : p.muted) + '" class="x-ell">' + esc((r.hours || "?") + " · " + (r.short || "")) + "</span></div></div>";
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
    // 4.16 (maquette D validée le 26/11) : la balle à gauche, le verdict en premier, l'adversaire, puis le conseil sur une ligne
    var pc = o.p, nm = String(o.name || "").toLowerCase().replace(/(^|[\s'-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
    var bc = pc != null ? ballCol(pc / 100, p.terre, p.gazon) : p.muted;
    return '<div class="x-w" style="' + glow(p, ac) + ';gap:0;padding:14px 16px">' +
      '<div class="x-row" style="align-items:center;gap:14px">' + (pc != null ? oddsBallW(pc, 78, p) : "") +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">' +
      (pc != null ? '<b class="x-ell" style="font-size:22px;letter-spacing:-.02em;line-height:1.1;color:' + verdictCol(bc, p) + '">' + esc(o.head || "Tes chances") + "</b>" : "") +
      '<div class="x-row" style="align-items:center;gap:7px;font-size:14px;min-width:0"><span style="color:' + p.muted + ';font-weight:600">contre</span><b class="x-ell" style="letter-spacing:-.01em;min-width:0">' + esc(nm) + "</b>" + rkb(o.rank || "?", p, 13) + "</div>" +
      eyeb(o.when ? o.when : "Consulté récemment", p.muted) + "</div></div>" +
      '<div class="x-sp"></div>' +
      (o.tip ? '<div class="x-ell" style="padding-top:8px;border-top:1px solid ' + p.line + '"><b style="font-size:13px">' + esc(o.tip) + "</b>" + (o.tipS ? '<span style="font-size:12px;color:' + p.muted + '"> · ' + esc(o.tipS) + "</span>" : "") + "</div>" : "") + "</div>";
  };
  function oddsBallW(pc, S, p) { return ballSvg(pc / 100, S, { col: ballCol(pc / 100, p.terre, p.gazon), empty: "color-mix(in srgb, " + p.ink + " 10%, " + p.card + ")", ring: "color-mix(in srgb, " + p.ink + " 22%, transparent)", ink: p.ink, halo: p.card }); }
  // le verdict à la couleur de la balle, un ton plus sombre sur fond clair pour rester lisible
  function verdictCol(c, p) { return isDark(p) ? c : "color-mix(in srgb, " + c + " 68%, #000)"; }

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
    // 4.16 (maquette A validée le 26/11) : la balle et le verdict côte à côte, le conseil dessous
    var pc = o.p, bc = pc != null ? ballCol(pc / 100, p.terre, p.gazon) : p.muted, tp = o.tip || "";
    return '<div class="x-w" style="' + glow(p, ac) + ';gap:2px;padding:14px 16px">' +
      '<div class="x-row" style="align-items:center;gap:6px"><span style="flex:1;min-width:0">' + eyeb(o.when ? o.when : "Recherche", p.muted) + "</span>" + rkb(o.rank || "?", p, 13) + "</div>" +
      '<b class="x-ell" style="font-size:16px;letter-spacing:-.02em;line-height:1.2;display:block">' + esc(shortName(o.name)) + "</b>" +
      '<div class="x-sp"></div>' +
      (pc != null ? '<div class="x-row" style="align-items:center;gap:10px">' + oddsBallW(pc, 58, p) + '<b style="font-size:15px;line-height:1.15;color:' + verdictCol(bc, p) + '">' + esc(o.head || "de chances") + "</b></div>" +
        '<div class="x-sp"></div>' + (tp ? '<span class="x-sm x-ell" style="font-weight:700;font-size:12.5px">' + esc(tp) + "</span>" : "")
        : '<span class="x-sm" style="color:' + p.muted + '">Ouvre sa fiche pour tes chances.</span>') + "</div>";
  };

  // 14. Joueurs suivis : qui a joué, qui monte (2 × 2 ou 4 × 2)
  T.suivis = function (d, p, W, H) {
    if (W >= 300 && H >= 300) return T.suivis3(d, p); // 3.81 : Android, widget agrandi
    var big = W >= 300, L = (d.follows || []).slice(0, 3);
    if (!L.length) return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + '"><span class="x-ey" style="color:' + p.muted + '">Joueurs suivis</span><div class="x-sp"></div><span class="x-t1" style="font-size:18px">Suis tes adversaires</span><span class="x-sm" style="margin-top:4px;color:' + p.muted + '">Une cloche sur leur fiche : tu vois ici quand ils jouent ou montent.</span></div>';
    var tone = function (k) { return k === "up" ? [p.menthe, p["gazon-dark"]] : k === "dn" ? [p["terre-soft"], p["terre-dark"]] : [p.chip, p.ink]; };
    var rows = L.map(function (f) {
      var t = tone(f.k);
      return '<div class="x-row" style="flex:1;align-items:center;gap:' + (big ? 10 : 7) + 'px;min-width:0">' +
        '<span class="x-vd" style="flex:none;width:' + (big ? 32 : 26) + "px;height:" + (big ? 32 : 26) + "px;font-size:" + (big ? 11 : 9.5) + "px;background:" + p.menthe + ";color:" + p["gazon-dark"] + (f.fresh ? ";box-shadow:0 0 0 2px " + p.card + ",0 0 0 3.5px " + p.balle : "") + '">' + esc(f.ini) + "</span>" +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="x-ell" style="font-size:' + (big ? 14.5 : 13) + 'px;font-weight:700">' + esc(big ? f.name : f.short) + (big && f.rank ? " " + rkb(f.rank, p, 12, p.muted) : "") + "</span>" +
        '<span class="x-ell" style="font-size:' + (big ? 12 : 11) + "px;color:" + p.muted + '">' + esc(big ? f.line : f.when || f.rank) + "</span></div>" +
        (f.tag ? chip(f.tag, t[0], t[1]).replace('class="x-chip"', 'class="x-chip" style="flex:none;font-size:' + (big ? 11.5 : 10) + 'px"').replace('" style="background', ';background') : big ? "" : rkb(f.rank, p, 11, p.muted)) + "</div>";
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
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span class="x-ell" style="font-size:15px;font-weight:700">' + esc(f.name) + (f.rank ? " " + rkb(f.rank, p, 13, p.muted) : "") + "</span>" +
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
        '<span class="x-ey" style="color:' + col + '">' + lab + '</span><span class="x-ell" style="font-size:15px;font-weight:700">' + esc(x.name) + "</span>" + faSc(p, x, 34) + '<div class="x-row" style="align-items:center;justify-content:space-between;gap:6px">' + faSq(p, x.seq, 10, 6) + rkb(x.rank, p, 12, p.muted) + "</div></div>";
    };
    var used = [bete, cli], rest = L.filter(function (x) { return used.indexOf(x) < 0; }).slice(0, 3);
    if (rest.length < 3) rest = L.slice(0, 3);
    var rows = rest.map(function (x) {
      return '<div class="x-row" style="flex:1;align-items:center;gap:10px;min-width:0;border-top:1px solid ' + p.line + '">' +
        '<span class="x-vd" style="flex:none;width:34px;height:34px;font-size:12px;background:' + p.chip + ";color:" + p.ink + '">' + esc(x.ini) + "</span>" +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span class="x-ell" style="font-size:14.5px;font-weight:700">' + esc(x.name) + (x.rank ? " " + rkb(x.rank, p, 12, p.muted) : "") + (x.next ? ' <span class="x-chip" style="font-size:10.5px;padding:2px 7px;background:' + p.balle + ";color:" + p["on-balle"] + '">' + esc(x.next) + "</span>" : "") + "</span>" + faSq(p, x.seq, 9, 10) + "</div>" + faSc(p, x, 22) + "</div>";
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
      '<div class="x-sp"></div><div class="x-row" style="align-items:flex-end;gap:12px"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><span class="x-t1 x-ell">' + esc(x.name) + '</span><span class="x-sm" style="color:' + p.muted + '">' + rkb(x.rank, p, 12, p.muted) + (x.last ? " · dernier : " + esc(x.last) : "") + "</span>" + faSq(p, x.seq, 13, 10) + "</div>" + faSc(p, x, 50) + "</div></div>";
  };
  T.faf1 = function (d, p) {
    var L = d.fa || []; if (!L.length) return faEmpty(p);
    var x = L.filter(function (y) { return y.next; })[0] || L[0];
    return '<div class="x-w" style="' + glow(p, faCol(p, x)) + '">' + eyeb(x.next || "Face-à-face", x.next ? accent(p) : p.muted) + '<span class="x-ell" style="margin-top:5px;font-size:16px;font-weight:700">' + esc(shortName(x.name)) + '</span><span class="x-sm" style="color:' + p.muted + '">' + rkb(x.rank, p, 12, p.muted) + '</span><div class="x-sp"></div>' + faSc(p, x, 46) + '<div style="margin-top:8px">' + faSq(p, x.seq, 11, 8) + "</div></div>";
  };

  // ---- 3.81 : formats iPhone de la forme (carré) et du sac (moyen) ----
  T.forme2 = function (d, p) {
    var f = d.form || [];
    var dots = f.map(function (r) { var v = r === "V"; return '<span class="x-vd" style="width:34px;height:34px;font-size:13px;background:' + (v ? p["chart-v"] : p["terre-soft"]) + ";color:" + (v ? p["on-gazon"] : p["terre-dark"]) + '">' + r + "</span>"; }).join("");
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';gap:8px"><div class="x-row"><span class="x-ey" style="color:' + p.muted + '">Forme</span><div class="x-sp"></div><span class="x-sm" style="color:' + p.muted + '">' + esc(d.recordShort || "") + "</span></div>" +
      '<div class="x-sp"></div><div style="display:grid;grid-template-columns:repeat(3,34px);gap:8px;justify-content:center">' + (dots || "") + "</div>" + (dots ? "" : '<span class="x-sm" style="color:' + p.muted + '">Pas encore de match</span>') +
      '<div class="x-sp"></div><span class="x-sm x-ell" style="font-weight:700">' + esc(d.streak || "") + "</span></div>";
  };
  T.sac2 = function (d, p) {
    var list = (d.bag || []).slice(0, 3);
    if (!list.length) return T.cordage(d, p, 360);
    var rows = list.map(function (r, i) {
      var col = rkCol(p, r);
      return '<div class="x-row" style="flex:1;align-items:center;gap:10px;min-width:0' + (i ? ";border-top:1px solid " + p.line : "") + '">' + rk(r, 34) +
        '<b class="x-ell" style="flex:1;font-size:14px">' + esc(r.name) + '</b><div style="width:90px">' + bar(r.pct, col, p.chip, 5) + "</div>" +
        '<span class="x-sm" style="min-width:74px;text-align:right;font-weight:700;color:' + (r.level === "ok" || !r.level ? p.muted : col) + '">' + esc((r.hours || "?") + " · " + (r.short || "")) + "</span></div>";
    }).join("");
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';gap:4px">' + eyeb("Ton sac", p.muted) + '<div style="flex:1;display:flex;flex-direction:column">' + rows + "</div></div>";
  };

  // ---- 3.81 (maquette validée) : Ce qui arrive (la frise de l'accueil) ----
  // d.cal = [{ d: "29", w: "DIM.", t, s, st, k: "team"|"tour"|"match"|"rel"|"badge"|"todo" }]
  function calRow(p, x, first) {
    var stc = x.k === "rel" ? accent(p) : x.k === "badge" ? p.muted : p.gazon;
    return '<div class="x-row" style="flex:1;align-items:center;gap:10px;min-width:0;max-height:62px' + (first ? "" : ";border-top:1px solid " + p.line) + '">' +
      '<div style="width:34px;flex:none;text-align:center;line-height:1.05"><b style="display:block;font-size:17px">' + esc(x.d) + '</b><span style="font-size:9px;font-weight:800;color:' + p.muted + '">' + esc(x.w) + "</span></div>" +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column"><b class="x-ell" style="font-size:13.5px">' + esc(x.t) + '</b><span class="x-sm x-ell" style="font-size:11px;color:' + p.muted + '">' + esc(x.s || "") + "</span></div>" +
      (x.st ? '<b style="font-size:11.5px;white-space:nowrap;color:' + stc + '">' + esc(x.st) + "</b>" : "") + "</div>";
  }
  T.avenir = function (d, p, W, H) {
    H = H || 380; var n = Math.max(2, Math.min(7, Math.floor((H - 40) / 48))), L = (d.cal || []).slice(0, n);
    if (!L.length) return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + '">' + eyeb("Ce qui arrive", p.muted) + '<div class="x-sp"></div><span class="x-t1" style="font-size:18px">Rien de prévu pour l\'instant</span><span class="x-sm" style="margin-top:4px;color:' + p.muted + '">Tes tournois, matchs d\'équipe et matchs prévus s\'afficheront ici.</span></div>';
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + ';padding:12px 16px 8px">' + eyeb("Ce qui arrive", p.muted) +
      '<div style="flex:1;display:flex;flex-direction:column;margin-top:4px">' + L.map(function (x, i) { return calRow(p, x, !i); }).join("") +
      (L.length < n && H > 200 ? '<div class="x-sp"></div><span class="x-sm" style="color:' + p.muted + ';padding:6px 0 4px;border-top:1px solid ' + p.line + '">Rien d\'autre de prévu pour l\'instant</span>' : "") + "</div></div>";
  };
  T.avenir2 = function (d, p) { return T.avenir(d, p, 360, 170); };

  // ---- 3.81 : ton équipe (prochaine rencontre, puis le score) ----
  T.equipe = function (d, p) {
    var t = d.team;
    if (!t) return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + '">' + eyeb("Ton équipe", p.muted) + '<div class="x-sp"></div><span class="x-t1" style="font-size:18px">Pas de rencontre prévue</span><span class="x-sm" style="margin-top:4px;color:' + p.muted + '">Ta prochaine rencontre par équipes s\'affichera ici.</span></div>';
    var nm = String(t.t || "").split(" – ");
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + '">' + eyeb((t.live ? "En cours" : "Équipe") + (t.when ? " · " + t.when : ""), t.live ? accent(p) : p.muted) + '<div class="x-sp"></div>' +
      '<b class="x-clamp2" style="font-size:17px;line-height:1.2;letter-spacing:-.01em">' + esc(nm[0] || "") + "</b>" + (nm[1] ? '<span style="font-size:13px;font-weight:700;color:' + p.muted + '">contre</span><b class="x-clamp2" style="font-size:17px;line-height:1.2;letter-spacing:-.01em">' + esc(nm[1]) + "</b>" : "") +
      '<div class="x-sp"></div><span class="x-sm x-ell" style="color:' + p.muted + '">' + esc(String(t.s || "").replace(/^(Équipe|Suivie) · /, "")) + "</span>" +
      (t.st ? '<span style="align-self:flex-start;margin-top:5px;font-size:11px;font-weight:800;border-radius:99px;padding:2px 8px;white-space:nowrap;border:1.5px solid ' + (t.live ? accent(p) : p.gazon) + ";color:" + (t.live ? accent(p) : p.gazon) + '">' + esc(t.st) + "</span>" : "") + "</div>";
  };

  // ---- 3.81 : tes chances de monter (Montée+), le même calcul que sur l'iPhone ----
  T.chances = function (d, p) {
    var c = d.chances, ac = accent(p);
    if (!c) return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + '">' + eyeb("Tes chances · Montée+", p.muted) + '<div class="x-sp"></div><span class="x-t1" style="font-size:18px">Tu montes à la sortie ?</span><span class="x-sm" style="margin-top:4px;color:' + p.muted + '">Ton % de chances, recalculé à chaque match.</span></div>';
    var dl = c.delta ? '<span class="x-sm" style="font-weight:700"><b style="color:' + (c.delta > 0 ? p.gazon : p.terre) + '">' + (c.delta > 0 ? "+" : "−") + Math.abs(c.delta) + " pts</b> en 7 jours</span>" : '<span class="x-sm" style="color:' + p.muted + '">Le ' + esc(c.rel || "") + "</span>";
    return '<div class="x-w" style="background:' + p.card + ";color:" + p.ink + '">' + eyeb(c.down ? "Te maintenir" : "Tes chances", p.muted) + '<div class="x-sp"></div>' +
      '<div class="x-row" style="align-items:center;gap:10px"><div style="position:relative;width:74px;height:74px;flex:none">' + ring(c.p, ac, p.chip, 74, 8) +
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><b style="font-size:18px;letter-spacing:-.03em">' + c.p + " %</b></div></div>" +
      '<span class="x-sm" style="color:' + p.muted + '">' + (c.down ? "de rester " : "d'être ") + rkb(c.t, p, 13) + "</span></div>" +
      '<div class="x-sp"></div>' + dl + "</div>";
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

  root.MonteeWidgetArt = { SIZES: SIZES, KINDS: Object.keys(SIZES), html: html, render: render, palette: palette, ballCol: ballCol, ballSvg: ballSvg, ballLab: ballLab, css: CSS, loadFonts: loadFonts };
})(typeof window !== "undefined" ? window : this);
