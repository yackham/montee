/* Montée — lecture du palmarès Ten'Up copié (texte brut), sans IA.
   Le texte vient soit d'un copier-coller de la page « Palmarès » de Ten'Up,
   soit du favori « Envoyer à Montée » qui copie le texte de la page.
   Heuristique : on découpe par date, puis on cherche dans chaque bloc
   le score, le classement de l'adversaire, le résultat et le nom.
   Tout est vérifiable et modifiable avant l'import. */
(function (root) {
  "use strict";

  var MONTHS = { janv: 1, jan: 1, fevr: 2, fev: 2, feb: 2, mars: 3, mar: 3, avr: 4, apr: 4, mai: 5, may: 5, juin: 6, jun: 6,
    juil: 7, jul: 7, aout: 8, aug: 8, sept: 9, sep: 9, oct: 10, nov: 11, dec: 12 };

  function strip(s) { return s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

  var DATE_NUM = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g;
  var DATE_TXT = /\b(\d{1,2})(?:er)?\s+(janv(?:ier)?|f[ée]vr(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?)\.?\s+(\d{4})\b/gi;

  function pad(n) { return String(n).padStart(2, "0"); }
  function toIso(day, mon, year) {
    year = +year; if (year < 100) year += 2000;
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
    return year + "-" + pad(mon) + "-" + pad(day);
  }

  // Positions de toutes les dates dans le texte
  function findDates(text) {
    var out = [], m;
    DATE_NUM.lastIndex = 0;
    while ((m = DATE_NUM.exec(text))) {
      var iso = toIso(+m[1], +m[2], m[3]);
      if (iso) out.push({ i: m.index, end: m.index + m[0].length, iso: iso });
    }
    DATE_TXT.lastIndex = 0;
    while ((m = DATE_TXT.exec(text))) {
      var key = strip(m[2].toLowerCase()).slice(0, 4).replace(/\.$/, "");
      var mon = MONTHS[key] || MONTHS[key.slice(0, 3)];
      var iso2 = mon && toIso(+m[1], mon, m[3]);
      if (iso2) out.push({ i: m.index, end: m.index + m[0].length, iso: iso2 });
    }
    return out.sort(function (a, b) { return a.i - b.i; });
  }

  // Score : au moins 2 manches "6/4 3-6 7/6(5)" ou une manche avec abandon
  var SCORE = /(?:\b[0-7]\s*[\/\-]\s*[0-7](?:\s*\(\s*\d+\s*\))?\s*){2,3}|\b[0-7]\s*[\/\-]\s*[0-7]\s*(?:ab|abandon|ret)\b/gi;
  var RANK = /(?:^|[\s,;|(])(NC|N°\s?\d{1,3}|-?15|-2\/6|-4\/6|30\/[1-5]|15\/[1-5]|30|40|[0-5]\/6|0)(?=$|[\s,;|)])/g;

  var STOP = ["victoire", "defaite", "gagne", "perdu", "tournoi", "championnat", "equipes", "simple", "double", "messieurs", "dames",
    "homologue", "match", "libre", "wo", "w.o", "forfait", "score", "classement", "adversaire", "date", "resultat", "epreuve", "phase",
    "le", "la", "les", "contre", "face", "tableau", "poule", "finale", "demi", "quart", "tour", "voir", "detail", "points", "coef", "coefficient", "palmares", "bilan", "seniors", "senior"];

  function parseBlock(block, iso) {
    var raw = block;
    var low = strip(block.toLowerCase());
    var r = { date: iso, opp: "", oppRank: "", result: "", score: "", wo: false, kind: "tournoi", ok: true, raw: raw.trim().slice(0, 240) };

    if (/\bw\.?\s?o\.?\b|forfait/.test(low)) r.wo = true;
    if (/championnat\s+individuel|champ\.?\s*indiv/.test(low)) r.kind = "champ";
    else if (/equipe|interclub|championnat/.test(low)) r.kind = "equipes";
    else if (/match\s+libre|libre/.test(low)) r.kind = "libre";

    // score
    SCORE.lastIndex = 0;
    var sm = SCORE.exec(block), rest = block;
    if (sm) { r.score = sm[0].trim().replace(/\s+/g, " "); rest = block.slice(0, sm.index) + " " + block.slice(sm.index + sm[0].length); }

    // résultat
    if (/\b(victoire|gagne|gagnee|vainqueur)\b/.test(low)) r.result = "V";
    else if (/\b(defaite|perdu|perdue|battu)\b/.test(low)) r.result = "D";
    else {
      var vd = rest.match(/(?:^|\s)(V|D)(?=\s|$)/);
      if (vd) r.result = vd[1];
    }

    // classement adversaire : on privilégie 15/x, 30/x, puis le reste
    RANK.lastIndex = 0;
    var ranks = [], m;
    while ((m = RANK.exec(rest))) ranks.push(m[1].replace(/\s/g, ""));
    var pref = ranks.filter(function (x) { return /\//.test(x) || /^(NC|N°)/.test(x); });
    r.oppRank = (pref[0] || ranks[0] || "").replace(/^N°/, "N°");

    // nom : suite de mots avec majuscules, hors mots-clés
    var words = rest.replace(/[|;,\t()]/g, " ").split(/\s+/).filter(Boolean);
    var name = [], started = false;
    for (var k = 0; k < words.length; k++) {
      var w = words[k], ws = strip(w.toLowerCase()).replace(/[.:]/g, "");
      var isName = /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'\-.]+$/.test(w) && STOP.indexOf(ws) < 0 && !/\d/.test(w);
      if (isName) { name.push(w); started = true; if (name.length >= 3) break; }
      else if (started) break;
    }
    r.opp = name.join(" ");
    if (!r.oppRank || !r.result) r.ok = false;
    return r;
  }

  function lineEnd(text, i) { var n = text.indexOf("\n", i); return n < 0 ? text.length : n; }

  function segment(text, dates, mode) {
    var out = [];
    for (var i = 0; i < dates.length; i++) {
      var start, end, block;
      if (mode === "after") {
        // la date ouvre le bloc du match
        start = dates[i].end;
        end = i + 1 < dates.length ? dates[i + 1].i : Math.min(text.length, start + 400);
        block = text.slice(start, end);
        if (block.replace(/\s/g, "").length < 14) {
          var prevNl = text.lastIndexOf("\n", dates[i].i - 2);
          block = text.slice(Math.max(0, prevNl), dates[i].i) + " " + block;
        }
      } else {
        // la date ferme le bloc du match (ligne de la date incluse)
        start = i > 0 ? lineEnd(text, dates[i - 1].end) : Math.max(0, dates[i].i - 400);
        end = lineEnd(text, dates[i].end);
        block = text.slice(start, dates[i].i) + " " + text.slice(dates[i].end, end);
      }
      var r = parseBlock(block, dates[i].iso);
      if (r.oppRank || r.score || r.result) out.push(r);
    }
    return out;
  }

  function parse(text) {
    text = String(text || "").replace(/\r/g, "").replace(/\u00a0/g, " ");
    var dates = findDates(text);
    var a = segment(text, dates, "after"), b = segment(text, dates, "before");
    var score = function (l) { return l.filter(function (r) { return r.ok; }).length * 10 + l.filter(function (r) { return r.opp; }).length; };
    var out = score(b) > score(a) ? b : a;
    var seen = {};
    return out.filter(function (r) {
      var k = r.date + "|" + r.opp + "|" + r.score + "|" + r.oppRank;
      if (seen[k]) return false; seen[k] = 1; return true;
    });
  }

  // Favori à glisser dans la barre du navigateur : envoie le texte de la page Ten'Up à Montée
  function bookmarklet(origin) {
    var code = "(function(){var t=(document.body.innerText||'').slice(0,24000);" +
      "if(!/tenup|fft/i.test(location.host)){alert('Ouvre d\\u2019abord ton palmar\\u00e8s sur Ten\\u2019Up.');return;}" +
      "location.href='" + origin + "/#import='+encodeURIComponent(t);})()";
    return "javascript:" + encodeURIComponent(code).replace(/%2F/g, "/").replace(/%3A/g, ":").replace(/%3D/g, "=");
  }

  var api = { parse: parse, parseBlock: parseBlock, bookmarklet: bookmarklet };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MonteeParser = api;
})(this);
