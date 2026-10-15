import { composeBird, createGameFromLevel, findPlayableBirds, getExposedBoardTiles, selectBoardTile } from '../src/core/gameEngine';
import { createSeededRandom } from '../src/core/level3Generator';
import { REGIONAL_V7_PUZZLES } from '../src/core/regionalV7Puzzles';
import type { BirdComposition, BoardTile, GameState } from '../src/core/types';

export const REGIONAL_V7_EVALUATION_VERSION = 'regional-v7-nonoracle-evaluation-1';
export const REGIONAL_V7_EVALUATION_STRATEGIES = ['random-legal', 'compose-first', 'word-seeking', 'word-cluster', 'unlock-seeking'] as const;
export type RegionalV7EvaluationStrategy = typeof REGIONAL_V7_EVALUATION_STRATEGIES[number];
export const REGIONAL_V7_EVALUATION_TRIALS = 5;
export const REGIONAL_V7_EVALUATION_ACTION_BUDGET = 180;

type Action = { type: 'take'; id: string } | { type: 'compose'; id: string };
export type EvaluationStatus = 'WIN' | 'LOSS' | 'UNKNOWN';
export type DeadlockCause = 'FULL_TRAY' | 'BOARD_EXHAUSTED' | 'NO_LEGAL_ACTION' | 'NONE';

export interface RegionalV7Trial {
  puzzleId: string;
  tier: number;
  stageIndex: number;
  strategy: RegionalV7EvaluationStrategy;
  trialIndex: number;
  seed: number;
  status: EvaluationStatus;
  deadlockCause: DeadlockCause;
  actions: number;
  remainingTiles: number;
  finalTrayOccupancy: number;
  maximumTrayOccupancy: number;
  completedNames: number;
}

function sample<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function counts(characters: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const character of characters) result.set(character, (result.get(character) ?? 0) + 1);
  return result;
}

function missingCharacters(bird: BirdComposition, tray: Readonly<Map<string, number>>): Map<string, number> {
  const missing = new Map<string, number>();
  for (const [character, quantity] of counts(bird.characters)) {
    const deficit = quantity - (tray.get(character) ?? 0);
    if (deficit > 0) missing.set(character, deficit);
  }
  return missing;
}

function chooseTarget(state: GameState, exposed: readonly BoardTile[], random: () => number): BoardTile | undefined {
  const tray = counts(state.tray.flatMap((tile) => tile ? [tile.character] : []));
  const targetOptions = state.activeCompositions.filter((bird) => state.remainingCompositionQuotas[bird.id] > 0)
    .map((bird) => ({ bird, missing: missingCharacters(bird, tray) }))
    .filter(({ missing }) => [...missing].some(([character]) => exposed.some((tile) => tile.character === character)))
    .sort((a, b) => a.missing.size - b.missing.size || b.bird.characters.length - a.bird.characters.length);
  if (targetOptions.length === 0) return exposed.length ? sample(exposed, random) : undefined;
  const target = targetOptions[0];
  const matches = exposed.filter((tile) => target.missing.has(tile.character));
  return sample(matches, random);
}

/** A distinct, non-oracle heuristic: value exposed characters by how much they
 * advance *all* still-playable words, rather than committing to one target. */
function chooseCluster(state: GameState, exposed: readonly BoardTile[], random: () => number): BoardTile | undefined {
  if (exposed.length === 0) return undefined;
  const tray = counts(state.tray.flatMap((tile) => tile ? [tile.character] : []));
  const outstanding = state.activeCompositions.filter((bird) => state.remainingCompositionQuotas[bird.id] > 0)
    .map((bird) => missingCharacters(bird, tray));
  const scored = exposed.map((tile) => ({ tile, score: outstanding.reduce((total, missing) =>
    total + (missing.has(tile.character) ? 1 / [...missing.values()].reduce((sum, value) => sum + value, 0) : 0), 0) }));
  const maximum = Math.max(...scored.map((item) => item.score));
  return sample(scored.filter((item) => item.score === maximum).map((item) => item.tile), random);
}

