import { composeBird, createGameFromLevel, findPlayableBirds, getExposedBoardTiles, selectBoardTile } from '../src/core/gameEngine';
import { createSeededRandom, fisherYates } from '../src/core/level3Generator';
import { boardHash, sha256Hex } from '../src/core/puzzleIdentity';
import { levelFromRegionalV7Record, type RegionalV7PuzzleRecord } from '../src/core/regionalV7Generator';
import { REGIONAL_V7_PUZZLES, type RegionalV7Puzzle } from '../src/core/regionalV7Puzzles';
import type { BirdComposition, GameState, WinningAction } from '../src/core/types';
import { evaluateRegionalV7Trial } from './evaluateRegionalV7Difficulty';

export const REGIONAL_V7_RESCUE_VERSION = 'regional-v7-rescue-experiment-1';
export const RESCUE_FORWARD_BUDGET = 180;
export const RESCUE_UNDO_BUDGET = 20;
export const RESCUE_TRIALS_PER_PUZZLE = 5;
export const RESCUE_CANDIDATES_PER_PUZZLE = 8;
const D5 = REGIONAL_V7_PUZZLES.filter((puzzle) => puzzle.record.tier === 5);

function missing(bird: BirdComposition, tray: readonly string[]): Map<string, number> {
  const needed = new Map<string, number>();
  for (const character of bird.characters) needed.set(character, (needed.get(character) ?? 0) + 1);
  for (const character of tray) needed.set(character, Math.max(0, (needed.get(character) ?? 0) - 1));
  return needed;
}

/** Only exposed characters, current tray, and remaining quotas influence choices.
 * Random tie breaks never use tile IDs, hidden characters, or certificate order. */
function rankedVisibleActions(state: GameState, random: () => number, strategy: 'word-seeking' | 'word-cluster'): WinningAction[] {
  const formable = fisherYates(findPlayableBirds(state), random);
  const compose = formable.map((bird): WinningAction => ({ type: 'compose', birdId: bird.id }));
  if (state.tray.every(Boolean)) return compose;
  const exposed = fisherYates(getExposedBoardTiles(state), random);
  const tray = state.tray.flatMap((tile) => tile ? [tile.character] : []);
  const targets = state.activeCompositions.filter((bird) => state.remainingCompositionQuotas[bird.id] > 0)
    .map((bird) => ({ bird, needed: missing(bird, tray) }))
    .filter(({ needed }) => [...needed].some(([character, quantity]) => quantity > 0 && exposed.some((tile) => tile.character === character)))
    .sort((a, b) => [...a.needed.values()].reduce((sum, value) => sum + value, 0) -
      [...b.needed.values()].reduce((sum, value) => sum + value, 0));
  const target = targets[0];
  const takes = exposed.map((tile) => ({ tile, relevant: strategy === 'word-seeking'
    ? target && (target.needed.get(tile.character) ?? 0) > 0 ? 1 : 0
    : targets.reduce((total, option) => total + (option.needed.get(tile.character) ?? 0) /
      Math.max(1, [...option.needed.values()].reduce((sum, value) => sum + value, 0)), 0) }))
    .sort((a, b) => b.relevant - a.relevant)
    .map(({ tile }): WinningAction => ({ type: 'take', tileId: tile.id }));
  return [...compose, ...takes];
}

function apply(state: GameState, action: WinningAction): GameState {
  return action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
}

export interface UndoTrial {
  stageIndex: number;
  trialIndex: number;
  status: 'WIN' | 'LOSS' | 'UNKNOWN';
  forwardActions: number;
  undos: number;
  finalTray: number;
  remainingTiles: number;
  deadlockCause: 'FULL_TRAY' | 'BOARD_EXHAUSTED' | 'NO_ALTERNATE' | 'NONE';
}

