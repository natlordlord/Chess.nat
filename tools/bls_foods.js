/* Schreibt data/foods_bls.js: für die Lebensmittel der festen Tabelle (data/foods.js) die Werte pro 100 g aus dem
   Bundeslebensmittelschlüssel 4.0 (data/bls.json, vom Max Rubner-Institut geholt mit tools/bls_import.py).
   Die Zahlen werden vom Programm kopiert, nicht abgetippt. Welches Lebensmittel welcher BLS-Eintrag ist, steht hier:
   nur wo der BLS genau dieses Lebensmittel führt. Markenartiges (Nutella, Pesto aus dem Glas, Proteinpulver, Tomatensauce)
   und was der BLS nicht einzeln führt (Orangensaft, Bier) bleibt beim Wert aus Open Food Facts.   node tools/bls_foods.js */
const fs = require("fs"), path = require("path");
const MAP = {pasta: "E401000", pasta_vk: "E510000", reis: "C352000", reis_vk: "C351000", couscous: "C119200", bulgur: "C119100", quinoa: "C118000",
  linsen: "H725100", kichererbsen: "G770400", bohnen: "H742100", haehnchen: "V416100", pute: "V486100", rind: "U131100", hack: "U050100", rinderhack: "U010100",
  kartoffeln: "K110132", suesskartoffel: "K420132", haferflocken: "C133000", brot: "B271000", vollkornbrot: "B101000", toast: "B314000", broetchen: "B511000",
  ei: "E111100", milch: "M111300", milch15: "M111200", butter: "Q611000", oel: "Q120000", gouda: "M402600", mozzarella: "M032100", parmesan: "M306400", feta: "M012200",
  quark: "M713100", skyr: "M710100", joghurt: "M141300", banane: "F503100", apfel: "F110100", tomate: "G561100", gurke: "G520100", paprika: "G543100", zwiebel: "G480100",
  avocado: "F502100", lachs: "T410100", thunfisch: "T121902", erdnussbutter: "H880200", honig: "S120000", zucker: "S111000", marmelade: "S132000", mandeln: "H210100",
  pommes: "X654042", cola: "N330000"};
const B = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/bls.json"), "utf8")), by = Object.fromEntries(B.foods.map(f => [f[0], f]));
const T = require("../data/foods.js"), out = {}, bad = [];
for (const [id, code] of Object.entries(MAP)){ const f = by[code]; if (!f || !T.byId[id]){ bad.push(id + ":" + code); continue; }
  const o = {code, name: f[1], k: f[2], c: f[3], p: f[4], f: f[5]}; if (f[6] != null) o.fi = f[6]; if (f[7] != null) o.su = f[7]; if (f[8] != null) o.sf = f[8]; out[id] = o; }
if (bad.length){ console.error("fehlt:", bad.join(", ")); process.exit(1); }
const js = `/* ERZEUGT von tools/bls_foods.js aus data/bls.json – nicht von Hand ändern.
   Quelle: ${B.source} (CC BY 4.0). Werte pro 100 g. */
(function(root){ const BLS = ${JSON.stringify(out)};
  if (typeof module !== "undefined" && module.exports) module.exports = BLS; else root.KCAL_BLS = BLS; })(typeof window !== "undefined" ? window : this);
`;
fs.writeFileSync(path.join(__dirname, "../data/foods_bls.js"), js);
console.log(Object.keys(out).length + " Lebensmittel");
for (const [id, o] of Object.entries(out)){ const t = T.byId[id]; console.log(id.padEnd(15), String(t.k).padStart(4), "→", String(o.k).padStart(4), " ", o.name); }
