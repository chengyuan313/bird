import { getLevel } from './levels';
import { PIACHAN_POSITIONS } from '../preview/piachanLayout';
import { REGIONAL_V7_TILE_COUNTS, type RegionalTier } from './regionalV7Data';
import type { BoardTileDefinition } from './types';

export const REGIONAL_V7_GEOMETRY_VERSION = 'regional-v7-geometry-1';
export interface RegionalGeometry {
  id: string;
  width: number;
  height: number;
  tiles: readonly BoardTileDefinition[];
}

/** D1/D2 retain their proven topology. D3/D4 are subsets of the existing Piachan
 * 90-position geometry (not newly invented spatial coordinates); D5 uses all 90. */
export function geometryForTier(tier: RegionalTier): RegionalGeometry {
  if (tier <= 2) {
    const level = getLevel(tier === 1 ? 'level-1' : 'level-2');
    return { id: `tutorial-${tier === 1 ? 22 : 33}-v1`, width: 350, height: 258,
      tiles: level.tiles.map((tile) => ({ ...tile, character: '' })) };
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
