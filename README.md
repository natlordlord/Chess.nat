# Chess.nat

Persönliche Schach-Lernseite mit Partyspielen: Lernpfad bis 1600, über 200.000 bewertete Puzzles mit Rängen von Iron bis Challenger,
Puzzle Rush, Daily Puzzle, Themen-Training, 12 Bots, Partien gegen Freunde (live, per Link oder an einem Gerät)
und Partie-Analyse mit Stockfish. Statische Seite ohne Build-Schritt, Konten und Live-Spiel über Supabase.

## Einrichtung (einmalig, ca. 10 Minuten)

### 1. Supabase-Projekt anlegen
1. Auf https://supabase.com anmelden → **New project** (Name z. B. `chess-nat`, Region Frankfurt).
2. **SQL Editor → New query**, den Inhalt von `supabase/schema.sql` einfügen → **Run**.
3. **Authentication → URL Configuration**: bei *Site URL* die Vercel-Adresse eintragen
   (z. B. `https://chess-nat.vercel.app`), bei *Redirect URLs* dieselbe Adresse plus `/**`.
4. **Project Settings → API**: *Project URL* und *anon public key* kopieren.

### 2. Schlüssel eintragen
In `config.js` die beiden Werte `supabaseUrl` und `supabaseAnonKey` ersetzen und committen.
Der anon key ist öffentlich gedacht; die Daten schützt die Row-Level-Security aus `schema.sql`
(jede Person sieht nur ihre eigenen Zeilen).

### 3. Auf Vercel veröffentlichen
1. https://vercel.com → **Add New → Project** → dieses GitHub-Repository importieren.
2. Framework Preset: **Other**, Build Command leer lassen, Output Directory leer lassen → **Deploy**.
3. Jede Änderung auf `main` wird danach automatisch veröffentlicht.

### Optional: Mit Google anmelden
Supabase → Authentication → Providers → Google aktivieren, dann in `config.js` `google: true` setzen.

## Als App auf dem iPhone
1. https://chess-nat.vercel.app in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm** → Hinzufügen.
3. Chess.nat startet dann vom Home-Bildschirm im Vollbild mit eigenem Icon und Startbildschirm, ohne Safari-Leisten.
4. In der App einmal mit E-Mail und Passwort anmelden: Auf dem iPhone hat die App einen eigenen Speicher, getrennt von Safari.
   Mit Konto ist der Fortschritt in beiden gleich.

Technik: `manifest.webmanifest` und die `apple-*`-Tags in `index.html` machen die Seite installierbar, `icons/` enthält
App-Icons und Startbildschirme, `sw.js` hält App und Dateien für schnellen Start und Offline-Betrieb vor, `pwa.js` schaltet
den App-Modus ein (kein Zoomen, kein Gummiband-Scrollen) und zeigt in Safari den Installationshinweis.
Ändern sich `vendor/` oder `engine/`, in `sw.js` die `VERSION` hochzählen.

## Was wo gespeichert wird
- Ohne Konto: Fortschritt nur im Browser des Geräts.
- Mit Konto: Tabelle `kv` in Supabase, je Person getrennt (`user_id`), Pfade `data/users/<id>/profile`
  und `data/users/<id>/log-YYYY-MM-DD` (Trainingsprotokoll: Fehler, Partien, Lektionen).
- Fortschritt aus der Claude-Version übernehmen: dort Settings → *Copy my data*, hier Account → *Import*.

