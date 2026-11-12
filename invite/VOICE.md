# Einladungsfilm: Sprechskript (echte Stimme)

Der Film unter `/invite?ref=<handle>` läuft von selbst durch. Ohne Aufnahmen hat jede Szene eine feste Dauer und
Nathans vorhandene Sprüche aus `sounds/lines/` setzen die Ausrufe (Hallo hallo, Brillant, Was war das, Platz 1, Geilo …).

Sobald eine Aufnahme als `invite/voice/s<N>.mp3` liegt und ihre Nummer in `invite/voice/index.json` steht
(z. B. `[0, 1, 2]`), spielt die Szene diese Erzählspur und dauert genau so lang
wie die Aufnahme (+ 0,6 s). Fehlt eine Datei, bleibt die feste Dauer. Handy-Mikro reicht, warm und mit Grinsen sprechen,
kein Studio. Die Ausrufe aus `sounds/lines/` laufen weiter dazwischen; wer das nicht will, nimmt die `cues` in `invite.html` raus.

| Datei | Szene | Text (frei nachsprechen, so lang wie es sich gut anfühlt) |
| --- | --- | --- |
| s0.mp3 | Schach-App | „Hallo hallo. Das hier war mal eine Schach-App. Ehrlich. Nur Schach. Das hat ungefähr zwei Wochen gehalten.“ |
| s1.mp3 | Puzzles, Bots, Ränge | „Puzzles, Bots, Ränge wie in League. Alles schön, alles normal. Und dann hat Wolf verloren und wollte was anderes spielen.“ |
| s2.mp3 | Imposter nachgebaut | „Also dachten wir: Eigentlich wollen wir gerade lieber Imposter spielen. Haben wir nachgebaut. Raumstation, Sabotage, Sprachchat. Adri war dreimal hintereinander der Imposter. Dreimal.“ |
| s3.mp3 | Kalorien | „Dann wollten wir Kalorien tracken. Zehn Euro im Monat?! Nö. Eingebaut. Sprechen oder Barcode, fertig. Mit Ranking gegen deine Freunde. Adri: dreitausendachthundert von dreitausendeinhundert Kalorien. Trotzdem Platz eins. Lange Geschichte.“ |
| s4.mp3 | Nat Stars | „Dann wollten wir mal wieder Brawl Stars zocken. Also… haben wir einfach Brawl Stars nachgebaut. Nat Stars. Weil wir Bock hatten. Das reicht hier als Grund.“ |
| s5.mp3 | Einkaufsliste | „Dann standen wir im Supermarkt. Ohne Liste. Zum vierten Mal diese Woche. Also: Einkaufsliste, geteilt mit der WG. Und ‚Kochen‘ guckt, was da ist, und sagt dir, was geht.“ |
| s6.mp3 | Partyspiele | „Zehn Leute auf der Couch? Werwolf, Tabu, Stirnraten, Wahrheit oder Pflicht. Ein Handy reicht. Und niemand muss den Erzähler machen. Niemand.“ |
| s7.mp3 | Tipp-App, zuschauen | „Dann wollten wir aufs Worlds-Finale tippen. Also haben wir eine Tipp-App draus gemacht. Mit deinen Freunden. Und du siehst, wer gerade spielt, schaust rein, schlägst einen Zug vor und quatschst dazwischen.“ |
| s8.mp3 | Community | „Und jetzt kommt der Punkt: Das ist keine App. Das ist eine Community. Ein Abo für tausend Apps? Nein. Eine App für alles. Was auch immer du brauchst, wir bauen es rein. Und es steht nie still.“ |
| s9.mp3 | Versprechen | „Unser Versprechen: Du schlägst vor, alle stimmen ab, und der Top-Kommentar wird gebaut. Egal was. Jeden Tag gibt's dazu ein Update von mir. Live.“ |
| s10.mp3 | Null Euro | „Und das kostet? Null. Keine Werbung, kein Abo, kein Trick.“ |
| s11.mp3 | Einladung | „Du bist eingeladen. Nimm an, spiel eine Runde gegen den, der dich eingeladen hat, und er kriegt 250 NatCoins. Du kriegst… alles. Chess.nat.“ |

Reihenfolge der Szenen im Film: s0 … s7, dann Community (Datei s8), Versprechen (s9), Null Euro (s10), Einladung (s11).
