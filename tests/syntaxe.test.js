// Montée : le code web se charge sans erreur de syntaxe (app.js fait plus de 2 Mo : une virgule de trop casse tout)
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const W = path.join(__dirname, "..", "web");
for (const f of ["app.js", "engine.js", "summary.js", "tenup.js", "sw.js", "play.js"]) {
  test("syntaxe " + f, () => { assert.doesNotThrow(() => new Function(fs.readFileSync(path.join(W, f), "utf8"))); });
}
test("même version dans app.js, sw.js, Android et iOS", () => {
  const v = fs.readFileSync(path.join(W, "app.js"), "utf8").match(/VERSION: "([\d.]+)"/)[1];
  assert.ok(fs.readFileSync(path.join(W, "sw.js"), "utf8").includes(v), "sw.js");
  assert.ok(fs.readFileSync(path.join(W, "..", "android/app/build.gradle"), "utf8").includes('"' + v + '"'), "build.gradle");
  const pb = fs.readFileSync(path.join(W, "..", "ios/App/App.xcodeproj/project.pbxproj"), "utf8").match(/MARKETING_VERSION = ([\d.]+);/g) || [];
  assert.ok(pb.length && pb.every((x) => x.includes(v)), "project.pbxproj");
});
