import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG, LEGACY_GAMEPLAY_COMPOSITIONS, LEGACY_GAMEPLAY_SPECIES_CATALOG } from '../src/core/birdCatalog';
import { BEGINNER_90_TILE_CONSTRAINTS, BEGINNER_DISCOVERY_BIRD_IDS, BEGINNER_FAMILIAR_BIRD_IDS, BEGINNER_LEVEL_3_CATALOG, sampleBirdContent } from '../src/core/contentSampler';
import {
  composeBird,
  createGame,
  evaluateTerminalState,
  findFormableBirds,
  restartLevel,
  switchLevel3Board,
} from '../src/core/game';
import { PLAYABLE_LEVEL_3_SEEDS } from '../src/core/level3Playable';
import { PIACHAN_POSITIONS } from '../src/preview/piachanLayout';
import { replaySolution } from '../tools/level3Solver';
import { getLevel } from '../src/core/levels';
import type { RackTile } from '../src/core/types';

function tray(characters: string): Array<RackTile | null> {
  const filled = [...characters].map((character, index) => ({ id: `fixture-${index}`, character }));
  return [...filled, ...Array<RackTile | null>(10 - filled.length).fill(null)];
}

describe('playable Piachan Level 3', () => {
  it('uses exactly 36 verified beginner candidates without changing the canonical catalog', () => {
    expect(BIRD_CATALOG).toHaveLength(100);
    expect(BEGINNER_LEVEL_3_CATALOG).toHaveLength(36);
    expect(BEGINNER_LEVEL_3_CATALOG.every((bird) => BIRD_CATALOG.includes(bird))).toBe(true);
  });
  it.each(PLAYABLE_LEVEL_3_SEEDS)('holds the beginner content limits for seed %s', (seed) => {
    const sampled = sampleBirdContent(seed, BEGINNER_90_TILE_CONSTRAINTS, BEGINNER_LEVEL_3_CATALOG);
    expect(sampled.ok).toBe(true);
    if (!sampled.ok) return;
    const value = sampled.value;
    expect(value.characters).toHaveLength(90);
    expect(value.distinctSpecies).toBeGreaterThanOrEqual(18);
    expect(value.distinctSpecies).toBeLessThanOrEqual(22);
    expect(Math.max(...Object.values(value.speciesCounts))).toBeLessThanOrEqual(3);
    expect(Math.max(...Object.values(value.familySpeciesCounts))).toBeLessThanOrEqual(3);
    expect(value.overlappingSpeciesPairs).toBeGreaterThanOrEqual(6);
    expect(value.overlapPairDensity).toBeLessThanOrEqual(0.25);
    expect(Object.keys(value.speciesCounts).filter((id) => new Set<string>(BEGINNER_FAMILIAR_BIRD_IDS).has(id)).length)
      .toBeGreaterThan(Object.keys(value.speciesCounts).length / 2);
    expect(Object.keys(value.speciesCounts).filter((id) => new Set<string>(BEGINNER_DISCOVERY_BIRD_IDS).has(id)).length)
      .toBeGreaterThanOrEqual(2);
  });
  it('uses the exact 90 positions and a sampled canonical-only composition catalog', () => {
    const level = getLevel('level-3', 2);
    const sampled = sampleBirdContent(2, BEGINNER_90_TILE_CONSTRAINTS, BEGINNER_LEVEL_3_CATALOG);
    expect(sampled.ok).toBe(true);
    if (!sampled.ok) return;
    expect(level.tiles.map((tile) => [tile.id, tile.x, tile.y, tile.layer, tile.blockedBy]))
      .toEqual(PIACHAN_POSITIONS.map((tile) => [tile.id, tile.x, tile.y, tile.layer, tile.blockedBy]));
    expect(level.tiles).toHaveLength(90);
    expect([...level.tiles.map((tile) => tile.character)].sort())
      .toEqual([...sampled.value.characters].sort());
    expect(level.catalog?.map((bird) => bird.id).sort())
      .toEqual(Object.keys(sampled.value.speciesCounts).sort());
    expect(level.catalog?.every((bird) => BIRD_CATALOG.includes(bird))).toBe(true);
    expect(level.catalog?.some((bird) => bird.id === 'bird:xiaobailu')).toBe(false);
    expect(level.catalog?.length).toBeGreaterThanOrEqual(18);
    expect(level.catalog?.length).toBeLessThanOrEqual(22);
  });

  it('preserves the legacy catalog for Levels 1 and 2', () => {
    for (const id of ['level-1', 'level-2']) {
      expect(createGame(id).activeCompositions.slice(0, 16)).toEqual(LEGACY_GAMEPLAY_COMPOSITIONS);
    }
    expect(createGame('level-1').activeCatalog).toEqual(LEGACY_GAMEPLAY_SPECIES_CATALOG);
    expect(createGame('level-3', 4).activeCatalog.every((bird) => BIRD_CATALOG.includes(bird))).toBe(true);
  });

  it('recognizes, consumes, and scores only birds in the active sampled pool', () => {
    const state = { ...createGame('level-3', 2), tray: tray('喜鹊') };
    expect(findFormableBirds(state.tray, state.activeCompositions).map((bird) => bird.id))
      .toContain('bird:xique');
    const composed = composeBird(state, 'bird:xique');
    expect(composed.score).toBe(10);
    expect(composed.tray.every((tile) => tile === null)).toBe(true);
    expect(composeBird(state, 'bird:jiayan')).toBe(state);
    const legacy = { ...createGame('level-1'), tray: tray('丹顶鹤') };
    expect(composeBird(legacy, 'bird:dandinghe')).toBe(legacy);
  });

  it('uses the active catalog for board-empty cleanup and full-tray defeat', () => {
    const state = createGame('level-3', 2);
    const emptyBoard = state.boardTiles.map((tile) => ({ ...tile, removed: true }));
    expect(evaluateTerminalState(emptyBoard, tray('喜鹊'), state.activeCompositions)).toBe('playing');
    const cleanup = composeBird({ ...state, boardTiles: emptyBoard, tray: tray('喜鹊') }, 'bird:xique');
    expect(cleanup.phase).toBe('level_complete');
    expect(evaluateTerminalState(state.boardTiles, tray('〇〇〇〇〇〇〇〇〇〇'), state.activeCompositions))
      .toBe('game_over');
  });

  it.each(PLAYABLE_LEVEL_3_SEEDS)('replays validated seed %s through the real game rules', (seed) => {
    const level = getLevel('level-3', seed);
    const state = replaySolution(level, level.winningSolution);
    expect(state.phase).toBe('level_complete');
    expect(state.boardTiles.every((tile) => tile.removed)).toBe(true);
    expect(state.tray.every((tile) => tile === null)).toBe(true);
  });

  it('retry preserves assignments and new board switches only to a validated seed', () => {
    const initial = createGame('level-3', 2);
    const retried = restartLevel({ ...initial, score: 70, tray: tray('丹顶鹤') });
    expect(retried.levelSeed).toBe(2);
    expect(retried.score).toBe(0);
    expect(retried.tray.every((tile) => tile === null)).toBe(true);
    expect(retried.boardTiles).toEqual(initial.boardTiles);
    const switched = switchLevel3Board(initial);
    expect(PLAYABLE_LEVEL_3_SEEDS).toContain(switched.levelSeed);
    expect(switched.levelSeed).not.toBe(initial.levelSeed);
    expect(switched.boardTiles.map((tile) => tile.character))
      .not.toEqual(initial.boardTiles.map((tile) => tile.character));
  });
});
