export type GamePhase = 'playing' | 'game_over';

export interface BirdDefinition {
  id: string;
  name: string;
  characters: readonly string[];
  score: number;
  presentationKey: string;
}
export interface RackTile {
  id: string;
  character: string;
}

export interface CompletedBird {
  birdId: string;
  score: number;
  isNew: boolean;
}

export interface GameState {
  seed: number;
  rngState: number;
  rack: Array<RackTile | null>;
  currentOffer: string[];
  selectedRackTileIds: string[];
  score: number;
  discoveredBirdIds: string[];
  lastCompletedBird: CompletedBird | null;
  phase: GamePhase;
  nextTileId: number;
}