## Aufbau
| Pfad | Inhalt |
| --- | --- |
| `index.html` | die komplette App |
| `platform.js` | Anbindung an Supabase (Login, Speichern, Live-Räume) |
| `config.js` | Supabase-Schlüssel |
| `pwa.js`, `sw.js`, `icons/` | Home-Bildschirm-App (iPhone, Android) |
| `invite.js`, `invite/` | Einladungsfilm `/?ref=<handle>#invite`: läuft hochkant wie ein Spot von selbst durch, gebaut aus den echten Teilen der App (Brett mit Figuren, Avatare, Rang-Wappen, Kalorien-Kacheln, Spiele-Kacheln, Freunde-Zeile, Ideen, Trophäe). Erzählstimme `invite/voice/s<N>.mp3` mit wortgenauen Untertiteln aus `invite/voice/timing.json`, beides erzeugt `python invite/narrate.py` (edge-tts, deutsche Neural-Stimme); Nathans Sprüche aus `sounds/lines/` als Ausrufe. Der Einladen-Knopf teilt diesen Link, der Film merkt sich `ref`, nennt den Einlader (`invite_who`) und übergibt am Ende an die App. `invite.html` leitet alte Links um |
| Ideen | Mehr → „Ideen & Feedback“: jeder schlägt vor, alle stimmen ab, was oben steht wird gebaut (`supabase/schema_ideas.sql`: `chess_ideas`, `chess_idea_votes`; Status setzt ein News-Admin). `invite_who(handle)` nennt dem Film den Einlader ohne Konto |
| Patch-Notes | Ist ein Fix oder Wunsch aus Feedback und Ideen live, geht eine Update-Nachricht an alle (`supabase/schema_patch_notes.sql`: `chess_news.patch`, `private.patch_post(titel, punkte)`, Push als Art `news`). Die App zeigt sie als Update-Karte: je Punkt was sich geändert hat und wer es gemeldet oder gewünscht hat; der eigene Wunsch ist hervorgehoben |
| `puzzles/` | Lichess-Puzzle-Datenbank (CC0), nach Rating in 100er-Schritten |
| `engine/sf.js` | Stockfish 10 (GPL) |
| `voice/` | Coach-Stimme (Kokoro, Apache 2.0) |
| `sounds/` | Zug-Geräusche (Lichess, AGPL); `Mate.mp3` und alle Sprüche in `sounds/lines/` sind Nathans eigene Aufnahmen (keine Computerstimmen) |
| `games/` | Spiele-Bereich: Partyspiele für ein Handy (Imposter, Werwolf, Wahrheit oder Pflicht, Ich hab noch nie, Wer würde eher, Stirnraten, Tabu, Tick-Tack-Bumm, Stadt-Land-Fluss, Vier gewinnt). `core.js` = Hub, gemeinsame Bausteine, Look; je Spiel eine Datei mit `PG.add({...})`. `net.js` = Online-Lobby (jeder mit eigenem Handy: Link, QR-Code, Code oder Freunde einladen über `chess_invites` mit `tc = 'p:<spiel>'`; Supabase-Realtime-Kanal `chessnat-party-<code>`, das Gastgeber-Handy rechnet, jedes Handy bekommt nur seine eigene Ansicht als reinen Text), `online.js` = Online-Versionen der Spiele, `natposter.js` = Natposter (Raumstation: eigene Avatare laufen herum, Aufgaben mit Minispielen, Kills mit Todesanimationen, Schächte, Sabotage (Licht, Funk, Reaktor, Sauerstoff, Türen), Kameras, Lageplan, Vitalwerte, Gemeinschaftsaufgaben, Sonderrollen (Ingenieur, Wissenschaftler, Sheriff, Narr), Meetings mit Schnell-Chat und Glücksrad-Minispiel (Gewinner hat 2 Stimmen), Sprachchat per WebRTC (`PVoice` in `net.js`), Übungsmodus mit Bots, Querformat; Positionen gehen direkt von Handy zu Handy, alles andere entscheidet das Gastgeber-Handy). Bei Änderungen `?v=` in `index.html` hochzählen |
| `games/kcal.js` | Kalorien-Tracker (in den Einstellungen einschaltbar): Karte auf der Startseite mit Sprechen + Barcode + Foto vom Essen (die KI erkennt das Essen und schätzt die Gramm), Produkte, die man schon einmal gescannt hat, erkennt das Sprechen wieder („Wie letztes Mal“), Seite `#kcal` mit Heute, Verlauf nach Tagen und Freunden, Einladen, Flammen fürs Tagesziel. Gerichte aus mehreren Zutaten: Gramm vom Ganzen eintippen, alle Zutaten rechnen anteilig mit; mit Namen als Rezept für alle veröffentlichen (`supabase/kcal_recipes.sql`: `kcal_recipes`, erscheint in der Suche). Daten in Supabase (`supabase/schema_kcal.sql`: `kcal_profile`, `kcal_meals`, `kcal_invites`, Erinnerungs-Push mit Essensvorschlag in Gramm per `pg_cron`) |
| `api/foods.js` | Woher die Werte der Nährwert-Tabelle kommen: je Lebensmittel der Median der Produkte seiner Open-Food-Facts-Kategorie (nur in Deutschland verkaufte, pro 100 g), eine Woche zwischengespeichert. `/api/foods?debug=1` zeigt, wie viele Produkte je Lebensmittel eingeflossen sind und was fehlt |
| `data/foods.js` | Feste Nährwert-Tabelle für den Kalorien-Tracker (Handy und `api/kcal.js` laden dieselbe Datei): Werte pro 100 g für Grundnahrungsmittel und der Umrechnungssatz trocken ↔ gekocht (Nudeln, Reis, Linsen, Fleisch …). Gleiche Lebensmittel haben damit bei allen dieselben Werte; gescannte Packungen (Trockengewicht) lassen sich gekocht gewogen eintragen |
| `test/` | Test-Attrappe für die Datenbank und Durchklick-Tests im Browser, eingeloggt (siehe `test/README.md`) |
| `api/kcal.js` | Vercel-Funktion: rechnet Gesprochenes per KI (Vercel AI Gateway, OIDC) in Kalorien und Makros um, nur für angemeldete Spieler |
| `supabase/kcal_foods.sql` | Geprüfte Lebensmittel-Datenbank (`kcal_foods`), zweite Quelle neben `data/foods.js`: nur geprüfte Werte pro 100 g mit Quellenangabe, jedes Lebensmittel genau einmal. Für App und KI nur lesbar (`kcal_foods_lookup`), nichts Geschätztes wird je gespeichert; Einträge legt nur der Betreiber an. `api/kcal.js` gibt der KI die Namen, die Zahlen kommen aus der Zeile. Test: `node test/kcal-foods.js` |
| `vendor/` | chess.js (BSD), supabase-js (MIT), qrcode-generator (MIT, Kazuhiko Arase), zxing-wasm (MIT/Apache 2.0, Barcode-Scanner in `vendor/zxing/`) |

Figuren „Staunty“ von sadsnake1 (CC BY-NC-SA 4.0), nur für private, nicht-kommerzielle Nutzung.
