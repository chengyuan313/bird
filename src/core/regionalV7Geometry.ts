import { PIACHAN_POSITIONS } from '../preview/piachanLayout';
import { REGIONAL_V7_TILE_COUNTS, type RegionalTier } from './regionalV7Data';
import type { BoardTileDefinition } from './types';

export const REGIONAL_V7_GEOMETRY_VERSION = 'regional-v7-geometry-1';
export const REGIONAL_V7_DENSE_TUTORIAL_GEOMETRY_VERSION = 'regional-v7-dense-tutorial-2';
export function geometryVersionForTier(tier: RegionalTier): string {
  return tier <= 2 ? REGIONAL_V7_DENSE_TUTORIAL_GEOMETRY_VERSION : REGIONAL_V7_GEOMETRY_VERSION;
}
export interface RegionalGeometry {
  id: string;
  width: number;
  height: number;
  tiles: readonly BoardTileDefinition[];
}

// D1 is a connected three-layer 3×3 core from Piachan's authored lv1 map.
// D2 adds a surrounding ring and three top-layer positions to that same core.
// Only selection and translation change; overlap edges come from the source map.
const DENSE_D1_KEYS = new Set([
  ...[4, 6, 8].flatMap((x) => [4, 6, 8].map((y) => `1:${x}:${y}`)),
  ...[4, 6, 8].flatMap((x) => [4, 6, 8].map((y) => `3:${x}:${y}`))
    .filter((key) => key !== '3:4:4' && key !== '3:8:8'),
  ...[5, 7].flatMap((x) => [5, 7].map((y) => `2:${x}:${y}`)),
  '2:3:3', '2:9:9',
]);
const DENSE_D2_EXTRA_KEYS = new Set([
  '2:9:3', '2:3:9', '3:4:4', '3:8:8',
  '1:2:6', '1:10:6', '3:2:6', '3:10:6',
  '4:3:6', '4:6:6', '4:9:6',
]);

/** D1/D2 use dense, connected subsets of the Piachan source geometry. D3/D4
 * remain their existing prefix subsets; D5 remains all 90 source positions. */
export function geometryForTier(tier: RegionalTier): RegionalGeometry {
  if (tier <= 2) {
    const keys = tier === 1 ? DENSE_D1_KEYS : new Set([...DENSE_D1_KEYS, ...DENSE_D2_EXTRA_KEYS]);
    const positions = PIACHAN_POSITIONS.filter((tile) => keys.has(`${tile.layer}:${tile.x}:${tile.y}`));
    const expected = REGIONAL_V7_TILE_COUNTS[tier];
    if (positions.length !== expected || positions.some((tile) =>
      positions.filter((other) => other.layer === tile.layer && other.x === tile.x && other.y === tile.y).length !== 1)) {
      throw new Error(`Invalid dense D${tier} source selection`);
    }
    const ids = new Set(positions.map((tile) => tile.id));
    const minX = Math.min(...positions.map((tile) => tile.x));
    const maxX = Math.max(...positions.map((tile) => tile.x));
    const minY = Math.min(...positions.map((tile) => tile.y));
    const maxY = Math.max(...positions.map((tile) => tile.y));
    const width = 260, height = 230;
    const offsetX = Math.round((width - (maxX - minX) * 22 - 48) / 2);
    const offsetY = Math.round((height - (maxY - minY) * 22 - 48) / 2);
    return { id: `piachan-dense-tutorial-${expected}-v2`, width, height,
      tiles: positions.map((tile) => ({ id: tile.id,
        x: offsetX + (tile.x - minX) * 22, y: offsetY + (tile.y - minY) * 22,
        layer: tile.layer, blockedBy: tile.blockedBy.filter((id) => ids.has(id)), character: '' })) };
  }
  const positions = PIACHAN_POSITIONS.slice(0, REGIONAL_V7_TILE_COUNTS[tier]);
  const ids = new Set(positions.map((tile) => tile.id));
  return { id: `piachan-subset-${positions.length}-v1`, width: 350, height: 326,
    tiles: positions.map((tile) => ({ id: tile.id, x: 12 + tile.x * 22, y: 12 + tile.y * 22,
      layer: tile.layer, blockedBy: tile.blockedBy.filter((id) => ids.has(id)), character: '' })) };
}

export function topologicalTakeOrder(geometry: RegionalGeometry, seed: number): readonly string[] {
  if (!Number.isSafeInteger(seed) || seed < 1) throw new Error('Invalid geometry seed');
  const removed = new Set<string>();
  const order: string[] = [];
  while (order.length < geometry.tiles.length) {
    const exposed = geometry.tiles.filter((tile) => !removed.has(tile.id) && tile.blockedBy.every((id) => removed.has(id)));
    if (!exposed.length) throw new Error(`Blocking cycle in ${geometry.id}`);
    // Choosing the stable first exposed ID makes the constructed route legible:
    // the visible sweep follows a predictable spatial sequence. Seeded word
    // selection still changes the actual board, while geometry remains fixed.
    const chosen = exposed.sort((a, b) => a.id.localeCompare(b.id))[0];
    removed.add(chosen.id);
    order.push(chosen.id);
  }
  return order;
}

export function validateRegionalGeometry(geometry: RegionalGeometry, expectedTiles: number): void {
  if (geometry.tiles.length !== expectedTiles || new Set(geometry.tiles.map((tile) => tile.id)).size !== expectedTiles) throw new Error('Invalid regional geometry tile count');
  const byId = new Map(geometry.tiles.map((tile) => [tile.id, tile]));
  for (const tile of geometry.tiles) {
    if (tile.x < 0 || tile.y < 0 || tile.x + 48 > geometry.width || tile.y + 48 > geometry.height ||
      tile.blockedBy.some((id) => !byId.has(id) || byId.get(id)!.layer <= tile.layer)) throw new Error(`Invalid regional geometry tile ${tile.id}`);
  }
  if (topologicalTakeOrder(geometry, 1).length !== expectedTiles) throw new Error('Invalid regional removal order');
}
