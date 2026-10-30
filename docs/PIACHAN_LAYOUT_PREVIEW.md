# Piachan Level 1 geometry preview

This standalone preview imports geometry from [`surevision/piachan`](https://github.com/surevision/piachan) at pinned commit `70d4900a1fee3af8801a3279fac2c1d3e2a0b0b5`.

## Inspected upstream files

- `assets/resources/lv/lv1.prefab` — four authored map layers and the imported coordinates.
- `assets/scripts/main.ts` — layer loading, per-layer coordinate deduplication, half-grid placement, and tile creation.
- `assets/scripts/component/NodeInfo.ts` — higher-layer shared-corner cover test.
- `extensions/map_editor/src/obj/MapData.ts` — editor map-data shape.
- `LICENSE` — MIT license and attribution.

The copied notice is retained at [`../third_party/piachan/LICENSE`](../third_party/piachan/LICENSE). No Cocos Creator or Vue runtime code or dependency is included.

## Import semantics

The upstream prefab contains repeated editor cells for some half-offset tiles. Its runtime keeps the first value for each unique `layer + x + y`, producing exactly 90 tiles in four layers: `29 / 24 / 25 / 12`.

Coordinates are stored unchanged in half-grid units. For a requested tile size `s`, rendering uses `left = x × s / 2` and `top = y × s / 2`; both the 36 px and 44 px views therefore apply one uniform scale to the same positions.

The upstream cover test compares the four corner keys `(x,y)`, `(x+1,y)`, `(x,y+1)`, and `(x+1,y+1)` against every higher layer. For these fixed-size tiles that is equivalent to `abs(dx) <= 1 && abs(dy) <= 1`. The preview derives all blocker IDs from that rule rather than importing manually authored relationships.

## Boundary

The route `/bird/preview/piachan` remains an inspection-only UI with placeholder Chinese characters, tile removal, exposure updates, remaining count, reset, and 36/44 px scale comparison. It does not use the bird catalogs, RNG, composition, tray, scoring, solver, or playable level data. The normal game route `/bird/` now uses these exact positions for playable Level 3.
