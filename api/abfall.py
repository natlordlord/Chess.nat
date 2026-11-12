"""Chess.nat Haushalt: bin collection dates for the German regions api/muell.js has no connector of its own for.

It runs the German connectors of the open-source project hacs_waste_collection_schedule (MIT licence, copied to wcs/, see
wcs/README.md): about 840 regions and towns in 150 modules. For an address it picks the entries whose name fits the town or
district (wcs/de.json), fills each connector's parameters from the address by their names (street/strasse, hnr/house_number,
city/ort/municipality, ...), and when a connector answers "not found, did you mean ...", takes the suggestion that fits.

GET /api/abfall?street=&hnr=&plz=&city=&district=&county=&state=&alt=
    -> {"termine": [{"d": "2026-11-13", "was": ["Restmüll"], "zusatz": ""}], "via": "module:title"}   from today on
    -> {"error": "unsupported" | "street" | "empty"}

The connectors are other people's code: before any of it is loaded, every environment variable that is not needed to run is
removed, so the project's keys are not visible to it.
"""
import os

# what the platform itself sets stays (the runtime needs some of it), minus everything that looks like a credential;
# everything the project added (its keys) goes
_KEEP = ("AWS_", "LAMBDA_", "VERCEL", "NOW_", "PATH", "PYTHON", "LANG", "LC_", "TZ", "HOME", "TMPDIR", "LD_", "_", "PWD", "SHLVL", "NODE_")
for _k in list(os.environ):
    if not _k.startswith(_KEEP) or any(w in _k.upper() for w in ("TOKEN", "SECRET", "KEY", "PASSW", "CREDENTIAL", "BYPASS")):
        del os.environ[_k]

import datetime
import importlib
import inspect
import json
import re
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "wcs")
sys.path.insert(0, ROOT)
try:
    with open(os.path.join(ROOT, "de.json"), encoding="utf-8") as f:
        IDX = json.load(f)
except Exception:  # noqa: BLE001
    IDX = []


def norm(s):
    s = str(s or "").lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = re.sub(r"str\.|strasse", "str", s)
    return re.sub(r"[^a-z0-9]", "", s)


def core(n):
    return re.sub(r"^(landkreis|kreis|stadt|gemeinde|markt)", "", n)


STREET = {"street", "strasse", "street_name", "str", "mm_frm_str_sel", "strassenname", "road"}
HNR = {"hnr", "house_number", "housenumber", "hausnummer", "number", "streetnr", "building_number", "mm_frm_hnr_sel", "hausnr", "house_no", "street_number"}
CITY = {"city", "ort", "municipality", "gemeinde", "commune", "mm_frm_ort_sel", "town", "place", "stadt", "level_1"}
PART = {"district", "ortsteil", "stadtteil", "subdistrict", "bezirk", "area", "teilort", "suburb", "level_2"}
PLZ = {"plz", "zip", "zip_code", "postcode", "postal_code", "zipcode"}
STATE = {"bundesland", "state"}
COUNTY = {"landkreis", "county"}


def values(name, a):
    """What an address offers for a parameter of this name, best first."""
    names = [a["city"], a["district"]] + a["alt"]
    if name in STREET:
        return [a["street"]]
    if name in HNR:
        return [a["hnr"], re.sub(r"\D.*$", "", a["hnr"])]
    if name in CITY:
        return names
    if name in PART:
        return [a["district"]] + a["alt"] + [a["city"]]
    if name in PLZ:
        return [a["plz"]]
    if name in STATE:
        return [a["state"]]
    if name in COUNTY:
        return [a["county"], re.sub(r"^(Landkreis|Kreis)\s+", "", a["county"])]
    if name == "address":
        return [(a["street"] + " " + a["hnr"]).strip()]
    return []


