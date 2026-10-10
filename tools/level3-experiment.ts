import { describe, expect, it } from 'vitest';
import { composeBird, createGameFromLevel, selectBoardTile } from '../src/core/game';
import { generateLevel3Content } from '../src/core/level3Generator';
import type { LevelDefinition, WinningAction } from '../src/core/types';
import { EVALUATION_STRATEGIES, runStrategyTrial } from './level3Evaluation';
import { createUnverifiedLevel, replaySolution, solveLevel } from './level3Solver';

const CANDIDATE_ATTEMPTS = 100;
const SEARCH_BUDGET = { maxNodes: 5_000, maxDurationMs: 250 } as const;

function maximumTrayOccupancy(level: LevelDefinition, actions: readonly WinningAction[]): number {
  let state = createGameFromLevel(level);
  let maximum = 0;
  for (const action of actions) {
    state = action.type === 'take'
      ? selectBoardTile(state, action.tileId)
      : composeBird(state, action.birdId);
    maximum = Math.max(maximum, state.tray.filter(Boolean).length);
  }
  return maximum;
}

describe('bounded Level 3 generation experiment', () => {
  it('evaluates a fixed sequence of 100 candidate seeds', () => {
    const started = performance.now();
    let generationRejected = 0;
    let rejected = 0;
    let unknown = 0;
    let unsolvable = 0;
    const accepted: Array<{ seed: number; level: ReturnType<typeof createUnverifiedLevel>; nodes: number; durationMs: number; diversity: number; repetition: number; maxTray: number }> = [];
    const diversities: number[] = [];

    for (let seed = 1; seed <= CANDIDATE_ATTEMPTS; seed += 1) {
      const generated = generateLevel3Content(seed);
      if (!generated.ok) {
        generationRejected += 1;
        rejected += 1;
        continue;
      }
      const diversity = Object.keys(generated.value.speciesCounts).length;
      const repetition = Math.max(...Object.values(generated.value.speciesCounts));
      diversities.push(diversity);
      const level = createUnverifiedLevel(`candidate-${seed}`, `Candidate ${seed}`, generated.value.tiles);
      const result = solveLevel(level, SEARCH_BUDGET);
      if (result.status === 'SEARCH_LIMIT_REACHED') {
        unknown += 1;
      } else if (result.status === 'UNSOLVABLE') {
        unsolvable += 1;
        rejected += 1;
      } else if (replaySolution(level, result.actions).phase === 'level_complete') {
        accepted.push({
          seed,
          level,
          nodes: result.nodes,
          durationMs: result.durationMs,
          diversity,
          repetition,
          maxTray: maximumTrayOccupancy(level, result.actions),
        });
      } else {
        rejected += 1;
      }
    }

    const strategyRows = EVALUATION_STRATEGIES.map((strategy) => {
      const results = accepted.map(({ seed, level }) => runStrategyTrial(level, strategy, seed));
      const failures = results.filter((result) => !result.won);
      const average = (values: readonly number[]): number =>
        values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
      return {
        strategy,
        trials: results.length,
        winRate: `${(average(results.map((result) => Number(result.won))) * 100).toFixed(1)}%`,
        maxTray: results.length ? Math.max(...results.map((result) => result.maxTrayOccupancy)) : 0,
        averageCompositions: average(results.map((result) => result.compositions)).toFixed(2),
        averageRemainingAtFailure: average(failures.map((result) => result.remainingTiles)).toFixed(2),
      };
    });

    const totalDurationMs = performance.now() - started;
    console.table({
      generated: CANDIDATE_ATTEMPTS - generationRejected,
      solved: accepted.length,
      rejected,
      unknown,
      unsolvable,
      runtimeMs: Math.round(totalDurationMs),
      diversityMin: Math.min(...diversities),
      diversityMax: Math.max(...diversities),
      diversityAverage: (diversities.reduce((sum, value) => sum + value, 0) / diversities.length).toFixed(2),
      acceptedSeeds: accepted.slice(0, 10).map(({ seed }) => seed).join(', '),
    });
    console.table(accepted.slice(0, 10).map(({ level: _level, ...row }) => ({
      ...row,
      durationMs: row.durationMs.toFixed(1),
    })));
    console.table(strategyRows);

    expect(CANDIDATE_ATTEMPTS).toBe(100);
    expect(accepted.length + rejected + unknown).toBe(CANDIDATE_ATTEMPTS);
    expect(accepted.length).toBeGreaterThan(0);
  }, 120_000);
});
