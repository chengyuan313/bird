import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import { FUTURE_90_TILE_CONSTRAINTS, sampleBirdContent } from '../src/core/contentSampler';
import { createPlayableLevel3, PLAYABLE_LEVEL_3_SEEDS } from '../src/core/level3Playable';
import { PIACHAN_POSITIONS } from '../src/preview/piachanLayout';
import { replaySolution, solveLevel } from './level3Solver';
import { createGame, getExposedBoardTiles, selectBoardTile } from '../src/core/game';
import { createSeededRandom } from '../src/core/level3Generator';

describe('bounded Piachan Level 3 seed verification', () => {
  it.each(PLAYABLE_LEVEL_3_SEEDS)('validates seed %s through the game engine', (seed) => {
    const sampled = sampleBirdContent(seed, FUTURE_90_TILE_CONSTRAINTS);
    expect(sampled.ok).toBe(true);
    if (!sampled.ok) return;
    const level = createPlayableLevel3(seed);
    expect(level.tiles).toHaveLength(90);
    expect(level.tiles.map((tile) => tile.id)).toEqual(PIACHAN_POSITIONS.map((tile) => tile.id));
    expect(level.catalog?.length).toBeGreaterThanOrEqual(20);
    expect(level.catalog?.length).toBeLessThanOrEqual(35);
    expect(level.catalog?.every((bird) => BIRD_CATALOG.includes(bird))).toBe(true);
    expect([...level.tiles.map((tile) => tile.character)].sort())
      .toEqual([...sampled.value.characters].sort());
    const result = solveLevel(level, { maxNodes: 10_000, maxDurationMs: 2_000 });
    expect(result.status).toBe('SOLVED');
    expect(replaySolution(level, result.actions).phase).toBe('level_complete');
    console.log(JSON.stringify({ seed, status: result.status, nodes: result.nodes, durationMs: Math.round(result.durationMs), species: level.catalog?.length, actions: result.actions.length }));
  }, 10_000);
});

describe('bounded loss-path search', () => {
  it('finds a real ten-tile defeat for browser QA', () => {
    let loss: string[] | undefined;
    for (let attempt = 0; attempt < 200 && !loss; attempt += 1) {
      const random = createSeededRandom(attempt + 9000);
      let state = createGame('level-3', 1);
      const taken: string[] = [];
      for (let step = 0; step < 10 && state.phase === 'playing'; step += 1) {
        const exposed = getExposedBoardTiles(state);
        const chosen = exposed[Math.floor(random() * exposed.length)];
        taken.push(chosen.id);
        state = selectBoardTile(state, chosen.id);
      }
      if (state.phase === 'game_over') loss = taken;
    }
    expect(loss).toBeDefined();
    console.log('LOSS', loss?.join(' '));
  }, 10_000);
});
