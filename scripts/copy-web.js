// Copie l'app web (dossier web/) dans www/, que Capacitor embarque dans l'app.
const fs = require("fs"), path = require("path");
const src = path.join(__dirname, "../web"), dst = path.join(__dirname, "../www");
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log("App web copiée dans www/");
