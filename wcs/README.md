# wcs: German waste calendar connectors

`waste_collection_schedule/` is copied from the open-source project
[hacs_waste_collection_schedule](https://github.com/mampfes/hacs_waste_collection_schedule) (MIT licence, © its contributors),
state of 2026-11-11: the package's base files, its `service/` helpers and the 151 `source/` modules that serve Germany.
`de.json` is that project's list of German regions: `[title, module, default parameters, the module's own title]`.

`api/abfall.py` runs them (see there). Nothing in here is written for Chess.nat; to update, copy the files again.
