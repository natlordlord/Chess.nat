/* Chess.nat Kalorien-Tracker: the fixed table of everyday foods. One file for the phone (window.KCAL_FOODS) and for the
   server function api/kcal.js (require), so both always use the same numbers.

   Why: the AI only works out WHAT was eaten and HOW MUCH. For a food in this table the values per 100 g come from here,
   so "gekochte Nudeln" is the same for everyone, every time.

   Fields: id · n = name · al = how people call it (regular expression, used by the search) · values per 100 g:
   k kcal, c carbohydrates, p protein, f fat, fi fibre, su sugar, sf saturated fat · q = quality 1–5 (5 = best).
   Foods that change their weight when cooked have the values of the DRY or RAW food and
     cf   = how many grams it weighs cooked per gram dry/raw (noodles 2.3: 100 g dry become 230 g cooked)
     st   = [name of the dry/raw state, name of the cooked state]
     scan = which products from the barcode scan or the search are this food (the pack is always dry/raw weight)
     not  = names that look like it but aren't · kr = plausible kcal per 100 g on such a pack
   The cooked values are never stored: they are the dry values divided by cf, so both ways of weighing give the same result.
   Sources: Bundeslebensmittelschlüssel / USDA FoodData Central, typical supermarket products; cooking factors are kitchen averages. */
