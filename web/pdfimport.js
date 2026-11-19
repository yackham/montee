/* Montée — import d'une page Ten'Up enregistrée en PDF (capture « page entière » de Safari,
   ou « Imprimer › Enregistrer en PDF »). Lecture du texte du PDF dans le navigateur avec pdf.js :
   pas d'IA, pas de serveur. Pages reconnues : « Simulation de classement » (la plus complète :
   adversaires, classements, victoires/défaites, points) et « Palmarès ». */
(function (root) {
  "use strict";

  var RANK = "(NC|N°\\s?\\d{1,3}|-?\\d{1,2}\\/\\d|-?15|30|40|0)";
  var MOIS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };

  function strip(s) { return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function pad(n) { return ("0" + n).slice(-2); }
  function frDate(s) {
    s = String(s || "").trim();
    var m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return m[3] + "-" + pad(m[2]) + "-" + pad(m[1]);
    m = strip(s.toLowerCase()).match(/(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})/);
    if (m && MOIS[m[2]]) return m[3] + "-" + pad(MOIS[m[2]]) + "-" + pad(m[1]);
    return "";
  }

  // ---- Extraction du texte, ligne par ligne (pdf.js chargé à la demande) ----
  var loading = null;
  function loadPdfJs() {
    if (root.pdfjsLib) return Promise.resolve(root.pdfjsLib);
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = "vendor/pdf.min.js";
      s.onload = function () { root.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js"; res(root.pdfjsLib); };
      s.onerror = function () { loading = null; rej(new Error("pdfjs")); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function linesFromFile(file) {
    return loadPdfJs().then(function (lib) { return file.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf, isEvalSupported: false }).promise; }); })
      .then(function (pdf) {
        var pages = [];
        for (var i = 1; i <= pdf.numPages; i++) pages.push(pdf.getPage(i).then(function (pg) { return pg.getTextContent(); }));
        return Promise.all(pages);
      })
      .then(function (contents) {
        var out = [];
        contents.forEach(function (tc) {
          var items = tc.items.filter(function (it) { return it.str && it.str.trim(); }).map(function (it) {
            return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 };
          });
          items.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
          var rows = [];
          items.forEach(function (it) {
            var r = rows.length ? rows[rows.length - 1] : null;
            if (r && Math.abs(r.y - it.y) <= 3) r.items.push(it); else rows.push({ y: it.y, items: [it] });
          });
          rows.forEach(function (r) {
            r.items.sort(function (a, b) { return a.x - b.x; });
            var line = "", prevEnd = null;
            r.items.forEach(function (it) {
              if (prevEnd != null) line += it.x - prevEnd > 8 ? "\t" : (/\s$/.test(line) || /^\s/.test(it.s) ? "" : " ");
              line += it.s; prevEnd = it.x + it.w;
            });
            out.push(line.replace(/[  ]+/g, " ").trim());
          });
        });
        return out.filter(Boolean);
      });
  }

  // 3.46.4 : les éléments bruts (texte + position + rotation), pour les feuilles de poule en paysage
  function itemsFromFile(file) {
    return loadPdfJs().then(function (lib) { return file.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf, isEvalSupported: false }).promise; }); })
      .then(function (pdf) { var pages = []; for (var i = 1; i <= pdf.numPages; i++) pages.push(pdf.getPage(i).then(function (pg) { return pg.getTextContent(); })); return Promise.all(pages); })
      .then(function (contents) {
        var out = [];
        contents.forEach(function (tc, pi) { tc.items.forEach(function (it) { if (it.str && it.str.trim()) out.push({ p: pi, s: it.str.trim(), x: it.transform[4], y: it.transform[5], a: it.transform[0], b: it.transform[1] }); }); });
        return out;
      });
  }

  // ---- Lecture des pages Ten'Up ----
  function parse(lines) {
    var text = lines.join("\n"), flat = text.replace(/\s+/g, " ");
    var r = { kind: null, profile: {}, month: "", period: null, official: null, rows: [], summary: null };

    // Profil
    for (var i = 0; i < lines.length; i++) {
      var lm = lines[i].match(/^(\d{6,8}\s?[A-Z])\s*\((\d{4})\)/);
      if (lm) { r.profile.licence = lm[1].replace(/\s/g, ""); if (i > 0) r.profile.name = lines[i - 1].replace(/\t.*/, "").trim(); break; }
    }
    for (var k = 0; k < lines.length; k++) {
      if (/^TENNIS\b/.test(lines[k]) && lines[k + 1]) {
        var t = lines[k + 1].split(/\t|\s{2,}/)[0].trim();
        if (new RegExp("^" + RANK + "$").test(t)) r.profile.rank = t.replace(/\s/g, "");
        break;
      }
    }
    var best = flat.match(/Meilleur classement\s*:\s*(\S+)/); if (best) r.profile.best = best[1];
    var mo = flat.match(/classement de (\w+ \d{4})/i); if (mo) r.month = mo[1];
    var per = flat.match(/entre le (.+?) et le (.+?\d{4})/);
    if (per) r.period = { from: frDate(per[1]), to: frDate(per[2]) };

    // Simulation : chiffres officiels
    var pts = flat.match(/(\d+)\s*points? cumulés? au bilan de\s*(\S+?)\.?\s/i);
    var need = flat.match(/(\d+)\s*points? sont nécessaires/i);
    var cnt = flat.match(/Victoires comptabilisées\s*(\d+)\s*(?:\+\s*(\d+))?/i);
    var calc = null;
    for (var c = 0; c < lines.length; c++) {
      if (/Classement actuel/i.test(lines[c]) && /Classement calcul/i.test(lines[c]) && lines[c + 1]) {
        var two = lines[c + 1].split(/\t|\s+/).filter(Boolean);
        calc = { current: two[0], calculated: two[1] || two[0] }; break;
      }
    }
    if (pts || calc) {
      r.official = {
        pts: pts ? +pts[1] : null, at: pts ? pts[2].replace(/\.$/, "") : (calc && calc.calculated),
        needed: need ? +need[1] : null, counted: cnt ? +cnt[1] + (cnt[2] ? +cnt[2] : 0) : null, bonusWins: cnt && cnt[2] ? +cnt[2] : 0,
        current: calc && calc.current, calculated: calc && calc.calculated
      };
    }
    var nb = flat.match(/Victoires\s+(\d+)\s+Défaites\s+(\d+)/i);
    if (nb) r.summary = { V: +nb[1], D: +nb[2] };
    else { nb = flat.match(/(\d+)\s+victoires\s+(\d+)\s+défaites/i); if (nb) r.summary = { V: +nb[1], D: +nb[2] }; }

    // Lignes de matchs
    var reSim = new RegExp("^(.+?)\\s+" + RANK + "\\s+(V|D)\\s+(\\d+|-)\\s*$");
    var rePal = new RegExp("^(.+?)\\s+((?:19|20)\\d{2})\\s+" + RANK + "(?:\\s+(\\d{2}\\/\\d{2}\\/\\d{4}))?(?:\\s+(\\d{2}\\/\\d{2}\\/\\d{4}))?\\s*$");
    // On ne garde que le premier tableau de matchs (la page peut en contenir d'autres plus bas)
    var started = false, ended = false;
    lines.forEach(function (ln) {
      if (ended) return;
      var l = ln.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
      if (/^Adversaire\b/i.test(l)) return;
      var m = l.match(reSim);
      if (m) { started = true; r.rows.push({ opp: m[1].trim(), oppRank: m[2].replace(/\s/g, ""), result: m[3], pts: m[4] === "-" ? null : +m[4] }); return; }
      m = l.match(rePal);
      if (m) { started = true; r.rows.push({ opp: m[1].trim(), birth: +m[2], oppRank: m[3].replace(/\s/g, ""), date: m[4] ? frDate(m[4]) : "" }); return; }
      if (started) ended = true;
    });
    var withResult = r.rows.filter(function (x) { return x.result; }).length;
    r.kind = withResult ? "simulation" : r.rows.length ? "palmares" : null;
    if (r.kind === "simulation") r.rows = r.rows.filter(function (x) { return x.result; });
    return r;
  }

  var api = { linesFromFile: linesFromFile, itemsFromFile: itemsFromFile, parse: parse, frDate: frDate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MonteePdf = api;
})(this);