function chooseUnlock(state: GameState, exposed: readonly BoardTile[], random: () => number): BoardTile | undefined {
  if (exposed.length === 0) return undefined;
  const exposedIds = new Set(exposed.map((tile) => tile.id));
  const scored = exposed.map((tile) => ({ tile, unlocks: state.boardTiles.filter((candidate) =>
    !candidate.removed && !exposedIds.has(candidate.id) && candidate.blockedBy.includes(tile.id) &&
    candidate.blockedBy.every((id) => id === tile.id || state.boardTiles.find((blocker) => blocker.id === id)?.removed)).length }));
  const maximum = Math.max(...scored.map((item) => item.unlocks));
  return sample(scored.filter((item) => item.unlocks === maximum).map((item) => item.tile), random);
}

function chooseAction(state: GameState, strategy: RegionalV7EvaluationStrategy, random: () => number): Action | undefined {
  const compositions = findPlayableBirds(state);
  const exposed = state.tray.some((slot) => slot === null) ? getExposedBoardTiles(state) : [];
  const composeActions: Action[] = compositions.map((bird) => ({ type: 'compose', id: bird.id }));
  const takeActions: Action[] = exposed.map((tile) => ({ type: 'take', id: tile.id }));
  if (strategy === 'random-legal') return [...composeActions, ...takeActions].length
    ? sample([...composeActions, ...takeActions], random) : undefined;
  if (strategy === 'compose-first' || strategy === 'word-seeking' || strategy === 'word-cluster') {
    if (composeActions.length) return sample(composeActions, random);
    if (strategy === 'word-seeking') {
      const target = chooseTarget(state, exposed, random);
      return target ? { type: 'take', id: target.id } : undefined;
    }
    if (strategy === 'word-cluster') {
      const target = chooseCluster(state, exposed, random);
      return target ? { type: 'take', id: target.id } : undefined;
    }
    return takeActions.length ? sample(takeActions, random) : undefined;
  }
  if (composeActions.length && (state.tray.filter(Boolean).length >= 6 || takeActions.length === 0)) {
    return sample(composeActions, random);
  }
  const target = chooseUnlock(state, exposed, random);
  return target ? { type: 'take', id: target.id } : undefined;
}

function deadlock(state: GameState, status: EvaluationStatus): DeadlockCause {
  if (status !== 'LOSS') return 'NONE';
  if (state.tray.every(Boolean)) return 'FULL_TRAY';
  if (state.boardTiles.every((tile) => tile.removed)) return 'BOARD_EXHAUSTED';
  return 'NO_LEGAL_ACTION';
}

export function evaluateRegionalV7Trial(
  puzzle: typeof REGIONAL_V7_PUZZLES[number],
  strategy: RegionalV7EvaluationStrategy,
  trialIndex: number,
  actionBudget = REGIONAL_V7_EVALUATION_ACTION_BUDGET,
): RegionalV7Trial {
  if (!Number.isSafeInteger(trialIndex) || trialIndex < 0 || !Number.isSafeInteger(actionBudget) || actionBudget < 1) {
    throw new Error('Invalid V7 evaluation bounds');
  }
  // Never inspect the construction trace. Only board, legal vocabulary, and live state are supplied.
  const level = { ...puzzle.level, winningSolution: [] };
  const seed = puzzle.record.seed ^ Math.imul(trialIndex + 1, 0x45d9f3b) ^ 0x7153a;
  const random = createSeededRandom(seed);
  let state = createGameFromLevel(level);
  let maximumTrayOccupancy = 0;
  let actions = 0;
  while (state.phase === 'playing' && actions < actionBudget) {
    const action = chooseAction(state, strategy, random);
    if (!action) break;
    const next = action.type === 'take' ? selectBoardTile(state, action.id) : composeBird(state, action.id);
    if (next === state) throw new Error(`V7 evaluation selected illegal ${action.type}: ${action.id}`);
    state = next;
    actions++;
    maximumTrayOccupancy = Math.max(maximumTrayOccupancy, state.tray.filter(Boolean).length);
  }
  const status: EvaluationStatus = state.phase === 'level_complete' ? 'WIN'
    : state.phase === 'game_over' || (findPlayableBirds(state).length === 0 && getExposedBoardTiles(state).length === 0) ? 'LOSS' : 'UNKNOWN';
  return {
    puzzleId: puzzle.record.puzzleId, tier: puzzle.record.tier, stageIndex: puzzle.record.stageIndex,
    strategy, trialIndex, seed, status, deadlockCause: deadlock(state, status), actions,
    remainingTiles: state.boardTiles.filter((tile) => !tile.removed).length,
    finalTrayOccupancy: state.tray.filter(Boolean).length,
    maximumTrayOccupancy, completedNames: state.completedBirdCount,
  };
}

