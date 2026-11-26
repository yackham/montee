// Garde-fou « plus aucun contour sur les boutons » (Yann, 24/11 puis 26/11/2026).
// Un bouton, une tuile, une puce ou un choix sélectionné se montre par un fond doux teinté, jamais par un trait ou un anneau.
// Ce test relit styles.css : toute NOUVELLE règle qui pose une bordure ou un anneau (box-shadow 0 0 0 Npx) sur un élément
// de ce genre échoue. Les anciennes règles listées ci-dessous sont neutralisées par le bloc commun de fin de styles.css
// (ou sont des exceptions qui ne sont pas des boutons : cases à cocher, carrés « défaite », pastilles de couleur).
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const CSS = fs.readFileSync(path.join(__dirname, "../web/styles.css"), "utf8");
const MARK = "/* 4.19.3 (Yann, 24/11 puis 26/11";
const BTN = /btn|button|pill|tile|chip|\.on(?![\w-])|\.hot(?![\w-])|cta|-opt(?![\w-])|tier|\.tag(?![\w-])/;
const RING = /box-shadow:[^;}]*\b0 0 0 [0-9.]+px (?!var\(--(bg|card)\))/;
const BORDER = /(?:^|[;{\s])border(?:-color)?\s*:\s*(?![\s]|0\b|none|transparent|var\(--(?:bg|card)\))[^;}]*/;
// Toutes les classes posées sur un <button> dans app.js comptent aussi comme des boutons
const APP = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
const BCLS = new Set(); (APP.match(/<button class=\\?["']([\w -]+)/g) || []).forEach(x => x.replace(/^<button class=\\?["']/, "").split(/\s+/).forEach(c => c && c.length > 2 && !/^(card|row|small|soft|wide|grow|sheet|hero|balle|done|add|half|lead)$/.test(c) && BCLS.add(c)));
const isBtn = s => BTN.test(s) || (s.match(/\.[\w-]+/g) || []).some(c => BCLS.has(c.slice(1)));
function offenders(css) {
  const out = new Set(); css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) {
    const body = m[2];
    const bad = RING.test(body) || (BORDER.test(" " + body) && !/border:\s*[0-9.]+px\s+solid\s+transparent/.test(body));
    if (!bad) continue;
    m[1].split(",").map(s => s.trim().replace(/\s+/g, " ")).filter(isBtn).forEach(s => out.add(s));
  }
  return out;
}
// Règles d'avant 4.19.1, toutes neutralisées en fin de fichier ou hors boutons. NE PAS ALLONGER cette liste :
// un nouveau bouton se fait sans contour dès le départ.
const CONNUES = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, "sans-contour.connues.json"), "utf8")));

test("le bloc commun « plus aucun contour » est bien en fin de styles.css", () => {
  const i = CSS.indexOf(MARK); assert.ok(i > 0, "bloc 4.19.3 absent");
  assert.ok(CSS.length - i < 8000, "le bloc commun doit rester en fin de fichier (il gagne sur les règles d'avant)");
});

test("aucun nouveau contour sur un bouton, une tuile ou une puce", () => {
  const avant = CSS.slice(0, CSS.indexOf(MARK));
  const nouveaux = [...offenders(avant)].filter(s => !CONNUES.has(s));
  assert.deepStrictEqual(nouveaux, [], "Contour interdit : passe par un fond doux teinté (color-mix(in srgb, <couleur> 16%, var(--card)))");
});

test("le bouton secondaire d'Ace (« Préparer le match ») n'a plus de trait", () => {
  const fin = CSS.slice(CSS.indexOf(MARK));
  assert.match(fin, /\.acd-btn \{ border: 0 !important; box-shadow: none !important;/);
  assert.match(fin, /\.ace-tile\.hot[^{]*\{ border-color: transparent !important; box-shadow: none !important;/);
});

module.exports = { offenders };
