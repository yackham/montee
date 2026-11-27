// File des lectures Ten'Up (4.22.1, Yann 27/11) : une seule lecture à la fois, et celle que tu demandes passe devant les lectures de fond.
// On relit le vrai code de app.js (de « var TQ_Q » à la fin de tenupSerial) et on le fait tourner avec des lectures simulées.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const APP = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
const a = APP.indexOf("  var TQ_Q = ["), b = APP.indexOf("  function tenupQuery(kind, args)");
const SRC = APP.slice(a, b);
function load() {
  const listeners = {};
  const document = { addEventListener: (k, f) => { listeners[k] = f; } };
  const api = new Function("document", SRC + "; return { tenupSerial, tqUser, Q: () => TQ_Q };")(document);
  api.tap = () => listeners.click();
  return api;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

test("une seule lecture à la fois, dans l'ordre", async () => {
  const T = load(), log = []; let running = 0, max = 0;
  const job = n => () => { running++; max = Math.max(max, running); log.push(n); return wait(20).then(() => { running--; return n; }); };
  const r = await Promise.all([T.tenupSerial(job(1), false), T.tenupSerial(job(2), false), T.tenupSerial(job(3), false)]);
  assert.deepStrictEqual(r, [1, 2, 3]); assert.deepStrictEqual(log, [1, 2, 3]); assert.strictEqual(max, 1);
});

test("ta lecture passe devant les lectures de fond déjà en file", async () => {
  const T = load(), log = [];
  const job = n => () => { log.push(n); return wait(15); };
  const ps = [T.tenupSerial(job("fond1"), false), T.tenupSerial(job("fond2"), false), T.tenupSerial(job("fond3"), false)];
  ps.push(T.tenupSerial(job("toi"), true));
  await Promise.all(ps);
  assert.deepStrictEqual(log, ["fond1", "toi", "fond2", "fond3"]); // fond1 était déjà partie : elle finit, puis la tienne
});

test("un toucher récent rend la lecture prioritaire ; une erreur ne bloque pas la file", async () => {
  const T = load(), log = [];
  const ps = [T.tenupSerial(() => { log.push("a"); return wait(10).then(() => { throw new Error("x"); }); }, false), T.tenupSerial(() => { log.push("b"); return wait(5); }, false)];
  T.tap(); assert.ok(T.tqUser());
  ps.push(T.tenupSerial(() => { log.push("tap"); return wait(5); }));
  await Promise.allSettled(ps);
  assert.deepStrictEqual(log, ["a", "tap", "b"]);
  await assert.rejects(ps[0]);
});
