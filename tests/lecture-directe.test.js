// 4.24.1 : lecture directe de Ten'Up en arrière-plan (iPhone) : le script de fond tourne dans un moteur JavaScript nu
// (comme JSContext), avec les seuls remplaçants déclarés dans AppDelegate.swift (NativeTenup.poly).
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path"), vm = require("vm");
const R = path.join(__dirname, "..");
const poly = fs.readFileSync(path.join(R, "ios/App/App/AppDelegate.swift"), "utf8").split('static let poly = """')[1].split('    """')[0];
const c0 = { console }; c0.window = c0; c0.self = c0; vm.createContext(c0);
for (const f of ["engine.js", "tenup.js"]) vm.runInContext(fs.readFileSync(path.join(R, "web", f), "utf8"), c0);

function run(fol, ls) {
  return new Promise((resolve) => {
    const script = c0.MonteeTenup.nativeScriptBg("1234567A", "42", null, fol);
    const ctx = {}; vm.createContext(ctx); const urls = [];
    ctx.__nfetch = (url, m, h, b, id) => { urls.push(m + " " + url); setImmediate(() => {
      let tx = "{}";
      if (/palmares\/tennis/.test(url)) tx = JSON.stringify({ matchs: [{ date: "2026-11-20", victoireUtilisateur: true, adversaires: [{ prenom: "Thomas", nom: "MARTIN", classementLibelle: "15/2" }], sets: [] }] });
      if (/profil-joueur/.test(url)) tx = JSON.stringify({ prenom: "Julien", nom: "MOREAU", numeroLicence: "1234567A", classementTennis: { dernierClassement: { libelle: "15/1" } } });
      vm.runInContext("__nres", ctx)(id, 200, tx);
    }); };
    ctx.__ntimer = (id, ms) => setTimeout(() => vm.runInContext("__tfire", ctx)(id), Math.min(ms, 20));
    ctx.__ndone = (t) => resolve({ t, urls });
    ctx.__lsget = (k) => (k in ls ? ls[k] : null); ctx.__lsset = (k, v) => { ls[k] = v; };
    vm.runInContext(poly, ctx);
    vm.runInContext("(async function () {\n" + script + "\n})().then(function (r) { __ndone(String(r)); }, function (e) { __ndone(\"MONTEE-ERR \" + String(e && e.message || e)); });", ctx);
  });
}

test("ton palmarès se lit sans page Ten'Up", async () => {
  const { t, urls } = await run([], {});
  assert.match(t, /^MONTEE1/);
  assert.ok(urls.every((u) => u.indexOf("https://tenup.fft.fr/") > 0));
  assert.equal(JSON.parse(t.slice(7)).profil.classement, "15/1");
});

test("les joueurs suivis se lisent sans page Ten'Up", async () => {
  const { t } = await run([{ id: "7", hit: { id: "7" }, w: 1 }], { montee_bg_own: String(Date.now()) });
  assert.match(t, /^MONTEE1/);
  const o = JSON.parse(t.slice(7));
  assert.equal(o.folOnly, true);
  assert.equal(o.fol[0].id, "7");
});
