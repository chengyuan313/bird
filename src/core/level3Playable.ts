import { BIRD_CATALOG } from './birdCatalog';
import { BEGINNER_90_TILE_CONSTRAINTS, BEGINNER_LEVEL_3_CATALOG, sampleBirdContent } from './contentSampler';
import { createSeededRandom, fisherYates } from './level3Generator';
import { PIACHAN_POSITIONS } from '../preview/piachanLayout';
import { PLAYABLE_LEVEL_3_TRACES } from './level3ValidatedTraces';
import type { BirdDefinition, LevelDefinition, WinningAction } from './types';

export const PLAYABLE_LEVEL_3_SEEDS = [1, 2, 3, 4, 5] as const;
export type PlayableLevel3Seed = typeof PLAYABLE_LEVEL_3_SEEDS[number];
export const DEFAULT_PLAYABLE_LEVEL_3_SEED: PlayableLevel3Seed = PLAYABLE_LEVEL_3_SEEDS[0];

export function isPlayableLevel3Seed(seed: number): seed is PlayableLevel3Seed {
  return PLAYABLE_LEVEL_3_SEEDS.some((candidate) => candidate === seed);
}

export function nextPlayableLevel3Seed(seed: number | undefined): PlayableLevel3Seed {
  const index = PLAYABLE_LEVEL_3_SEEDS.findIndex((candidate) => candidate === seed);
  return PLAYABLE_LEVEL_3_SEEDS[(index + 1) % PLAYABLE_LEVEL_3_SEEDS.length];
}

/** A seeded topological removal order preserves every authored Piachan position. */
function removalOrder(seed: number): readonly string[] {
  const random = createSeededRandom(seed ^ 0x4c41594f);
  const removed = new Set<string>();
  const order: string[] = [];
  while (order.length < PIACHAN_POSITIONS.length) {
    const exposed = PIACHAN_POSITIONS.filter((tile) =>
      !removed.has(tile.id) && tile.blockedBy.every((id) => removed.has(id)));
    if (exposed.length === 0) throw new Error('Piachan layout has a blocking cycle');
    const chosen = exposed[Math.floor(random() * exposed.length)];
    removed.add(chosen.id);
    order.push(chosen.id);
  }
  return order;
}

/** Candidate generation only; the runtime selects seeds from the validated fixture list. */
export function generatePiachanLevel3(seed: number): LevelDefinition {
  const sampled = sampleBirdContent(seed, BEGINNER_90_TILE_CONSTRAINTS, BEGINNER_LEVEL_3_CATALOG);
  if (!sampled.ok) throw new Error(`Cannot sample Level 3 seed ${seed}: ${sampled.reason}`);
  const byId = new Map(BIRD_CATALOG.map((bird) => [bird.id, bird]));
  const sampledBirds = fisherYates(sampled.value.sampledBirdIds, createSeededRandom(seed ^ 0x42495244))
    .map((id) => {
      const bird = byId.get(id);
      if (!bird) throw new Error(`Missing canonical bird ${id}`);
      return bird;
    });
  const catalog: readonly BirdDefinition[] = [...new Map(sampledBirds.map((bird) => [bird.id, bird])).values()];
  const positions = new Map(PIACHAN_POSITIONS.map((tile) => [tile.id, tile]));
  const orderedIds = removalOrder(seed);
  const characters = sampledBirds.flatMap((bird) => bird.characters);
  if (characters.length !== PIACHAN_POSITIONS.length) throw new Error('Sampled character count differs from Piachan geometry');
  const characterById = new Map(orderedIds.map((id, index) => [id, characters[index]]));
  const tiles = PIACHAN_POSITIONS.map((tile) => ({
    id: tile.id,
    x: tile.x,
    y: tile.y,
    layer: tile.layer,
    blockedBy: tile.blockedBy,
    character: characterById.get(tile.id)!,
  }));
  const winningSolution: WinningAction[] = [];
  let offset = 0;
  for (const bird of sampledBirds) {
    for (const tileId of orderedIds.slice(offset, offset + bird.characters.length)) {
      if (!positions.has(tileId)) throw new Error(`Unknown Piachan tile ${tileId}`);
      winningSolution.push({ type: 'take', tileId });
    }
    winningSolution.push({ type: 'compose', birdId: bird.id });
    offset += bird.characters.length;
  }
  return { id: 'level-3', label: '第三关', seed, catalog, tiles, winningSolution };
}

export function createPlayableLevel3(seed: PlayableLevel3Seed = DEFAULT_PLAYABLE_LEVEL_3_SEED): LevelDefinition {
  const candidate = generatePiachanLevel3(seed);
  const winningSolution: WinningAction[] = PLAYABLE_LEVEL_3_TRACES[seed].split(' ').map((token) => {
    if (token.startsWith('t')) {
      const tile = PIACHAN_POSITIONS[Number.parseInt(token.slice(1), 36)];
      if (!tile) throw new Error(`Invalid validated tile token ${token}`);
      return { type: 'take', tileId: tile.id };
    }
    if (token.startsWith('c')) return { type: 'compose', birdId: `bird:${token.slice(1)}` };
    throw new Error(`Invalid validated action token ${token}`);
  });
  return { ...candidate, winningSolution };
}
