import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { createGame } from '../src/core/game';
import { getBoardBounds, renderGame } from '../src/ui/render';

describe('responsive board geometry', () => {
  it.each([
    ['level-1', 332],
    ['level-2', 350],
    ['level-3', 310],
  ])('%s includes every authored tile in its logical bounds', (levelId, minimumWidth) => {
    const state = createGame(levelId);
    const bounds = getBoardBounds(state);
    expect(bounds.width).toBeGreaterThanOrEqual(minimumWidth);
    for (const tile of state.boardTiles) {
      const tileSize = levelId === 'level-3' ? 44 : 61;
      const x = levelId === 'level-3' ? tile.x * tileSize / 2 : tile.x;
      const y = levelId === 'level-3' ? tile.y * tileSize / 2 : tile.y;
      expect(x + tileSize).toBeLessThanOrEqual(bounds.width);
      expect(y + tileSize).toBeLessThanOrEqual(bounds.height);
    }
  });

  it.each([320, 360, 390, 430, 1000])('scales each board uniformly at %ipx without changing tile coordinates', (screenWidth) => {
    const dom = new JSDOM('<main id="app"></main>');
    const root = dom.window.document.querySelector<HTMLElement>('#app')!;
    const boardWidth = Math.min(screenWidth, 430) - 62;
    Object.defineProperty(dom.window.HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() { return this.classList.contains('tile-board') ? boardWidth : 0; },
    });
    for (const levelId of ['level-1', 'level-2', 'level-3']) {
      const state = createGame(levelId);
      const bounds = getBoardBounds(state);
      renderGame(root, state, () => {});
      const canvas = root.querySelector<HTMLElement>('.board-canvas')!;
      const viewport = root.querySelector<HTMLElement>('.tile-board')!;
      const scale = Math.min(1, boardWidth / bounds.width);
      expect(canvas.style.transform).toBe(`scale(${scale})`);
      expect(viewport.style.height).toBe(`${bounds.height * scale}px`);
      expect(bounds.width * scale).toBeLessThanOrEqual(boardWidth);
      expect(root.querySelectorAll('.board-tile')).toHaveLength(state.boardTiles.length);
    }
  });
});
