import { LEGACY_GAMEPLAY_BIRD_CATALOG } from './birdCatalog';
import { nextPlayableLevel3Seed } from './level3Playable';
import { getLevel } from './levels';
import type { BirdDefinition, BoardTile, GameState, LevelDefinition, RackTile } from './types';

export const TRAY_SIZE = 10;

function countCharacters(characters: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const character of characters) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }
  return counts;
}

export function findFormableBirds(
  tray: readonly (RackTile | null)[],
  catalog: readonly BirdDefinition[] = LEGACY_GAMEPLAY_BIRD_CATALOG,
): BirdDefinition[] {
  const available = countCharacters(tray.flatMap((tile) => (tile ? [tile.character] : [])));
  return catalog.filter((bird) => {
    const needed = countCharacters(bird.characters);
    return [...needed.entries()].every(
      ([character, amount]) => (available.get(character) ?? 0) >= amount,
    );
  });
}

export function isTrayFull(tray: readonly (RackTile | null)[]): boolean {
  return tray.every(Boolean);
}

export function evaluateTerminalState(
  boardTiles: readonly BoardTile[],
  tray: readonly (RackTile | null)[],
  catalog: readonly BirdDefinition[] = LEGACY_GAMEPLAY_BIRD_CATALOG,
): GameState['phase'] {
  const boardEmpty = boardTiles.every((tile) => tile.removed);
  const trayEmpty = tray.every((tile) => tile === null);
  const hasFormableBird = findFormableBirds(tray, catalog).length > 0;

  if (boardEmpty && trayEmpty) return 'level_complete';
  if (boardEmpty) return hasFormableBird ? 'playing' : 'game_over';
  if (isTrayFull(tray)) return hasFormableBird ? 'playing' : 'game_over';
  return 'playing';
}

export function isBoardTileExposed(state: GameState, tileId: string): boolean {
  const tile = state.boardTiles.find((candidate) => candidate.id === tileId);
  if (!tile || tile.removed) return false;
  return tile.blockedBy.every((blockerId) =>
    state.boardTiles.find((candidate) => candidate.id === blockerId)?.removed === true,
  );
}

export function getExposedBoardTiles(state: GameState): BoardTile[] {
  return state.boardTiles.filter((tile) => isBoardTileExposed(state, tile.id));
}

export function createGame(levelId = 'level-1', levelSeed?: number): GameState {
  const level = getLevel(levelId, levelSeed);
  return createGameFromLevel(level);
}

export function createGameFromLevel(level: LevelDefinition): GameState {
  return {
    levelId: level.id,
    ...(level.seed === undefined ? {} : { levelSeed: level.seed }),
    activeCatalog: level.catalog ?? LEGACY_GAMEPLAY_BIRD_CATALOG,
    boardTiles: level.tiles.map((tile) => ({ ...tile, blockedBy: [...tile.blockedBy], removed: false })),
    tray: Array<RackTile | null>(TRAY_SIZE).fill(null),
    score: 0,
    completedBirdCount: 0,
    discoveredBirdIds: [],
    lastCompletedBird: null,
    phase: 'playing',
  };
}

export function selectBoardTile(state: GameState, tileId: string): GameState {
  if (
    state.phase !== 'playing' ||
    isTrayFull(state.tray) ||
    !isBoardTileExposed(state, tileId)
  ) {
    return state;
  }

  const boardTile = state.boardTiles.find((tile) => tile.id === tileId);
  if (!boardTile) return state;

  const trayIndex = state.tray.findIndex((tile) => tile === null);
  const tray = [...state.tray];
  tray[trayIndex] = { id: boardTile.id, character: boardTile.character };
  const boardTiles = state.boardTiles.map((tile) =>
    tile.id === tileId ? { ...tile, removed: true } : tile,
  );
  const phase = evaluateTerminalState(boardTiles, tray, state.activeCatalog);

  return { ...state, boardTiles, tray, lastCompletedBird: null, phase };
}

export function composeBird(
  state: GameState,
  birdId: string,
): GameState {
  if (state.phase !== 'playing') return state;
  const bird = state.activeCatalog.find((candidate) => candidate.id === birdId);
  if (!bird) return state;

  const consumed = new Set<string>();
  for (const character of bird.characters) {
    const tile = state.tray.find(
      (candidate) => candidate?.character === character && !consumed.has(candidate.id),
    );
    if (!tile) return state;
    consumed.add(tile.id);
  }

  const isNew = !state.discoveredBirdIds.includes(bird.id);
  const tray = state.tray.map((tile) => (tile && consumed.has(tile.id) ? null : tile));
  return {
    ...state,
    tray,
    score: state.score + bird.score,
    completedBirdCount: state.completedBirdCount + 1,
    discoveredBirdIds: isNew
      ? [...state.discoveredBirdIds, bird.id]
      : state.discoveredBirdIds,
    lastCompletedBird: { birdId: bird.id, score: bird.score, isNew },
    phase: evaluateTerminalState(state.boardTiles, tray, state.activeCatalog),
  };
}

export function restartLevel(state: GameState): GameState {
  return createGame(state.levelId, state.levelSeed);
}

export function advanceLevel(state: GameState): GameState {
  if (state.phase !== 'level_complete') return state;
  if (state.levelId === 'level-1') return createGame('level-2');
  if (state.levelId === 'level-2') return createGame('level-3');
  return state;
}

export function switchLevel3Board(state: GameState): GameState {
  if (state.levelId !== 'level-3') return state;
  return createGame('level-3', nextPlayableLevel3Seed(state.levelSeed));
}
