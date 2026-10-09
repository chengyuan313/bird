export type GamePhase = 'playing' | 'game_over' | 'level_complete';

export interface BirdDefinition {
  id: string;
  name: string;
  characters: readonly string[];
  score: number;
  assetKey: string;
}
export interface RackTile {
  id: string;
  character: string;
}

export interface BoardTileDefinition {
  id: string;
  character: string;
  layer: number;
  x: number;
  y: number;
  blockedBy: readonly string[];
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
  boardTiles: BoardTile[];
  tray: Array<RackTile | null>;
  score: number;
  completedBirdCount: number;
  discoveredBirdIds: string[];
  lastCompletedBird: CompletedBird | null;
  phase: GamePhase;
}