(function(root){
  const F = (id, n, al, k, c, p, f, fi, su, sf, q, more) => Object.assign({id, n, al, k, c, p, f, fi, su, sf, q}, more || {});
  const DRY = ["trocken", "gekocht"], RAW = ["roh", "gebraten"], NOPE = "waffel|drink|milch|mehl|pudding|flocken|chips|cracker|riegel|sirup|essig|papier|salat|suppe|instant|ramen|cup|fertig|pfanne|bolognese|carbonara|sauce|soße|auflauf|gericht|express|vorgekocht|mikrowelle|minute|dose|glas|konserve|aufstrich|bratling|burger";
  const FOODS = [
    /* dry goods that soak up water */
    F("pasta", "Nudeln", "nudeln?|pasta|spaghetti|penne|fusilli|farfalle|rigatoni|tagliatelle|makkaroni|maccheroni|spirelli|linguine|bandnudeln|hörnchennudeln", 359, 71, 12.5, 1.5, 3, 3, .3, 3, {cf: 2.3, st: DRY, scan: "nudel|pasta|spaghetti|penne|fusilli|farfalle|rigatoni|tagliatelle|makkaroni|maccheroni|spirelli|linguine|tortiglioni|girandole|conchiglie|orecchiette", not: NOPE + "|vollkorn|linsen|kichererbsen|protein|frisch|gefüllt|tortell|ravioli|gnocchi|schupf|spätzle", kr: [320, 400]}),
    F("pasta_vk", "Vollkornnudeln", "vollkorn(nudeln?|pasta|spaghetti|penne|fusilli)|dinkelnudeln?", 348, 62, 13.5, 2.5, 8, 3, .5, 4, {cf: 2.3, st: DRY, scan: "vollkorn.*(nudel|pasta|spaghetti|penne|fusilli|spirelli)|(nudel|pasta|spaghetti|penne|fusilli|spirelli).*vollkorn", not: NOPE + "|frisch|gefüllt", kr: [310, 390]}),
    F("reis", "Reis", "reis|basmati(reis)?|jasminreis|langkornreis|parboiled|risottoreis|duftreis", 351, 78, 7, .6, 1.4, .2, .2, 3, {cf: 2.8, st: DRY, scan: "reis\\b|basmati|jasmin|langkorn|parboiled|risotto|arborio|sushi.?reis|duftreis", not: NOPE + "|natur|vollkorn|wild|braun", kr: [320, 380]}),
    F("reis_vk", "Naturreis", "naturreis|vollkornreis|brauner reis", 353, 73, 7.5, 2.7, 3.5, .7, .6, 4, {cf: 2.8, st: DRY, scan: "naturreis|vollkorn.?reis|brauner reis|braunreis", not: NOPE, kr: [320, 390]}),
    F("couscous", "Couscous", "couscous|kuskus", 356, 70, 12, 1.8, 5, 2, .3, 3, {cf: 2.6, st: DRY, scan: "couscous|kuskus", not: NOPE, kr: [320, 390]}),
    F("bulgur", "Bulgur", "bulgur", 342, 63, 12, 1.5, 12, .8, .2, 4, {cf: 2.9, st: DRY, scan: "bulgur", not: NOPE, kr: [310, 380]}),
    F("quinoa", "Quinoa", "quinoa", 368, 62, 14, 6, 7, 1.6, .7, 5, {cf: 2.9, st: DRY, scan: "quinoa", not: NOPE + "|gepufft|pops", kr: [330, 400]}),
    F("linsen", "Linsen", "linsen|tellerlinsen|berglinsen|rote linsen|belugalinsen", 325, 45, 24, 1.5, 14, 1.5, .2, 5, {cf: 2.7, st: DRY, scan: "linsen", not: NOPE + "|nudel|pasta|penne|fusilli", kr: [290, 380]}),
    F("kichererbsen", "Kichererbsen", "kichererbsen", 345, 45, 20, 6, 16, 3, .7, 5, {cf: 2.2, st: DRY, scan: "kichererbsen", not: NOPE + "|nudel|pasta|geröstet", kr: [310, 400]}),
    F("bohnen", "Bohnen (Kidney, weiße)", "kidneybohnen|weiße bohnen|schwarze bohnen|bohnen", 310, 42, 22, 1.5, 18, 2, .3, 5, {cf: 2.5, st: DRY, scan: "kidney.?bohnen|weiße bohnen|schwarze bohnen|bohnenkerne", not: NOPE + "|grün|kaffee", kr: [280, 380]}),
    /* meat loses water in the pan */
    F("haehnchen", "Hähnchenbrust", "hähnchen(brust(filet)?)?|hühnchen(brust)?|hähnchenfilet|chicken", 106, 0, 23.5, 1.5, 0, 0, .4, 5, {cf: .75, st: RAW, scan: "hähnchen.?(brust|filet|innenfilet)|hühnchen.?(brust|filet)|chicken breast", not: "paniert|gebraten|gegart|geräuchert|aufschnitt|salat|nugget|schnitzel|wurst|döner|gyros|mariniert|fertig|streifen gebr", kr: [90, 130]}),
    F("pute", "Putenbrust", "pute(nbrust)?|putenfilet|putenschnitzel|truthahn", 105, 0, 24, 1, 0, 0, .3, 5, {cf: .75, st: RAW, scan: "puten.?(brust|filet|schnitzel|medaillon)", not: "paniert|gebraten|gegart|geräuchert|aufschnitt|salat|wurst|mariniert|fertig", kr: [90, 130]}),
    F("rind", "Rindersteak", "rindersteak|rumpsteak|rinderfilet|hüftsteak|steak", 125, 0, 21.5, 4.2, 0, 0, 1.8, 4, {cf: .75, st: RAW, scan: "rinder.?(steak|filet|hüfte)|rumpsteak|hüftsteak|entrecote|roastbeef roh", not: "gebraten|gegart|aufschnitt|mariniert|fertig", kr: [105, 200]}),
    F("hack", "Hackfleisch gemischt", "hackfleisch|gehacktes|hack", 250, 0, 18, 20, 0, 0, 8, 2, {cf: .75, st: RAW, scan: "hackfleisch gemischt|gemischtes hack|hackfleisch halb", not: "bällchen|frikadelle|burger|gebraten|fertig|vegan|veggie", kr: [220, 290]}),
    F("rinderhack", "Rinderhackfleisch", "rinderhack(fleisch)?|tatar", 220, 0, 20, 15.5, 0, 0, 6.5, 3, {cf: .75, st: RAW, scan: "rinder.?hack", not: "bällchen|frikadelle|burger|patty|gebraten|fertig|vegan|veggie", kr: [120, 260]}),
    /* eaten as they are */
    F("kartoffeln", "Kartoffeln, gekocht", "kartoffeln?|pellkartoffeln?|salzkartoffeln?", 73, 15.5, 1.9, .1, 1.6, .8, 0, 5),
    F("suesskartoffel", "Süßkartoffel, gegart", "süßkartoffeln?", 86, 20, 1.6, .1, 3, 4.2, 0, 5),
    F("haferflocken", "Haferflocken", "haferflocken|hafer", 372, 58.7, 13.5, 7, 10, 1, 1.3, 5),
    F("brot", "Brot (Mischbrot)", "brot|mischbrot|graubrot|bauernbrot|roggenbrot", 240, 46, 7.5, 1.5, 5, 3, .3, 3),
    F("vollkornbrot", "Vollkornbrot", "vollkornbrot|körnerbrot|schwarzbrot|eiweißbrot", 215, 38, 7.5, 1.5, 8, 3, .3, 4),
    F("toast", "Toastbrot", "toast(brot)?", 265, 48, 8, 3.8, 3, 4, .5, 2),
    F("broetchen", "Brötchen", "brötchen|semmel|schrippe|weck", 277, 55, 9, 1.8, 3, 2, .4, 3),
    F("ei", "Ei", "ei|eier|rührei|spiegelei|gekochtes ei", 145, .7, 12.5, 10.3, 0, .7, 3.1, 4),
    F("milch", "Vollmilch 3,5 %", "milch|vollmilch", 64, 4.8, 3.3, 3.5, 0, 4.8, 2.3, 4),
    F("milch15", "Milch 1,5 %", "fettarme milch|milch 1,5", 47, 4.9, 3.4, 1.5, 0, 4.9, 1, 4),
    F("butter", "Butter", "butter", 741, .6, .7, 82, 0, .6, 54, 2),
    F("oel", "Olivenöl / Speiseöl", "olivenöl|öl|rapsöl|sonnenblumenöl", 884, 0, 0, 100, 0, 0, 14, 3),
    F("pesto", "Pesto (grün, Glas)", "pesto|basilikumpesto|pesto genovese", 490, 6.5, 5, 49, 2, 3.5, 7, 2),
    F("tomatensauce", "Tomatensauce", "tomatensauce|tomatensoße|passierte tomaten|napoli", 45, 6.5, 1.5, 1.2, 1.5, 5, .2, 4),
    F("gouda", "Gouda / Schnittkäse", "gouda|käse|schnittkäse|edamer|emmentaler", 356, 0, 25, 28.5, 0, 0, 19, 3),
    F("mozzarella", "Mozzarella", "mozzarella", 250, 1.5, 18, 19, 0, 1, 13, 3),
    F("parmesan", "Parmesan", "parmesan|grana padano", 400, 0, 35, 29, 0, 0, 19, 3),
    F("feta", "Feta", "feta|hirtenkäse|schafskäse", 265, 1, 17, 21.5, 0, 1, 15, 3),
    F("quark", "Magerquark", "magerquark|quark", 67, 4, 12, .3, 0, 4, .2, 5),
    F("skyr", "Skyr natur", "skyr", 63, 4, 11, .2, 0, 4, .1, 5),
    F("joghurt", "Naturjoghurt 3,5 %", "joghurt|naturjoghurt", 62, 4.5, 3.5, 3.5, 0, 4.5, 2.3, 4),
    F("banane", "Banane", "bananen?", 93, 20, 1.1, .3, 2, 17, .1, 5),
    F("apfel", "Apfel", "apfel|äpfel", 54, 11.5, .3, .2, 2, 10.5, 0, 5),
    F("tomate", "Tomate", "tomaten?", 18, 2.6, 1, .2, 1.2, 2.6, 0, 5),
    F("gurke", "Gurke", "gurken?|salatgurke", 13, 1.8, .6, .2, .5, 1.7, 0, 5),
    F("paprika", "Paprika", "paprika", 30, 5, 1, .3, 2, 4.5, 0, 5),
    F("zwiebel", "Zwiebel", "zwiebeln?", 30, 5, 1.2, .2, 1.8, 4.5, 0, 5),
    F("avocado", "Avocado", "avocados?", 160, 1.8, 2, 15.5, 6.7, .7, 2.2, 5),
    F("lachs", "Lachs", "lachs|lachsfilet", 200, 0, 20, 13.5, 0, 0, 2.6, 5),
    F("thunfisch", "Thunfisch (Dose, eigener Saft)", "thunfisch", 108, 0, 24.5, 1, 0, 0, .3, 5),
    F("nutella", "Nutella", "nutella|nuss.?nougat.?creme", 539, 57.5, 6.3, 30.9, 0, 56.3, 10.6, 1),
    F("erdnussbutter", "Erdnussbutter", "erdnussbutter|erdnussmus", 600, 12, 25, 50, 8, 6, 8, 3),
    F("honig", "Honig", "honig", 304, 75, .4, 0, 0, 75, 0, 2),
    F("zucker", "Zucker", "zucker", 400, 100, 0, 0, 0, 100, 0, 1),
    F("marmelade", "Marmelade", "marmelade|konfitüre", 250, 60, .4, .1, 1, 58, 0, 1),
    F("mandeln", "Mandeln", "mandeln", 590, 5.5, 21, 52, 12, 4.5, 4, 5),
    F("pommes", "Pommes frites", "pommes|pommes frites|fritten", 290, 36, 3.5, 14, 3.5, .5, 2, 1),
    F("whey", "Proteinpulver (Whey)", "proteinpulver|whey|eiweißpulver", 380, 6, 78, 5, 0, 5, 3, 4),
    F("cola", "Cola / Limonade", "cola|limo(nade)?|fanta|sprite", 42, 10.6, 0, 0, 0, 10.6, 0, 1),
    F("osaft", "Orangensaft", "orangensaft|o-saft|osaft", 43, 9, .7, .2, .2, 9, 0, 3),
    F("bier", "Bier", "bier|pils|helles|weizenbier", 42, 3, .5, 0, 0, 0, 0, 1)
  ];
  /* the values of a food in the state it was weighed in: per 100 g cooked = per 100 g dry ÷ cf */
  const per100 = (f, cooked) => { const d = f.cf && cooked ? f.cf : 1, r = v => Math.round(v / d * 10) / 10; return {k: r(f.k), c: r(f.c), p: r(f.p), f: r(f.f), fi: r(f.fi), su: r(f.su), sf: r(f.sf), q: f.q}; };
  const api = {list: FOODS, byId: Object.fromEntries(FOODS.map(f => [f.id, f])), per100};
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.KCAL_FOODS = api;
})(typeof window !== "undefined" ? window : this);
