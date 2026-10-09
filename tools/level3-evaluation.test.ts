import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import {
  composeBird,
  createGame,
  findFormableBirds,
  getExposedBoardTiles,
  selectBoardTile,
} from '../src/core/game';
import { getLevel } from '../src/core/levels';
import type { BirdDefinition, GameState } from '../src/core/types';

type Strategy = 'random' | 'shortest' | 'highest' | 'expose' | 'lookahead';

interface TrialResult {
  won: boolean;
  maxTrayOccupancy: number;
  averageTrayOccupancy: number;
  compositions: number;
  remainingBoardTiles: number;
}

interface EvaluationRow {
  strategy: string;
  trials: number;
  winRate: string;
  maxTray: number;
  averageTray: string;
  averageCompositions: string;
  averageRemainingAtFailure: string;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function choose<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
}

function trayCount(state: GameState): number {
  return state.tray.filter(Boolean).length;
}

function characterCounts(state: GameState, extraCharacter?: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tile of state.tray) {
    if (tile) counts.set(tile.character, (counts.get(tile.character) ?? 0) + 1);
  }
  if (extraCharacter) {
    counts.set(extraCharacter, (counts.get(extraCharacter) ?? 0) + 1);
  }
  return counts;
}

function missingCharacters(bird: BirdDefinition, counts: Map<string, number>): number {
  const available = new Map(counts);
  let missing = 0;
  for (const character of bird.characters) {
    const amount = available.get(character) ?? 0;
    if (amount > 0) available.set(character, amount - 1);
    else missing += 1;
  }
  return missing;
}

function bestBy<T>(values: readonly T[], score: (value: T) => number, random: () => number): T {
  const scored = values.map((value) => ({ value, score: score(value) }));
  const best = Math.max(...scored.map((item) => item.score));
  return choose(scored.filter((item) => item.score === best).map((item) => item.value), random);
}

function heuristic(state: GameState): number {
  if (state.phase === 'level_complete') return 100_000;
  if (state.phase === 'game_over') return -100_000 - state.boardTiles.filter((tile) => !tile.removed).length;
  const formableValue = findFormableBirds(state.tray).reduce(
    (highest, bird) => Math.max(highest, bird.score),
    0,
  );
  return state.score * 4
    + formableValue * 5
    + getExposedBoardTiles(state).length * 2
    - trayCount(state) * 18
    - state.boardTiles.filter((tile) => !tile.removed).length;
}

function lookaheadValue(state: GameState, depth: number): number {
  if (depth === 0 || state.phase !== 'playing') return heuristic(state);
  const nextStates = [
    ...findFormableBirds(state.tray).map((bird) => composeBird(state, bird.id)),
    ...getExposedBoardTiles(state).map((tile) => selectBoardTile(state, tile.id)),
  ].filter((next) => next !== state);
  if (nextStates.length === 0) return heuristic(state);
  return Math.max(...nextStates.map((next) => lookaheadValue(next, depth - 1)));
}

function selectBird(
  formable: readonly BirdDefinition[],
  strategy: Strategy,
  random: () => number,
): BirdDefinition {
  if (strategy === 'random') return choose(formable, random);
  if (strategy === 'shortest') {
    return bestBy(formable, (bird) => -bird.characters.length, random);
  }
  return bestBy(formable, (bird) => bird.score, random);
}

function selectTile(state: GameState, strategy: Strategy, random: () => number): string {
  const exposed = getExposedBoardTiles(state);
  if (strategy === 'random') return choose(exposed, random).id;

  if (strategy === 'shortest') {
    return bestBy(exposed, (tile) => {
      const counts = characterCounts(state, tile.character);
      return Math.max(...BIRD_CATALOG.map((bird) =>
        -missingCharacters(bird, counts) * 100 - bird.characters.length * 10,
      ));
    }, random).id;
  }

  if (strategy === 'highest') {
    return bestBy(exposed, (tile) => {
      const counts = characterCounts(state, tile.character);
      return Math.max(...BIRD_CATALOG.map((bird) =>
        bird.score * 10 - missingCharacters(bird, counts) * 100,
      ));
    }, random).id;
  }

  if (strategy === 'expose') {
    const before = new Set(exposed.map((tile) => tile.id));
    return bestBy(exposed, (tile) => {
      const next = selectBoardTile(state, tile.id);
      return getExposedBoardTiles(next).filter((candidate) => !before.has(candidate.id)).length;
    }, random).id;
  }

  const candidates = exposed
    .map((tile) => ({ tile, state: selectBoardTile(state, tile.id) }))
    .sort((first, second) => heuristic(second.state) - heuristic(first.state))
    .slice(0, 6);
  return bestBy(candidates, (candidate) => lookaheadValue(candidate.state, 1), random).tile.id;
}

