import { nextCertifiedPuzzleId } from './puzzleBank';
import { getLevel } from './levels';
import { createGameFromLevel } from './gameEngine';
import type { GameState } from './types';

export {
  TRAY_SIZE, findFormableBirds, isTrayFull, evaluateTerminalState,
  isBoardTileExposed, getExposedBoardTiles, createGameFromLevel,
  selectBoardTile, composeBird,
} from './gameEngine';

export function createGame(levelId = 'level-1', levelSeed?: number, puzzleId?: string): GameState {
  return createGameFromLevel(getLevel(levelId, levelSeed, puzzleId));
}

export function restartLevel(state: GameState): GameState {
  return state.levelId === 'level-3'
    ? createGame(state.levelId, state.levelSeed, state.puzzleId)
    : createGame(state.levelId);
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