export function evaluateRegionalV7Bank(trialsPerPuzzle = REGIONAL_V7_EVALUATION_TRIALS) {
  if (!Number.isSafeInteger(trialsPerPuzzle) || trialsPerPuzzle < 1 || trialsPerPuzzle > 20) throw new Error('Invalid V7 trial count');
  const rows = REGIONAL_V7_PUZZLES.flatMap((puzzle) => REGIONAL_V7_EVALUATION_STRATEGIES.flatMap((strategy) =>
    Array.from({ length: trialsPerPuzzle }, (_, trialIndex) => evaluateRegionalV7Trial(puzzle, strategy, trialIndex))));
  const summary = [1, 2, 3, 4, 5].flatMap((tier) => REGIONAL_V7_EVALUATION_STRATEGIES.map((strategy) => {
    const subset = rows.filter((row) => row.tier === tier && row.strategy === strategy);
    return { tier, strategy, trials: subset.length, wins: subset.filter((row) => row.status === 'WIN').length,
      losses: subset.filter((row) => row.status === 'LOSS').length,
      unknown: subset.filter((row) => row.status === 'UNKNOWN').length,
      fullTrayDeadlocks: subset.filter((row) => row.deadlockCause === 'FULL_TRAY').length,
      boardExhaustedDeadlocks: subset.filter((row) => row.deadlockCause === 'BOARD_EXHAUSTED').length,
      maxTrayOccupancy: Math.max(...subset.map((row) => row.maximumTrayOccupancy)) };
  }));
  const d5PuzzleSummary = REGIONAL_V7_PUZZLES.filter((puzzle) => puzzle.record.tier === 5).map((puzzle) => ({
    stageIndex: puzzle.record.stageIndex,
    puzzleId: puzzle.record.puzzleId,
    strategies: REGIONAL_V7_EVALUATION_STRATEGIES.map((strategy) => {
      const subset = rows.filter((row) => row.puzzleId === puzzle.record.puzzleId && row.strategy === strategy);
      return { strategy, wins: subset.filter((row) => row.status === 'WIN').length,
        losses: subset.filter((row) => row.status === 'LOSS').length,
        unknown: subset.filter((row) => row.status === 'UNKNOWN').length,
        fullTrayDeadlocks: subset.filter((row) => row.deadlockCause === 'FULL_TRAY').length,
        furthestCompletedNames: Math.max(...subset.map((row) => row.completedNames)),
        minimumRemainingTiles: Math.min(...subset.map((row) => row.remainingTiles)) };
    }),
  }));
  return { version: REGIONAL_V7_EVALUATION_VERSION, actionBudget: REGIONAL_V7_EVALUATION_ACTION_BUDGET,
    trialsPerPuzzle, strategyCount: REGIONAL_V7_EVALUATION_STRATEGIES.length, rows, summary, d5PuzzleSummary };
}
