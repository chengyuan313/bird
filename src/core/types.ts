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

export interface LevelDefinition {
  id: string;
  label: string;
  tiles: readonly BoardTileDefinition[];
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
  selectedTrayTileIds: string[];
  score: number;
  completedBirdCount: number;
  discoveredBirdIds: string[];
  lastCompletedBird: CompletedBird | null;
  phase: GamePhase;
}