export function tryVisibleUndo(puzzle: RegionalV7Puzzle, trialIndex: number,
  strategy: 'word-seeking' | 'word-cluster' = 'word-seeking'): UndoTrial {
  if (!Number.isSafeInteger(trialIndex) || trialIndex < 0) throw new Error('Invalid rescue trial');
  const level = { ...puzzle.level, winningSolution: [] };
  const random = createSeededRandom(puzzle.record.seed ^ Math.imul(trialIndex + 1, 0x61c88647) ^ 0x755d);
  let state = createGameFromLevel(level);
  const history: Array<{ before: GameState; alternatives: WinningAction[] }> = [];
  let forwardActions = 0;
  let undos = 0;
  let lastDeadlock: UndoTrial['deadlockCause'] = 'NONE';
  while (state.phase !== 'level_complete' && forwardActions < RESCUE_FORWARD_BUDGET) {
    if (state.phase === 'game_over') {
      lastDeadlock = state.tray.every(Boolean) ? 'FULL_TRAY' : state.boardTiles.every((tile) => tile.removed) ? 'BOARD_EXHAUSTED' : 'NO_ALTERNATE';
    }
    const latest = history.at(-1);
    if (state.phase === 'game_over' || (state.phase === 'playing' && rankedVisibleActions(state, random, strategy).length === 0)) {
      if (!latest || undos >= RESCUE_UNDO_BUDGET) break;
      state = latest.before;
      history.pop();
      undos++;
      if (latest.alternatives.length > 0) {
        const action = latest.alternatives.shift()!;
        history.push({ before: state, alternatives: latest.alternatives });
        const next = apply(state, action);
        if (next === state) throw new Error('Illegal rescue alternate');
        state = next;
        forwardActions++;
      }
      continue;
    }
    const options = rankedVisibleActions(state, random, strategy);
    if (options.length === 0) break;
    const [action, ...alternatives] = options;
    history.push({ before: state, alternatives });
    const next = apply(state, action);
    if (next === state) throw new Error('Illegal rescue action');
    state = next;
    forwardActions++;
  }
  const status = state.phase === 'level_complete' ? 'WIN' : forwardActions >= RESCUE_FORWARD_BUDGET && state.phase === 'playing' ? 'UNKNOWN' : 'LOSS';
  return { stageIndex: puzzle.record.stageIndex, trialIndex, status, forwardActions, undos,
    finalTray: state.tray.filter(Boolean).length, remainingTiles: state.boardTiles.filter((tile) => !tile.removed).length,
    deadlockCause: status === 'LOSS' ? lastDeadlock === 'NONE' ? 'NO_ALTERNATE' : lastDeadlock : 'NONE' };
}

/** Construction may use the certified word multiset and take order, but strategy
 * evaluation always strips the witness. This creates unpublished candidates only. */
export function createMemoryCandidate(puzzle: RegionalV7Puzzle, candidateIndex: number): RegionalV7Puzzle {
  if (!Number.isSafeInteger(candidateIndex) || candidateIndex < 0 || candidateIndex >= RESCUE_CANDIDATES_PER_PUZZLE) {
    throw new Error('Invalid rescue candidate');
  }
  const words = fisherYates(puzzle.record.wordOccurrences,
    createSeededRandom(puzzle.record.seed ^ Math.imul(candidateIndex + 1, 0x9e3779b1) ^ 0x75c5));
  const wordById = new Map(puzzle.level.compositions!.map((bird) => [bird.id, bird]));
  const sequence = words.flatMap((id) => wordById.get(id)!.characters);
  const orderedIds = puzzle.record.takeOrder.map((index) => puzzle.level.tiles[index].id);
  const byTileId = new Map(orderedIds.map((id, index) => [id, sequence[index]]));
  const tiles = puzzle.level.tiles.map((tile) => ({ ...tile, character: byTileId.get(tile.id)! }));
  const hash = boardHash(tiles);
  const puzzleId = `regional-v7-rescue:${sha256Hex(JSON.stringify([REGIONAL_V7_RESCUE_VERSION,
    puzzle.record.puzzleId, candidateIndex, hash, words]))}`;
  const record: RegionalV7PuzzleRecord = { ...puzzle.record, puzzleId, boardHash: hash,
    characters: tiles.map((tile) => tile.character).join(''), wordOccurrences: words };
  const level = levelFromRegionalV7Record(record);
  if (boardHash(level.tiles) !== hash || level.tiles.length !== puzzle.level.tiles.length) throw new Error('Rescue board mismatch');
  if (words.slice().sort().join('|') !== puzzle.record.wordOccurrences.slice().sort().join('|')) throw new Error('Rescue quota mismatch');
  let state = createGameFromLevel(level);
  for (const action of level.winningSolution) {
    const next = apply(state, action);
    if (next === state) throw new Error('Invalid rescue construction certificate');
    state = next;
  }
  if (state.phase !== 'level_complete') throw new Error('Uncertified rescue candidate');
  return { record, level };
}

