import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG, CATALOG_CHARACTER_POOL } from '../src/core/birdCatalog';
import {
  chooseOfferCharacter,
  composeSelectedBird,
  createGame,
  findFormableBirds,
  restartGame,
  toggleRackTile,
} from '../src/core/game';
import { createWeightedOffer, nextRandom } from '../src/core/rng';
import type { BirdDefinition, GameState, RackTile } from '../src/core/types';

function rackFrom(text: string): Array<RackTile | null> {
  return [
    ...Array.from(text).map((character, index) => ({ id: `manual-${index}`, character })),
    ...Array<RackTile | null>(Math.max(0, 10 - Array.from(text).length)).fill(null),
  ];
}

function withRack(text: string): GameState {
  return { ...createGame(7), rack: rackFrom(text) };
}

function selectCharacters(state: GameState, indexes: number[]): GameState {
  return indexes.reduce((current, index) => {
    const tile = current.rack[index];
    return tile ? toggleRackTile(current, tile.id) : current;
  }, state);
}

describe('seeded gameplay core', () => {
  it('reproduces random values and offers from the same seed', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
    expect(createGame(42).currentOffer).toEqual(createGame(42).currentOffer);
  });

  it('creates offers with exactly 3 distinct catalog characters', () => {
    const result = createWeightedOffer(99, CATALOG_CHARACTER_POOL);
    expect(result.offer).toHaveLength(3);
    expect(new Set(result.offer).size).toBe(3);
    expect(result.offer.every((character) => CATALOG_CHARACTER_POOL.includes(character))).toBe(true);
  });

  it('adds exactly one chosen offer tile and advances the offer', () => {
    const state = createGame(12);
    const chosen = state.currentOffer[1];
    const next = chooseOfferCharacter(state, chosen);
    expect(next.rack.filter(Boolean)).toHaveLength(1);
    expect(next.rack[0]?.character).toBe(chosen);
    expect(next.currentOffer).not.toBe(state.currentOffer);
  });

  it('leaves all state unchanged for an invalid composition', () => {
    const state = selectCharacters(withRack('喜鹭'), [0, 1]);
    expect(composeSelectedBird(state)).toBe(state);
  });

  it('consumes the correct tiles for a valid 2-character bird', () => {
    const state = selectCharacters(withRack('喜鹊白'), [0, 1]);
    const next = composeSelectedBird(state);
    expect(next.rack.map((tile) => tile?.character ?? '').join('')).toBe('白');
    expect(next.score).toBe(10);
  });

  it('scores a valid 3-character bird at 30', () => {
    const state = selectCharacters(withRack('灰喜鹊'), [0, 1, 2]);
    expect(composeSelectedBird(state).score).toBe(30);
  });

  it('scores a valid 4-character bird at 70', () => {
    const state = selectCharacters(withRack('珠颈斑鸠'), [0, 1, 2, 3]);
    expect(composeSelectedBird(state).score).toBe(70);
  });

  it('respects duplicate-character multiplicity', () => {
    const repeatedBird: BirdDefinition = {
      id: 'double', name: '鹭鹭', characters: ['鹭', '鹭'], score: 10, presentationKey: 'double',
    };
    expect(findFormableBirds(rackFrom('鹭'), [repeatedBird])).toEqual([]);
    expect(findFormableBirds(rackFrom('鹭鹭'), [repeatedBird])).toEqual([repeatedBird]);
  });

  it('detects every bird formable from an unordered rack', () => {
    const names = findFormableBirds(rackFrom('鹭白喜鹊')).map((bird) => bird.name);
    expect(names).toContain('喜鹊');
    expect(names).toContain('白鹭');
  });

  it('does not game over on a full rack with a formable bird', () => {
    const state = withRack('喜鹊大大大大大大大');
    state.currentOffer = ['白', '鹭', '鸡'];
    const next = chooseOfferCharacter(state, '白');
    expect(next.rack.filter(Boolean)).toHaveLength(10);
    expect(findFormableBirds(next.rack).map((bird) => bird.name)).toContain('喜鹊');
    expect(next.phase).toBe('playing');
  });

  it('games over on a full rack with no formable bird', () => {
    const state = withRack('大大大大大大大大大');
    state.currentOffer = ['小', '鹭', '白'];
    const next = chooseOfferCharacter(state, '小');
    expect(next.rack.filter(Boolean)).toHaveLength(10);
    expect(findFormableBirds(next.rack)).toEqual([]);
    expect(next.phase).toBe('game_over');
  });

  it('restart restores initial gameplay for the same seed', () => {
    const initial = createGame(321);
    const played = chooseOfferCharacter(initial, initial.currentOffer[0]);
    const restarted = restartGame({ ...played, score: 70, discoveredBirdIds: [BIRD_CATALOG[0].id] });
    expect(restarted).toEqual(initial);
  });
});
