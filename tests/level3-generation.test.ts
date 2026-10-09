import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import {
  composeBird,
  createGameFromLevel,
  findFormableBirds,
  isBoardTileExposed,
  selectBoardTile,
  TRAY_SIZE,
} from '../src/core/game';
import {
  DEFAULT_LEVEL_3_CONSTRAINTS,
  generateLevel3Content,
  LEVEL_3_LAYOUT,
} from '../src/core/level3Generator';
import { PREVALIDATED_LEVEL_3_SEED } from '../src/core/level3Fixture';
import { getLevel } from '../src/core/levels';
import type { LevelDefinition } from '../src/core/types';
import { createUnverifiedLevel, replaySolution, solveLevel } from '../tools/level3Solver';

function generatedLevel(seed: number): LevelDefinition {
  const generated = generateLevel3Content(seed);
  if (!generated.ok) throw new Error(generated.reason);
  return createUnverifiedLevel('level-3-test', '第三关测试', generated.value.tiles);
}

function sortedCharacters(values: readonly string[]): string {
  return [...values].sort().join('');
}

describe('seeded Level 3 generation', () => {
  it('produces the identical board for the same seed', () => {
    expect(generateLevel3Content(17)).toEqual(generateLevel3Content(17));
  });

  it('produces meaningfully different character assignments for different seeds', () => {
    const first = generateLevel3Content(17);
    const second = generateLevel3Content(18);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.tiles.map((tile) => tile.character))
      .not.toEqual(second.value.tiles.map((tile) => tile.character));
  });

  it('fills the layout exactly and preserves stable position IDs', () => {
    const generated = generateLevel3Content(23);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    expect(generated.value.tiles).toHaveLength(LEVEL_3_LAYOUT.length);
    expect(generated.value.tiles.map((tile) => tile.id)).toEqual(LEVEL_3_LAYOUT.map((tile) => tile.id));
  });

  it('derives every placed character exactly from the sampled birds', () => {
    const generated = generateLevel3Content(29);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const birds = generated.value.sampledBirdIds.map((id) => BIRD_CATALOG.find((bird) => bird.id === id)!);
    expect(sortedCharacters(generated.value.characters))
      .toBe(sortedCharacters(birds.flatMap((bird) => [...bird.characters])));
  });

  it('respects diversity, repetition, and shared-family constraints', () => {
    const generated = generateLevel3Content(31);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const counts = generated.value.speciesCounts;
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(DEFAULT_LEVEL_3_CONSTRAINTS.minDistinctSpecies);
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(DEFAULT_LEVEL_3_CONSTRAINTS.maxSpeciesOccurrences);
    for (const family of DEFAULT_LEVEL_3_CONSTRAINTS.sharedFamilies) {
      expect(family.birdIds.filter((id) => (counts[id] ?? 0) > 0).length)
        .toBeGreaterThanOrEqual(family.minimumSelected);
    }
  });

  it('rejects impossible generation constraints explicitly', () => {
    const result = generateLevel3Content(1, {
      ...DEFAULT_LEVEL_3_CONSTRAINTS,
      minDistinctSpecies: BIRD_CATALOG.length + 1,
    });
    expect(result).toEqual({ ok: false, reason: 'No bird multiset satisfies the configured constraints' });
  });

  it('keeps every blocker reference valid and above its blocked tile', () => {
    const positionById = new Map(LEVEL_3_LAYOUT.map((position) => [position.id, position]));
    for (const position of LEVEL_3_LAYOUT) {
      for (const blockerId of position.blockedBy) {
        expect(positionById.get(blockerId)?.layer).toBeGreaterThan(position.layer);
      }
    }
  });
});

describe('Level 3 solvability verification', () => {
  it('solves the accepted fixture and returns a replayable completion path', () => {
    const level = generatedLevel(PREVALIDATED_LEVEL_3_SEED);
    const result = solveLevel(level, { maxNodes: 5_000, maxDurationMs: 5_000 });
    expect(result.status).toBe('SOLVED');
    expect(replaySolution(level, result.actions).phase).toBe('level_complete');
  }, 10_000);

  it('reports search-budget exhaustion as SEARCH_LIMIT_REACHED, not UNSOLVABLE', () => {
    const result = solveLevel(generatedLevel(1), { maxNodes: 1, maxDurationMs: 5_000 });
    expect(result).toMatchObject({ status: 'SEARCH_LIMIT_REACHED', nodes: 1 });
  });

  it('emits only exposed takes and available compositions while staying within capacity', () => {
    const level = getLevel('level-3');
    let state = createGameFromLevel(level);
    for (const action of level.winningSolution) {
      if (action.type === 'take') {
        expect(isBoardTileExposed(state, action.tileId)).toBe(true);
        state = selectBoardTile(state, action.tileId);
      } else {
        expect(findFormableBirds(state.tray).map((bird) => bird.id)).toContain(action.birdId);
        state = composeBird(state, action.birdId);
      }
      expect(state.tray.filter(Boolean).length).toBeLessThanOrEqual(TRAY_SIZE);
    }
    expect(state.phase).toBe('level_complete');
  });

  it('allows a verified path to defer composition when taking another tile is strategic', () => {
    const level = getLevel('level-3');
    let state = createGameFromLevel(level);
    let deferred = false;
    for (const action of level.winningSolution) {
      if (action.type === 'take' && findFormableBirds(state.tray).length > 0) deferred = true;
      state = action.type === 'take'
        ? selectBoardTile(state, action.tileId)
        : composeBird(state, action.birdId);
    }
    expect(deferred).toBe(true);
  });
});

describe('unchanged earlier levels', () => {
  it('preserves Level 1 and Level 2 IDs and character sequences', () => {
    expect(getLevel('level-1').tiles.map((tile) => tile.character).join(''))
      .toBe('喜鹊白鹭红隼戴胜苍鹭喜鹊白鹭苍鹭夜鹭池鹭红隼');
    expect(getLevel('level-2').tiles.map((tile) => tile.character).join(''))
      .toBe('灰喜鹊大白鹭小白鹭白头鹎黑水鸡山斑鸠树麻雀灰喜鹊大白鹭黑水鸡山斑鸠');
  });
});
