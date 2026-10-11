export type GamePhase = 'playing' | 'game_over' | 'level_complete';

export interface BirdDefinition {
  id: string;
  name: string;
  characters: readonly string[];
  characterCount: number;
  score: number;
  assetKey: string;
  scientificName: string;
  family: string;
  source: string;
  aliases?: readonly string[];
  legacyOnly?: boolean;
  canonicalBirdId?: string;
}

/** A playable spelling; multiple spellings may identify the same species. */
export interface BirdComposition {
  id: string;
  classification: 'canonical' | 'alias' | 'group';
  speciesId: string | null;
  name: string;
  characters: readonly string[];
  score: number;
  assetKey: string;
  provenance: string;
}
export interface RackTile {
  id: string;
  character: string;
}

export type TileRegion = 'main' | 'auxiliary' | 'blind';

export interface BoardTileDefinition {
  id: string;
  character: string;
  layer: number;
  x: number;
  y: number;
  blockedBy: readonly string[];
  region?: TileRegion;
}

export interface BoardTile extends BoardTileDefinition {
  removed: boolean;
}

export type WinningAction =
  | { type: 'take'; tileId: string }
  | { type: 'compose'; birdId: string };

export interface LevelDefinition {
  id: string;
  label: string;
  seed?: number;
  puzzleId?: string;
  catalog?: readonly BirdDefinition[];
  compositions?: readonly BirdComposition[];
  tiles: readonly BoardTileDefinition[];
  winningSolution: readonly WinningAction[];
}

export interface CompletedBird {
  birdId: string;
  score: number;
  isNew: boolean;
}

export interface GameState {
  levelId: string;
  levelSeed?: number;
  puzzleId?: string;
  activeCatalog: readonly BirdDefinition[];
  activeCompositions: readonly BirdComposition[];
  boardTiles: BoardTile[];
  tray: Array<RackTile | null>;
  score: number;
  completedBirdCount: number;
  /** Biological species IDs, not playable-spelling IDs. */
  discoveredBirdIds: string[];
  lastCompletedBird: CompletedBird | null;
  phase: GamePhase;
}
