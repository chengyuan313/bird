import { BIRD_CATALOG, CATALOG_CHARACTER_POOL } from './birdCatalog';
import { createWeightedOffer, normalizeSeed } from './rng';
import type { BirdDefinition, GameState, RackTile } from './types';

export const RACK_SIZE = 10;

function countCharacters(characters: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const character of characters) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }
  return counts;
}
export function findFormableBirds(
  rack: readonly (RackTile | null)[],
  catalog: readonly BirdDefinition[] = BIRD_CATALOG,
): BirdDefinition[] {
  const available = countCharacters(
    rack.flatMap((tile) => (tile ? [tile.character] : [])),
  );

  return catalog.filter((bird) => {
    const needed = countCharacters(bird.characters);
    return [...needed.entries()].every(
      ([character, amount]) => (available.get(character) ?? 0) >= amount,
    );
  });
}

export function isRackFull(rack: readonly (RackTile | null)[]): boolean {
  return rack.every(Boolean);
}

export function createGame(seed = Date.now()): GameState {
  const normalizedSeed = normalizeSeed(seed);
  const generated = createWeightedOffer(normalizedSeed, CATALOG_CHARACTER_POOL);
  return {
    seed: normalizedSeed,
    rngState: generated.rngState,
    rack: Array<RackTile | null>(RACK_SIZE).fill(null),
    currentOffer: generated.offer,
    selectedRackTileIds: [],
    score: 0,
    discoveredBirdIds: [],
    lastCompletedBird: null,
    phase: 'playing',
    nextTileId: 1,
  };
}

export function chooseOfferCharacter(state: GameState, character: string): GameState {
  if (
    state.phase !== 'playing' ||
    isRackFull(state.rack) ||
    !state.currentOffer.includes(character)
  ) {
    return state;
  }

  const slotIndex = state.rack.findIndex((tile) => tile === null);
  const rack = [...state.rack];
  rack[slotIndex] = { id: `tile-${state.nextTileId}`, character };
  const generated = createWeightedOffer(state.rngState, CATALOG_CHARACTER_POOL);
  const phase =
    isRackFull(rack) && findFormableBirds(rack).length === 0 ? 'game_over' : 'playing';

  return {
    ...state,
    rack,
    currentOffer: generated.offer,
    rngState: generated.rngState,
    lastCompletedBird: null,
    phase,
    nextTileId: state.nextTileId + 1,
  };
}

export function toggleRackTile(state: GameState, tileId: string): GameState {
  if (state.phase !== 'playing' || !state.rack.some((tile) => tile?.id === tileId)) {
    return state;
  }

  const selected = state.selectedRackTileIds;
  return {
    ...state,
    selectedRackTileIds: selected.includes(tileId)
      ? selected.filter((id) => id !== tileId)
      : [...selected, tileId],
  };
}

export function clearSelection(state: GameState): GameState {
  return state.selectedRackTileIds.length === 0
    ? state
    : { ...state, selectedRackTileIds: [] };
}

export function getSelectedCharacters(state: GameState): string[] {
  return state.selectedRackTileIds.flatMap((id) => {
    const tile = state.rack.find((candidate) => candidate?.id === id);
    return tile ? [tile.character] : [];
  });
}

export function getSelectedBird(
  state: GameState,
  catalog: readonly BirdDefinition[] = BIRD_CATALOG,
): BirdDefinition | undefined {
  const sequence = getSelectedCharacters(state).join('');
  return catalog.find((bird) => bird.name === sequence);
}

export function composeSelectedBird(state: GameState): GameState {
  if (state.phase !== 'playing') return state;
  const bird = getSelectedBird(state);
  if (!bird) return state;

  const consumed = new Set(state.selectedRackTileIds);
  const isNew = !state.discoveredBirdIds.includes(bird.id);
  return {
    ...state,
    rack: state.rack.map((tile) => (tile && consumed.has(tile.id) ? null : tile)),
    selectedRackTileIds: [],
    score: state.score + bird.score,
    discoveredBirdIds: isNew
      ? [...state.discoveredBirdIds, bird.id]
      : state.discoveredBirdIds,
    lastCompletedBird: { birdId: bird.id, score: bird.score, isNew },
    phase: 'playing',
  };
}

export function restartGame(state: GameState): GameState {
  return createGame(state.seed);
}