function runTrial(strategy: Strategy, seed: number): TrialResult {
  const random = seededRandom(seed);
  let state = createGame('level-3');
  const occupancies = [0];
  let maxTrayOccupancy = 0;
  let compositions = 0;

  for (let action = 0; action < 300 && state.phase === 'playing'; action += 1) {
    const formable = findFormableBirds(state.tray);
    if (formable.length > 0) {
      state = composeBird(state, selectBird(formable, strategy, random).id);
      compositions += 1;
    } else {
      const exposed = getExposedBoardTiles(state);
      if (exposed.length === 0) break;
      state = selectBoardTile(state, selectTile(state, strategy, random));
    }
    const occupancy = trayCount(state);
    occupancies.push(occupancy);
    maxTrayOccupancy = Math.max(maxTrayOccupancy, occupancy);
  }

  return {
    won: state.phase === 'level_complete',
    maxTrayOccupancy,
    averageTrayOccupancy: occupancies.reduce((sum, value) => sum + value, 0) / occupancies.length,
    compositions,
    remainingBoardTiles: state.boardTiles.filter((tile) => !tile.removed).length,
  };
}

function evaluate(strategy: Strategy, trials: number): EvaluationRow {
  const results = Array.from({ length: trials }, (_, index) => runTrial(strategy, index + 1));
  const failures = results.filter((result) => !result.won);
  const average = (values: readonly number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const labels: Record<Strategy, string> = {
    random: 'A Random + opportunistic compose',
    shortest: 'B Prefer shortest bird',
    highest: 'C Prefer highest score',
    expose: 'D Maximize newly exposed tiles',
    lookahead: 'E Two-ply lookahead',
  };

  return {
    strategy: labels[strategy],
    trials,
    winRate: `${((results.filter((result) => result.won).length / trials) * 100).toFixed(1)}%`,
    maxTray: Math.max(...results.map((result) => result.maxTrayOccupancy)),
    averageTray: average(results.map((result) => result.averageTrayOccupancy)).toFixed(2),
    averageCompositions: average(results.map((result) => result.compositions)).toFixed(2),
    averageRemainingAtFailure: average(failures.map((result) => result.remainingBoardTiles)).toFixed(2),
  };
}

function authoredMaximumTrayOccupancy(): number {
  let state = createGame('level-3');
  let maximum = 0;
  for (const action of getLevel('level-3').winningSolution) {
    state = action.type === 'take'
      ? selectBoardTile(state, action.tileId)
      : composeBird(state, action.birdId);
    maximum = Math.max(maximum, trayCount(state));
  }
  if (state.phase !== 'level_complete') throw new Error('Authored Level 3 path did not complete');
  return maximum;
}

describe('Level 3 offline difficulty evaluation', () => {
  it('is deterministic for fixed seeds and prints empirical strategy results', () => {
    expect(runTrial('random', 17)).toEqual(runTrial('random', 17));
    expect(runTrial('lookahead', 9)).toEqual(runTrial('lookahead', 9));

    const rows = [
      evaluate('random', 64),
      evaluate('shortest', 32),
      evaluate('highest', 32),
      evaluate('expose', 32),
      evaluate('lookahead', 8),
    ];
    console.log(`Authored winning path maximum tray occupancy: ${authoredMaximumTrayOccupancy()}/10`);
    console.table(rows);
    expect(rows).toHaveLength(5);
  }, 20_000);
});
