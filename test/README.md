# Chess.nat testen, eingeloggt, ohne die echte Datenbank

Eine Attrappe für Supabase: Sie beantwortet alles, was die App von Supabase will (Anmelden, Tabellen, Funktionen,
Live-Änderungen, Dateien), aus dem Arbeitsspeicher. Die echte Datenbank und echte Spieler werden nie berührt.
Dieser Ordner wird nicht veröffentlicht (`.vercelignore`).

## Von Hand ausprobieren

    node test/fake-supabase/server.js

Dann im Browser `http://localhost:4173/__fake/login?u=tester` öffnen: Die App läuft, angemeldet als Testperson.
Ein zweites Browser-Profil mit `?u=mila` ist die Freundin (für Chat, Einkaufsliste, Tippspiel zu zweit).

| Testperson | Was sie hat |
| --- | --- |
| `tester` (Nat Tester) | Kalorien-Tracker an, Einträge für heute und 8 Tage, Einkaufsliste (Besitzer), Freunde Mila und Jonas, Anfrage von Ole |
| `mila` | trackt und teilt, hat ihr Ziel heute erreicht, ist auf der Einkaufsliste |
| `jonas` | Freund ohne Tracker (lässt sich einladen) |
| `ole` | kein Freund, hat eine Anfrage geschickt |

Passwort für alle: `test1234` (E-Mail `<name>@chessnat.test`). Jeder Neustart beginnt wieder mit diesen Daten.

## Alles automatisch durchklicken

    node test/run.js              # alles (ca. 5 Minuten)
    node test/run.js shop chat    # nur einzelne Teile

Braucht Playwright (`npm i -g playwright`) und Chrome. Jeder Teil öffnet die App auf einem Handy-großen Bildschirm,
tut, was ein Spieler tun würde, und prüft das Ergebnis auf der Seite **und** in der Datenbank. Am Ende steht, was nicht
geklappt hat, samt jedem Fehler, den Seite oder Datenbank unterwegs gemeldet haben. Bilder landen in `test/out/`.

Teile: `login` · `kcal` (Suche, Mengen, Sprechen, Barcode) · `nudeln` (feste Nährwerte, trocken/gekocht) ·
`kcal2` (Reiter, Einstellungen, Wiegen, Kochen, Wochen-Rückblick) · `shop` (Einkaufsliste mit zwei Handys) ·
`chat` (Chat mit zwei Handys, Nat Stars, Freunde) · `tipp` · `feedback` · `seiten` (jede Seite, Handy und PC) · `start` (kein Flackern)

## Warum die Attrappe echte Fehler findet

- `fake-supabase/schema.js` ist ein Abbild der echten Datenbank (Tabellen, Spalten, Typen, Pflichtfelder).
  Fragt der Code eine Tabelle oder Spalte ab, die es dort nicht gibt, antwortet die Attrappe mit demselben Fehler wie Supabase.
- `fake-supabase/rules.js` enthält die echten Regeln: CHECKs, Row Level Security (wer darf was sehen und ändern),
  Trigger (Flamme) und die Funktionen hinter `rpc`.
- Live-Änderungen kommen wie in echt nur für Tabellen, die dafür freigeschaltet sind, und nur bei dem an, der die Zeile lesen darf.
- `/api/kcal` und `/api/food` sind die echten Dateien aus `api/`; nur die KI und Open Food Facts sind durch feste Antworten ersetzt.

**Wichtig:** Ändert sich die echte Datenbank (neue Tabelle, neue Spalte, neue Regel), müssen `schema.js` und `rules.js` nachziehen.
Tabellen, die es bisher nur als SQL-Datei gibt, stehen in `schema.js` unter `PENDING`; mit `FAKE_PENDING=1` tut die Attrappe so, als gäbe es sie schon.

Schalter: `PORT`, `FAKE_DELAY=300` (langsames Netz), `FAKE_AI_DOWN=1` (KI fällt aus), `FAKE_AUTOCONFIRM=1` (Registrieren ohne E-Mail-Bestätigung).
Hilfsadressen: `/__fake/problems` (alle Datenbank-Fehler), `/__fake/table/<name>` (Tabelle ansehen oder ändern), `/__fake/reset`.

## Was die Attrappe nicht kann

Echte Push-Nachrichten, die Kamera (Barcodes werden als Nummer eingetippt), echte Spracherkennung (der Test „hört“ einen festen Satz)
und alles, was nur ein echtes iPhone zeigt: Tastatur-Höhe, Safari-Eigenheiten, Vibration.
