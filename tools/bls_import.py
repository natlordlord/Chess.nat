"""Holt den Bundeslebensmittelschlüssel 4.0 (Max Rubner-Institut, blsdb.de) und schreibt daraus data/bls.json.

Quelle: Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank. Karlsruhe.
DOI 10.25826/Data20251217-134202-0. Kostenfrei, ausdrücklich auch für App-Entwicklung (blsdb.de/faq).

Es wird nichts gerechnet oder geschätzt: aus der amtlichen Excel-Datei werden je Lebensmittel nur die Spalten
Energie (kcal), Kohlenhydrate, Eiweiß, Fett, Ballaststoffe, Zucker, gesättigte Fettsäuren und Salz übernommen (pro 100 g).
Fehlt eine der vier Hauptangaben, bleibt das Lebensmittel draußen. Alles, was der Lauf sieht, steht in data/bls.log.
"""
import html as H, io, json, re, sys, time
import requests
from openpyxl import load_workbook

BASE = "https://blsdb.de"
LOG = []
def log(*a):
    s = " ".join(str(x) for x in a); LOG.append(s); print(s)
def done(code):
    open("data/bls.log", "w", encoding="utf-8").write("\n".join(LOG) + "\n"); sys.exit(code)

S = requests.Session(); S.headers["User-Agent"] = "ChessNat/1.0 (chess-nat.vercel.app; einmaliger Abruf der BLS-Daten)"
def get(u):
    r = S.get(u, timeout=120); log("GET", u.split("?")[0], r.status_code, r.headers.get("content-type"), len(r.content)); return r
def links(html, base):
    out = []
    for h in re.findall(r'(?:href|action)="([^"]+)"', html):
        h = H.unescape(h)
        if h.startswith(("#", "mailto:", "javascript:")): continue
        out.append(h if h.startswith("http") else BASE + (h if h.startswith("/") else "/" + h))
    return out

xlsx = None; seen = set(); todo = [BASE + "/search", BASE + "/", BASE + "/bls"]
for _ in range(25):
    if not todo or xlsx: break
    u = todo.pop(0)
    if u in seen: continue
    seen.add(u)
    try: r = get(u)
    except Exception as e: log("  fehlgeschlagen:", e); continue
    if r.content[:2] == b"PK" and len(r.content) > 500000:
        name = r.headers.get("content-disposition", "") + " " + u
        log("  Datei:", name[:200])
        if re.search(r"Daten", name, re.I) or len(r.content) > 3000000: xlsx = r.content; break
        continue
    if "html" not in (r.headers.get("content-type") or ""): continue
    cand = [l for l in links(r.text, u) if re.search(r"download|xlsx|csv|zip", l, re.I)]
    log("  Kandidaten:", [c.split("?")[0] for c in cand][:20])
    if "download" in u: log("  Seite:", re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", r.text))[:1500])
    for l in links(r.text, u):
        if "blsdb.de" not in l or l in seen: continue
        if re.search(r"Daten[^/]*\.xlsx", l, re.I): todo.insert(0, l)
        elif re.search(r"download", l, re.I): todo.insert(0, l) if ".xlsx" not in l else todo.append(l)
        elif l.lower().split("?")[0].endswith(".xlsx") and "mapping" not in l.lower(): todo.append(l)
    time.sleep(1)
if not xlsx: log("Keine Datendatei gefunden."); done(1)

wb = load_workbook(io.BytesIO(xlsx), read_only=True, data_only=True)
log("Blätter:", wb.sheetnames)
ws = max(wb.worksheets, key=lambda w: (w.max_row or 0))
rows = ws.iter_rows(values_only=True)
head = None; pre = []
for r in rows:
    cells = ["" if c is None else str(c).strip() for c in r]
    pre.append(cells[:12])
    if sum(1 for c in cells if c) > 50: head = cells; break
    if len(pre) > 15: break
log("Zeilen vor der Kopfzeile:", json.dumps(pre[:6], ensure_ascii=False)[:1500])
if not head: log("Keine Kopfzeile gefunden."); done(1)
log("Spalten:", len(head)); log("Kopf:", json.dumps(head, ensure_ascii=False))

WANT = {  # INFOODS-Kürzel zuerst, sonst der deutsche Name
    "k": (["ENERCC"], r"kilokalorien|\(kcal\)|\bkcal\b"),
    "c": (["CHO", "CHOAVL"], r"kohlenhydrate.*(verf|resorb)|^kohlenhydrate\b"),
    "p": (["PROT625", "PROT", "PROCNT"], r"^(protein|eiwei)"),
    "f": (["FAT", "FATCE"], r"^fett\b"),
    "fi": (["FIBT", "FIBTG"], r"ballaststoffe.*gesamt|^ballaststoffe\b"),
    "su": (["SUGAR", "SUGAR-"], r"zucker.*gesamt|^zucker\b"),
    "sf": (["FASAT"], r"ges.ttigte fetts|fetts.uren.*ges.ttigt"),
    "sa": (["NACL"], r"^salz|kochsalz|natriumchlorid"),
}
col = {}
for key, (tags, rx) in WANT.items():
    hit = [i for i, hd in enumerate(head) if re.split(r"[\s\[\(]", hd, 1)[0].upper() in tags]
    if not hit: hit = [i for i, hd in enumerate(head) if re.search(rx, hd, re.I) and not re.search(r"herkunft|referenz|quelle|source", hd, re.I)]
    log(key, "->", [(i, head[i]) for i in hit[:4]])
    if hit: col[key] = hit[0]
miss = [k for k in ("k", "c", "p", "f") if k not in col]
if miss: log("Pflichtspalten fehlen:", miss); done(1)

def num(v):
    if v is None or v == "": return None
    try: x = float(str(v).replace(",", "."))
    except ValueError: return None
    return x if x >= 0 else None
out = []; skipped = 0
for r in rows:
    if not r or not r[0]: continue
    code, name = str(r[0]).strip(), str(r[1] or "").strip()
    v = {k: num(r[i]) if i < len(r) else None for k, i in col.items()}
    if not name or any(v[k] is None for k in ("k", "c", "p", "f")) or v["k"] > 950 or max(v["c"], v["p"], v["f"]) > 100.5: skipped += 1; continue
    r1 = lambda x: None if x is None else round(x, 1)
    out.append([code, name, round(v["k"]), r1(v["c"]), r1(v["p"]), r1(v["f"]), r1(v.get("fi")), r1(v.get("su")), r1(v.get("sf")), r1(v.get("sa"))])
log("Lebensmittel:", len(out), "ausgelassen:", skipped)
log("Beispiele:", json.dumps(out[:3] + out[len(out) // 2: len(out) // 2 + 3], ensure_ascii=False))
if len(out) < 5000: log("Zu wenige Zeilen, nichts geschrieben."); done(1)
json.dump({"source": "Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank. Karlsruhe. DOI 10.25826/Data20251217-134202-0",
           "at": time.strftime("%Y-%m-%d"), "cols": ["code", "name", "kcal", "c", "p", "f", "fi", "su", "sf", "sa"], "foods": out},
          open("data/bls.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
done(0)
