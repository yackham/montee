// Garde-fou « pas de zoom intempestif » (audit qualité du 27/11/2026) : sur iPhone, un champ écrit sous 16 px fait zoomer
// toute la page, qui reste décalée. Ce test relit styles.css et app.js : aucun champ (input, textarea, select, ou classe posée
// sur un champ) ne doit descendre sous 16 px.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const CSS = fs.readFileSync(path.join(__dirname, "../web/styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const APP = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
const FIELD_CLS = new Set();
(APP.match(/<(?:input|textarea|select)[^>]*?class=\\?["']([\w -]+)/g) || []).forEach(x => x.replace(/.*class=\\?["']/, "").split(/\s+/).forEach(c => c && FIELD_CLS.add(c)));
const size = body => { const m = body.match(/font-size:\s*([0-9.]+)px/) || body.match(/(?:^|;)\s*font:\s*[^;]*?([0-9.]+)px/); return m ? +m[1] : null; };

test("aucune règle de style ne met un champ sous 16 px", () => {
  const bad = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const v = size(m[2]); if (v == null || v >= 16) continue;
    m[1].split(",").map(s => s.trim()).forEach(s => {
      if (/checkbox|radio|range|::placeholder|label/.test(s)) return;
      const last = s.split(/[\s>+~]+/).pop();
      if (/^(input|textarea|select)\b/.test(last) || (last.match(/\.[\w-]+/g) || []).some(c => FIELD_CLS.has(c.slice(1)) && c !== ".input")) bad.push(s + " → " + v + " px");
    });
  }
  assert.deepStrictEqual(bad, [], "Champ sous 16 px : l'iPhone zoome");
});

test("aucun champ n'a une taille écrite sous 16 px dans app.js", () => {
  const bad = (APP.match(/<(?:input|textarea|select)[^>]{0,400}?font-size:\s*(?:[0-9]|1[0-5])(?:\.\d+)?px/g) || []);
  assert.deepStrictEqual(bad, []);
});
