import { LEGACY_GAMEPLAY_SPECIES_CATALOG } from './birdCatalog';
import { GLOBAL_BIRD_COMPOSITIONS } from './recognitionRegistry';
import type { BirdComposition, BoardTile, GameState, LevelDefinition, RackTile } from './types';

export const TRAY_SIZE = 10;
export const GAMEPLAY_RULESET_VERSION = 'puzzle-word-quotas-v5.3.1';

function countCharacters(characters: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const character of characters) counts.set(character, (counts.get(character) ?? 0) + 1);
  return counts;
}

export function findFormableBirds(
  tray: readonly (RackTile | null)[],
  compositions: readonly BirdComposition[] = GLOBAL_BIRD_COMPOSITIONS,
  remainingQuotas?: Readonly<Record<string, number>>,
): BirdComposition[] {
  const available = countCharacters(tray.flatMap((tile) => (tile ? [tile.character] : [])));
  return compositions.filter((composition) => {
    if (remainingQuotas && !(remainingQuotas[composition.id] > 0)) return false;
    const needed = countCharacters(composition.characters);
    return [...needed.entries()].every(
      ([character, amount]) => (available.get(character) ?? 0) >= amount,
    );
  });
}

export function findPlayableBirds(state: GameState): BirdComposition[] {
  return state.phase === 'playing'
    ? findFormableBirds(state.tray, state.activeCompositions, state.remainingCompositionQuotas)
    : [];
}

export function isTrayFull(tray: readonly (RackTile | null)[]): boolean {
  return tray.every(Boolean);
}

export function evaluateTerminalState(
  boardTiles: readonly BoardTile[],
  tray: readonly (RackTile | null)[],
  compositions: readonly BirdComposition[],
  remainingQuotas: Readonly<Record<string, number>>,
): GameState['phase'] {
  const boardEmpty = boardTiles.every((tile) => tile.removed);
  const trayEmpty = tray.every((tile) => tile === null);
  const hasFormableBird = findFormableBirds(tray, compositions, remainingQuotas).length > 0;
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

export function createGameFromLevel(level: LevelDefinition): GameState {
  const witnessWords = level.winningSolution.filter((action) => action.type === 'compose').map((action) => action.birdId);
  const occurrences = level.wordOccurrences ?? witnessWords;
  if (occurrences.length === 0 || (level.wordOccurrences && witnessWords.length > 0 && (occurrences.length !== witnessWords.length
    || occurrences.some((id, index) => id !== witnessWords[index])))) {
    throw new Error(`Invalid puzzle word occurrences: ${level.id}`);
  }
  const registry = new Map(GLOBAL_BIRD_COMPOSITIONS.map((bird) => [bird.id, bird]));
  const quotas: Record<string, number> = {};
  for (const id of occurrences) {
    if (!registry.has(id)) throw new Error(`Unknown puzzle composition: ${id}`);
    quotas[id] = (quotas[id] ?? 0) + 1;
  }
  const expected = occurrences.flatMap((id) => registry.get(id)!.characters).sort().join('');
  if (expected !== level.tiles.map((tile) => tile.character).sort().join('')) {
    throw new Error(`Puzzle word characters do not match tiles: ${level.id}`);
  }
  const activeCompositions = [...new Set(occurrences)].map((id) => registry.get(id)!);
  return {
    levelId: level.id,
    ...(level.seed === undefined ? {} : { levelSeed: level.seed }),
    ...(level.puzzleId === undefined ? {} : { puzzleId: level.puzzleId }),
    ...(level.experimentGroup === undefined ? {} : { experimentGroup: level.experimentGroup }),
    activeCatalog: level.catalog ?? LEGACY_GAMEPLAY_SPECIES_CATALOG,
    activeCompositions,
    gameplayRulesetVersion: GAMEPLAY_RULESET_VERSION,
    compositionQuotas: Object.freeze({ ...quotas }),
    remainingCompositionQuotas: { ...quotas },
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
  if (state.phase !== 'playing' || isTrayFull(state.tray) || !isBoardTileExposed(state, tileId)) return state;
  const boardTile = state.boardTiles.find((tile) => tile.id === tileId);
  if (!boardTile) return state;
  const trayIndex = state.tray.findIndex((tile) => tile === null);
  const tray = [...state.tray];
  tray[trayIndex] = { id: boardTile.id, character: boardTile.character };
  const boardTiles = state.boardTiles.map((tile) =>
    tile.id === tileId ? { ...tile, removed: true } : tile,
  );
  const phase = evaluateTerminalState(boardTiles, tray, state.activeCompositions, state.remainingCompositionQuotas);
  return { ...state, boardTiles, tray, lastCompletedBird: null, phase };
}

export function composeBird(state: GameState, birdId: string): GameState {
  if (state.phase !== 'playing') return state;
  if (!(state.remainingCompositionQuotas[birdId] > 0)) return state;
  const bird = state.activeCompositions.find((candidate) => candidate.id === birdId);
  if (!bird) return state;
  const consumed = new Set<string>();
  for (const character of bird.characters) {
    const tile = state.tray.find(
      (candidate) => candidate?.character === character && !consumed.has(candidate.id),
    );
    if (!tile) return state;
    consumed.add(tile.id);
  }
  const isNew = bird.speciesId !== null && !state.discoveredBirdIds.includes(bird.speciesId);
  const tray = state.tray.map((tile) => (tile && consumed.has(tile.id) ? null : tile));
  const remainingCompositionQuotas = { ...state.remainingCompositionQuotas, [birdId]: state.remainingCompositionQuotas[birdId] - 1 };
  return {
    ...state,
    tray,
    remainingCompositionQuotas,
    score: state.score + bird.score,
    completedBirdCount: state.completedBirdCount + 1,
    discoveredBirdIds: isNew && bird.speciesId !== null
      ? [...state.discoveredBirdIds, bird.speciesId]
      : state.discoveredBirdIds,
    lastCompletedBird: { birdId: bird.id, score: bird.score, isNew },
    phase: evaluateTerminalState(state.boardTiles, tray, state.activeCompositions, remainingCompositionQuotas),
  };
}