def candidates(a):
    city, county = norm(a["city"]), core(norm(a["county"]))
    names = {norm(x) for x in [a["city"], a["district"]] + a["alt"] if len(norm(x)) >= 3}
    out, seen = [], set()
    for title, mod, dp, mt in IDX:
        t, mtn = norm(title), norm(mt)
        tc = core(t)
        # only a parameter that names a place counts (a customer id "neustadt" says nothing about which Neustadt)
        dpv = {norm(v) for k, v in dp.items() if isinstance(v, str) and k in CITY | PART}
        score = 0
        if city and (t == city or tc == city or city in dpv):
            score = 90
        elif names & ({t, tc} | dpv):
            score = 75
        elif county and len(county) >= 4 and county in t and ("kreis" in t or tc == county):
            score = 80
        elif city and len(city) >= 5 and city in t and (not county or county in t or county in mtn):
            score = 60  # "AWB Köln", "Stadtreinigung Dresden"; for a town inside a district the district has to fit too
        elif county and len(county) >= 4 and county in mtn and not dpv:
            score = 70  # a district-wide connector without a fixed town: the town goes in as a parameter
        if not score:
            continue
        # the district "Landkreis Rostock" is not the city of Rostock
        if re.match(r"(land)?kreis", t) and not (county and county in t):
            continue
        # a connector made for one district (its own title names a "...kreis") is not asked about a town somewhere else
        if "kreis" in mtn and not (county and county in mtn) and not (city and city in mtn):
            continue
        key = mod + json.dumps(dp, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        out.append((score, title, mod, dp))
    # "Einbeck (Bezirk 1)", "Einbeck (Bezirk 2)": which part of town an address is in can't be told from here; better no plan than a wrong one
    part = {}
    for sc, title, mod, dp in out:
        if sc == 60:
            part[mod] = part.get(mod, 0) + 1
    out = [x for x in out if not (x[0] == 60 and part.get(x[2], 0) > 1)]
    out.sort(key=lambda x: -x[0])
    return out[:6]


def best(sugg, wants):
    sugg = [s for s in sugg if s is not None]
    table = [(norm(s), s) for s in sugg]
    for w in wants:
        n = norm(w)
        if not n:
            continue
        for sn, s in table:
            if sn == n:
                return s
    for w in wants:
        n = norm(w)
        if len(n) < 3:
            continue
        hit = [s for sn, s in table if sn and (sn.startswith(n) or n.startswith(sn))]
        if len(hit) == 1:
            return hit[0]
        if hit:
            return None  # "Einbeck (Bezirk 1)" or "(Bezirk 2)"? Not to be guessed
    for w in wants:
        n = norm(w)
        if len(n) < 4:
            continue
        hit = [s for sn, s in table if n in sn]
        if len(hit) == 1:
            return hit[0]
        if hit:
            return None
    return None


def run(mod, dp, a, deadline):
    from waste_collection_schedule import exceptions as X  # noqa: PLC0415

    m = importlib.import_module("waste_collection_schedule.source." + mod)
    sig = inspect.signature(m.Source.__init__)
    kw = dict(dp)
    for name, p in list(sig.parameters.items())[1:]:
        if name in kw or p.kind in (p.VAR_KEYWORD, p.VAR_POSITIONAL):
            continue
        required = p.default is inspect.Parameter.empty
        vals = [v for v in values(name, a) if v]
        # optional parts of a town and states are left out at first: a wrong guess there does more harm than none
        if vals and (required or name in STREET | HNR | CITY | PLZ):
            kw[name] = vals[0]
        elif required:
            return None, "args"
    street_missing = False
    for _ in range(5):
        if time.time() > deadline:
            return None, "time"
        try:
            rows = m.Source(**kw).fetch()
            return rows, None
        except (X.SourceArgumentNotFoundWithSuggestions, X.SourceArgumentRequiredWithSuggestions, X.SourceArgAmbiguousWithSuggestions) as e:
            arg = e.argument
            choice = best(list(e.suggestions or []), values(arg, a) or ([a["city"], a["district"]] + a["alt"]))
            if arg in STREET or arg in HNR:
                street_missing = True
            if choice is None or kw.get(arg) == choice:
                # a house number nobody knows: the first one of the street is as good as any for the collection day
                if arg in HNR and e.suggestions:
                    first = list(e.suggestions)[0]
                    if kw.get(arg) != first:
                        kw[arg] = first
                        continue
                return None, "street" if street_missing else "city"
            kw[arg] = choice
        except (X.SourceArgumentNotFound, X.SourceArgumentRequired, X.SourceArgumentException) as e:
            return None, "street" if getattr(e, "argument", "") in STREET | HNR else "city"
    return None, "city"


def lookup(a):
    t0, deadline = time.time(), time.time() + 48
    cand = candidates(a)
    if not cand:
        return {"error": "unsupported"}
    miss = "unsupported"
    today = (datetime.datetime.utcnow() + datetime.timedelta(hours=1)).date()
    for score, title, mod, dp in cand:
        left = deadline - time.time()
        if left < 4:
            break
        box = {}

        def work(mod=mod, dp=dp, box=box):
            try:
                box["rows"], box["miss"] = run(mod, dp, a, deadline)
            except Exception as e:  # noqa: BLE001
                box["miss"] = "down"
                box["err"] = repr(e)[:200]

        th = threading.Thread(target=work, daemon=True)
        th.start()
        th.join(min(16, left))
        rows = box.get("rows")
        if rows:
            days = {}
            for c in rows:
                try:
                    d, w = c.date, str(c.type)
                except Exception:  # noqa: BLE001
                    continue
                if isinstance(d, datetime.datetime):
                    d = d.date()
                if not isinstance(d, datetime.date) or d < today or not w:
                    continue
                k = d.isoformat()
                days.setdefault(k, [])
                if w[:40] not in days[k]:
                    days[k].append(w[:40])
            if days:
                return {"termine": [{"d": k, "was": days[k], "zusatz": ""} for k in sorted(days)][:80], "via": mod + ":" + title, "ms": int((time.time() - t0) * 1000)}
            miss = "empty"
        elif box.get("miss") == "street":
            miss = "street"
    return {"error": miss, "tried": [c[2] + ":" + c[1] for c in cand]}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = {k: v[0] for k, v in urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).items()}
        g = lambda k, n=80: re.sub(r"\s+", " ", str(q.get(k, ""))).strip()[:n]  # noqa: E731
        a = {"street": g("street"), "hnr": g("hnr", 12), "plz": g("plz", 5), "city": g("city"), "district": g("district"), "county": g("county"), "state": g("state"),
             "alt": [x.strip() for x in g("alt", 200).split("|") if x.strip()]}
        try:
            out = lookup(a) if a["city"] else {"error": "unsupported"}
            code = 200
        except Exception as e:  # noqa: BLE001
            out, code = {"error": "net", "detail": repr(e)[:200]}, 502
        body = json.dumps(out, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400" if "termine" in out else "public, s-maxage=1800" if code == 200 else "no-store")
        self.end_headers()
        self.wfile.write(body)
