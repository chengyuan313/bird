import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import { composeBird, createGame, evaluateTerminalState, findFormableBirds, TRAY_SIZE } from '../src/core/game';
import { getLevel } from '../src/core/levels';
import { GLOBAL_BIRD_COMPOSITIONS, RECOGNITION_REGISTRY_VERSION, validateRecognitionRegistry } from '../src/core/recognitionRegistry';
import { renderGame } from '../src/ui/render';
import { isCompositionAvailable, replaySolution, solveLevel } from '../tools/level3Solver';
import type { GameState, RackTile } from '../src/core/types';

function tray(text: string): Array<RackTile | null> {
  const tiles = Array.from(text).map((character, index) => ({ id: `test-${index}`, character }));
  return [...tiles, ...Array<RackTile | null>(TRAY_SIZE - tiles.length).fill(null)];
}

function withTray(text: string, levelId = 'level-1'): GameState {
  return { ...createGame(levelId), tray: tray(text) };
}

describe('versioned global recognition', () => {
  it('contains 100 canonical species, two approved aliases, and one reviewed group name', () => {
    expect(RECOGNITION_REGISTRY_VERSION).toBe('global-recognition-v4.1.0');
    expect(GLOBAL_BIRD_COMPOSITIONS).toHaveLength(103);
    expect(GLOBAL_BIRD_COMPOSITIONS.filter((entry) => entry.classification === 'canonical')).toHaveLength(100);
    expect(GLOBAL_BIRD_COMPOSITIONS.filter((entry) => entry.classification === 'alias')).toHaveLength(2);
    expect(GLOBAL_BIRD_COMPOSITIONS.filter((entry) => entry.classification === 'group')).toHaveLength(1);
    expect(() => validateRecognitionRegistry(GLOBAL_BIRD_COMPOSITIONS)).not.toThrow();
    expect(() => validateRecognitionRegistry([...GLOBAL_BIRD_COMPOSITIONS, GLOBAL_BIRD_COMPOSITIONS[0]])).toThrow('Duplicate composition ID');
    expect(new Set(GLOBAL_BIRD_COMPOSITIONS.map((entry) => entry.id)).size).toBe(103);
    expect(new Set(GLOBAL_BIRD_COMPOSITIONS.filter((entry) => entry.classification === 'canonical').map((entry) => entry.speciesId)).size).toBe(BIRD_CATALOG.length);
  });

  it.each([
    ['bird:xique', '喜鹊', 10],
    ['bird:huixique', '灰喜鹊', 30],
    ['composition:maque', '麻雀', 10],
    ['bird:shumaque', '树麻雀', 30],
    ['bird:shanmaque', '山麻雀', 30],
    ['bird:dashanque', '大山雀', 30],
    ['bird:shanbanjiu', '山斑鸠', 30],
    ['bird:zhujingbanjiu', '珠颈斑鸠', 70],
    ['composition:banjiu', '斑鸠', 10],
  ])('recognizes and consumes %s in any level', (id, spelling, score) => {
    for (const levelId of ['level-1', 'level-2', 'level-3']) {
      const state = withTray(String(spelling), levelId);
      expect(findFormableBirds(state.tray).map((entry) => entry.id)).toContain(id);
      const next = composeBird(state, String(id));
      expect(next).not.toBe(state);
      expect(next.tray.every((tile) => tile === null)).toBe(true);
      expect(next.score).toBe(score);
      expect(next.completedBirdCount).toBe(1);
    }
  });

  it('maps aliases to one species, keeps 山麻雀 distinct, and excludes group discoveries', () => {
    const first = composeBird(withTray('树麻雀麻雀山麻雀斑鸠'), 'bird:shumaque');
    const alias = composeBird(first, 'composition:maque');
    expect(alias.discoveredBirdIds).toEqual(['bird:shumaque']);
    expect(alias.lastCompletedBird?.isNew).toBe(false);
    const mountain = composeBird(alias, 'bird:shanmaque');
    expect(mountain.discoveredBirdIds).toEqual(['bird:shumaque', 'bird:shanmaque']);
    const group = composeBird(mountain, 'composition:banjiu');
    expect(group.discoveredBirdIds).toEqual(mountain.discoveredBirdIds);
    expect(group.lastCompletedBird).toMatchObject({ birdId: 'composition:banjiu', score: 10, isNew: false });
  });

  it('offers overlapping choices explicitly and consumes only the selected spelling', () => {
    const state = withTray('山斑鸠');
    expect(findFormableBirds(state.tray).map((entry) => entry.id)).toEqual(expect.arrayContaining(['bird:shanbanjiu', 'composition:banjiu']));
    expect(state.score).toBe(0);
    const group = composeBird(state, 'composition:banjiu');
    expect(group.tray.flatMap((tile) => tile ? [tile.character] : [])).toEqual(['山']);
    expect(group.discoveredBirdIds).toEqual([]);
  });

  it('uses global recognition for terminal states, UI options, and solver actions', () => {
    const state = withTray('斑鸠');
    expect(isCompositionAvailable(state, 'composition:banjiu')).toBe(true);
    const root = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] } as unknown as HTMLElement;
    renderGame(root, state, () => undefined);
    expect(root.innerHTML).toContain('data-bird-id="composition:banjiu"');
    expect(root.innerHTML).toContain('可消除鸟名 <span>103 种</span>');
    const emptyBoard = state.boardTiles.map((tile) => ({ ...tile, removed: true }));
    expect(evaluateTerminalState(emptyBoard, state.tray)).toBe('playing');
    expect(composeBird({ ...state, boardTiles: emptyBoard }, 'composition:banjiu').phase).toBe('level_complete');
    expect(evaluateTerminalState(emptyBoard, tray('山'))).toBe('game_over');
    expect(evaluateTerminalState(emptyBoard, tray(''))).toBe('level_complete');
    expect(evaluateTerminalState(state.boardTiles, tray('斑鸠山山山山山山山山'))).toBe('playing');
    expect(evaluateTerminalState(state.boardTiles, tray('山山山山山山山山山山'))).toBe('game_over');
    const tiny = { id: 'tiny-group', label: 'test', tiles: [
      { id: 'one', character: '斑', x: 0, y: 0, layer: 1, blockedBy: [] },
      { id: 'two', character: '鸠', x: 100, y: 0, layer: 1, blockedBy: [] },
    ], winningSolution: [] };
    const solved = solveLevel(tiny, { maxNodes: 100, maxDurationMs: 1000 });
    expect(solved.status).toBe('SOLVED');
    expect(solved.actions).toContainEqual({ type: 'compose', birdId: 'composition:banjiu' });
    expect(replaySolution(tiny, solved.actions).phase).toBe('level_complete');
  });

  it('replays all seven stored winning traces unchanged', () => {
    for (const [levelId, seed] of [
      ['level-1', undefined], ['level-2', undefined],
      ['level-3', 1], ['level-3', 2], ['level-3', 3], ['level-3', 4], ['level-3', 5],
    ] as const) {
      const level = getLevel(levelId, seed);
      const completed = replaySolution(level, level.winningSolution);
      expect(completed.phase).toBe('level_complete');
      expect(completed.boardTiles.every((tile) => tile.removed)).toBe(true);
      expect(completed.tray.every((tile) => tile === null)).toBe(true);
    }
  });
});
