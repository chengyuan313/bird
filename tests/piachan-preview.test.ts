import { describe, expect, it } from 'vitest';
import { AUTHORED_LEVELS } from '../src/core/levels';
import {
  PIACHAN_POSITIONS,
  createPiachanPreviewState,
  isPiachanTileExposed,
  piachanPositionsOverlap,
  remainingPiachanTiles,
  removePiachanTile,
} from '../src/preview/piachanLayout';

function blockingComponents(): readonly string[][] {
  const adjacency = new Map(PIACHAN_POSITIONS.map((tile) => [tile.id, new Set<string>()]));
  for (const tile of PIACHAN_POSITIONS) {
    for (const blockerId of tile.blockedBy) {
      adjacency.get(tile.id)!.add(blockerId);
      adjacency.get(blockerId)!.add(tile.id);
    }
  }
  const unseen = new Set(adjacency.keys());
  const components: string[][] = [];
  while (unseen.size > 0) {
    const start = unseen.values().next().value!;
    unseen.delete(start);
    const pending = [start];
    const component: string[] = [];
    while (pending.length > 0) {
      const id = pending.pop()!;
      component.push(id);
      for (const neighbor of adjacency.get(id)!) {
        if (unseen.delete(neighbor)) pending.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

describe('imported piachan Level 1 geometry', () => {
  it('contains exactly 90 stable, unique positions across 29 / 24 / 25 / 12 layers', () => {
    expect(PIACHAN_POSITIONS).toHaveLength(90);
    expect(new Set(PIACHAN_POSITIONS.map((tile) => tile.id)).size).toBe(90);
    expect([1, 2, 3, 4].map(
      (layer) => PIACHAN_POSITIONS.filter((tile) => tile.layer === layer).length,
    )).toEqual([29, 24, 25, 12]);
  });

  it('has only valid, higher-layer blocker references and no cycles', () => {
    const byId = new Map(PIACHAN_POSITIONS.map((tile) => [tile.id, tile]));
    for (const tile of PIACHAN_POSITIONS) {
      for (const blockerId of tile.blockedBy) {
        const blocker = byId.get(blockerId);
        expect(blocker).toBeDefined();
        expect(blocker!.layer).toBeGreaterThan(tile.layer);
      }
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error(`Blocking cycle at ${id}`);
      if (visited.has(id)) return;
      visiting.add(id);
      byId.get(id)!.blockedBy.forEach(visit);
      visiting.delete(id);
      visited.add(id);
    };
    PIACHAN_POSITIONS.forEach((tile) => visit(tile.id));
    expect(visited.size).toBe(90);

    const depthById = new Map<string, number>();
    const logicalDepth = (id: string): number => {
      const cached = depthById.get(id);
      if (cached !== undefined) return cached;
      const blockers = byId.get(id)!.blockedBy;
      const depth = blockers.length === 0
        ? 1
        : 1 + Math.max(...blockers.map(logicalDepth));
      depthById.set(id, depth);
      return depth;
    };
    expect(Math.max(...PIACHAN_POSITIONS.map((tile) => logicalDepth(tile.id)))).toBe(4);
  });

  it('derives every and only cross-layer visual overlap as blocking', () => {
    for (const tile of PIACHAN_POSITIONS) {
      const expected = PIACHAN_POSITIONS
        .filter((candidate) => candidate.layer > tile.layer && piachanPositionsOverlap(tile, candidate))
        .map((candidate) => candidate.id);
      expect(tile.blockedBy).toEqual(expected);
    }
    expect(PIACHAN_POSITIONS.reduce((sum, tile) => sum + tile.blockedBy.length, 0)).toBe(203);
  });

  it('forms one blocker component with no detached vertical stack', () => {
    const components = blockingComponents();
    expect(components.map((component) => component.length)).toEqual([90]);
    const byId = new Map(PIACHAN_POSITIONS.map((tile) => [tile.id, tile]));
    const detachedVerticalStacks = components.filter((component) => component.length > 1
      && new Set(component.map((id) => `${byId.get(id)!.x},${byId.get(id)!.y}`)).size === 1);
    expect(detachedVerticalStacks).toHaveLength(0);
  });

  it('starts with 19 exposed tiles and updates exposure after a valid removal', () => {
    const initial = createPiachanPreviewState();
    expect(PIACHAN_POSITIONS.filter((tile) => isPiachanTileExposed(initial, tile.id))).toHaveLength(19);
    const newlyRevealable = PIACHAN_POSITIONS.find((tile) => tile.blockedBy.length === 1
      && isPiachanTileExposed(initial, tile.blockedBy[0]));
    expect(newlyRevealable).toBeDefined();
    const blockerId = newlyRevealable!.blockedBy[0];
    expect(isPiachanTileExposed(initial, newlyRevealable!.id)).toBe(false);
    const removed = removePiachanTile(initial, blockerId);
    expect(removed).not.toBe(initial);
    expect(isPiachanTileExposed(removed, newlyRevealable!.id)).toBe(true);
    expect(remainingPiachanTiles(removed)).toBe(89);
  });

  it('rejects blocked removals and reset restores all 90 tiles', () => {
    const initial = createPiachanPreviewState();
    const blocked = PIACHAN_POSITIONS.find((tile) => !isPiachanTileExposed(initial, tile.id))!;
    expect(removePiachanTile(initial, blocked.id)).toBe(initial);
    const exposed = PIACHAN_POSITIONS.find((tile) => isPiachanTileExposed(initial, tile.id))!;
    expect(remainingPiachanTiles(removePiachanTile(initial, exposed.id))).toBe(89);
    expect(remainingPiachanTiles(createPiachanPreviewState())).toBe(90);
  });

  it('does not alter the existing playable level definitions', () => {
    expect(AUTHORED_LEVELS.map((level) => level.tiles.length)).toEqual([22, 33, 59]);
    expect(AUTHORED_LEVELS.map((level) => level.winningSolution.length)).toEqual([33, 44, 81]);
  });
});
