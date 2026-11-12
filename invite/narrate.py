# Erzählstimme für den Einladungsfilm: Microsoft-Neural-Stimme (edge-tts, kostenlos) auf Deutsch.
# Erzeugt invite/voice/s<N>.mp3 und invite/voice/timing.json (Wortzeiten in Sekunden, für die Untertitel im Film).
# Aufruf: python invite/narrate.py   (pip install edge-tts). Eigene Aufnahmen: mp3 ersetzen, timing.json-Eintrag auf null setzen.
import asyncio, json, os, edge_tts
VOICE, RATE = "de-DE-FlorianMultilingualNeural", "+6%"
SCENES = [
 "Stell dir vor, jemand baut eine Schach-App. Ehrlich. Nur Schach. Das hält ungefähr zwei Wochen.",
 "Puzzles, Bots, Ränge wie in League. Alles schön. Alles normal. Dann verliert Wolf eine Partie und will was anderes spielen.",
 "Also bauen wir Imposter nach. Raumstation, Sabotage, Sprachchat. Adri ist dreimal hintereinander der Imposter. Dreimal.",
 "Dann wollen wir Kalorien tracken. Zehn Euro im Monat? Nö. Eingebaut. Sprechen oder Barcode, fertig. Mit Ranking gegen deine Freunde.",
 "Dann haben wir Bock auf Brawl Stars. Also bauen wir einfach Brawl Stars nach. Nat Stars. Weil wir Bock hatten. Das reicht hier als Grund.",
 "Dann stehen wir im Supermarkt. Ohne Liste. Zum vierten Mal diese Woche. Also: Einkaufsliste für die ganze WG. Und Kochen sagt dir, was aus dem Kühlschrank geht.",
 "Zehn Leute auf der Couch? Werwolf, Tabu, Stirnraten, Wahrheit oder Pflicht. Ein Handy reicht. Und niemand muss den Erzähler machen.",
 "Dann wollen wir aufs Worlds-Finale tippen. Also wird es eine Tipp-App. Und du siehst, wer gerade spielt, schaust rein, schlägst Züge vor und quatschst dazwischen.",
 "Und jetzt der Punkt: Das ist keine App. Das ist eine Community. Kein Abo für tausend Apps. Eine App für alles. Was auch immer du brauchst, wir bauen es rein. Es steht nie still.",
 "Unser Versprechen: Du schlägst vor, alle stimmen ab, und der Top-Kommentar wird gebaut. Egal was. Jeden Tag ein Live-Update vom Gründer.",
 "Und das kostet? Null Euro. Keine Werbung. Kein Abo. Kein Trick.",
 "Du bist eingeladen. Nimm an, spiel eine Runde gegen den, der dich eingeladen hat, und er kriegt 250 NatCoins. Du kriegst alles. Chess.nat.",
]
async def one(i, text):
    for attempt in range(4):
        try:
            c = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
            words, end, audio = [], 0, bytearray()
            async for ch in c.stream():
                if ch["type"] == "audio": audio += ch["data"]
                elif ch["type"] == "WordBoundary":
                    t0 = ch["offset"] / 1e7; words.append([round(t0, 2), ch["text"]]); end = max(end, t0 + ch["duration"] / 1e7)
            open(f"invite/voice/s{i}.mp3", "wb").write(audio)
            return {"text": text, "words": words, "end": round(end, 2)}
        except Exception as e:
            print("retry", i, attempt, e); await asyncio.sleep(3 + 3 * attempt)
    raise SystemExit(f"scene {i} failed")
async def main():
    out = [await one(i, t) for i, t in enumerate(SCENES)]
    json.dump(out, open("invite/voice/timing.json", "w", encoding="utf-8"), ensure_ascii=False)
    for i, o in enumerate(out): print(i, len(o["words"]), o["end"])
asyncio.run(main())
