import { nextCertifiedPuzzleId } from './puzzleBank';
import { getLevel } from './levels';
import { createGameFromLevel } from './gameEngine';
import { levelFromPlaytestPuzzle, nextPlaytestPuzzle, playtestPuzzlesInGroup } from './playtestBank';
import type { GameState } from './types';

export {
  TRAY_SIZE, GAMEPLAY_RULESET_VERSION, findFormableBirds, findPlayableBirds, isTrayFull, evaluateTerminalState,
  isBoardTileExposed, getExposedBoardTiles, createGameFromLevel,
  selectBoardTile, composeBird,
} from './gameEngine';

export function createGame(levelId = 'level-1', levelSeed?: number, puzzleId?: string): GameState {
  return createGameFromLevel(getLevel(levelId, levelSeed, puzzleId));
}

export function restartLevel(state: GameState): GameState {
  if (state.experimentGroup && state.puzzleId) return createGameFromLevel(levelFromPlaytestPuzzle(state.puzzleId));
  return state.levelId === 'level-3'
    ? createGame(state.levelId, state.levelSeed, state.puzzleId)
    : createGame(state.levelId);
}

export function startExperiment(group: 'A' | 'B' | 'C', puzzleId = playtestPuzzlesInGroup(group)[0].id): GameState {
  const level = levelFromPlaytestPuzzle(puzzleId);
  if (level.experimentGroup !== group) throw new Error('Puzzle does not belong to selected experiment');
  return createGameFromLevel(level);
}

export function switchExperimentalBoard(state: GameState): GameState {
  if (!state.experimentGroup) return state;
  return startExperiment(state.experimentGroup, nextPlaytestPuzzle(state.experimentGroup, state.puzzleId).id);
}

export function advanceLevel(state: GameState): GameState {
  if (state.phase !== 'level_complete') return state;
  if (state.levelId === 'level-1') return createGame('level-2');
  if (state.levelId === 'level-2') return createGame('level-3');
  return state;
}

export function switchLevel3Board(state: GameState): GameState {
  if (state.levelId !== 'level-3') return state;
  return createGame('level-3', undefined, nextCertifiedPuzzleId(state.puzzleId));
}