export function experimentRegionalV7Rescue() {
  const started = performance.now();
  const originalUndo = D5.flatMap((puzzle) => Array.from({ length: RESCUE_TRIALS_PER_PUZZLE }, (_, trialIndex) =>
    tryVisibleUndo(puzzle, trialIndex)));
  const rearranged = D5.map((puzzle) => {
    const stageStarted = performance.now();
    const candidates = Array.from({ length: RESCUE_CANDIDATES_PER_PUZZLE }, (_, candidateIndex) => {
      const candidate = createMemoryCandidate(puzzle, candidateIndex);
      const train = Array.from({ length: RESCUE_TRIALS_PER_PUZZLE }, (_, trialIndex) =>
        evaluateRegionalV7Trial(candidate, 'word-seeking', trialIndex));
      return { candidateIndex, puzzleId: candidate.record.puzzleId, boardHash: candidate.record.boardHash,
        candidate, trainWins: train.filter((trial) => trial.status === 'WIN').length };
    });
    const selected = candidates.sort((a, b) => b.trainWins - a.trainWins || a.candidateIndex - b.candidateIndex)[0];
    const holdout = Array.from({ length: RESCUE_TRIALS_PER_PUZZLE }, (_, trialIndex) =>
      evaluateRegionalV7Trial(selected.candidate, 'word-seeking', trialIndex + RESCUE_TRIALS_PER_PUZZLE));
    return { stageIndex: puzzle.record.stageIndex, candidates: RESCUE_CANDIDATES_PER_PUZZLE,
      uniqueBoardHashes: new Set(candidates.map((candidate) => candidate.boardHash)).size,
      evaluationMs: performance.now() - stageStarted,
      selectedIndex: selected.candidateIndex, selectedPuzzleId: selected.puzzleId, selectedHash: selected.boardHash,
      trainWins: selected.trainWins, holdoutWins: holdout.filter((trial) => trial.status === 'WIN').length,
      holdoutLosses: holdout.filter((trial) => trial.status === 'LOSS').length,
      holdoutUnknown: holdout.filter((trial) => trial.status === 'UNKNOWN').length,
      holdoutFullTrayDeadlocks: holdout.filter((trial) => trial.deadlockCause === 'FULL_TRAY').length };
  });
  return { version: REGIONAL_V7_RESCUE_VERSION, durationMs: performance.now() - started,
    limits: { forwardActions: RESCUE_FORWARD_BUDGET, undos: RESCUE_UNDO_BUDGET,
      candidatesPerPuzzle: RESCUE_CANDIDATES_PER_PUZZLE, trialsPerPuzzle: RESCUE_TRIALS_PER_PUZZLE },
    candidateCount: D5.length * RESCUE_CANDIDATES_PER_PUZZLE,
    trainingTrialCount: D5.length * RESCUE_CANDIDATES_PER_PUZZLE * RESCUE_TRIALS_PER_PUZZLE,
    holdoutTrialCount: D5.length * RESCUE_TRIALS_PER_PUZZLE,
    originalUndo, originalUndoWins: originalUndo.filter((row) => row.status === 'WIN').length,
    rearranged, holdoutWins: rearranged.reduce((total, row) => total + row.holdoutWins, 0),
    passesHumanPrototypeGate: rearranged.reduce((total, row) => total + row.holdoutWins, 0) >= 13 &&
      rearranged.every((row) => row.holdoutWins >= 1) };
}
