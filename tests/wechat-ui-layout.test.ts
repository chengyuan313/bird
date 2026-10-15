import { describe, expect, it } from 'vitest';
import { computeBoardMetrics, computeLayout } from '../src/wechat/ui/ui-layout';

describe('handoff fixed-screen layout', () => {
  it('places the 390×844 game regions around the WeChat menu capsule', () => {
    const layout = computeLayout({ windowWidth: 390, windowHeight: 844,
      safeArea: { top: 47, bottom: 810 }, menuButton: { top: 51, left: 296, height: 32 } });
    expect(layout.topBar).toEqual({ x: 0, y: 47, w: 288, h: 44 });
    expect(layout.board).toEqual({ x: 8, y: 95, w: 374, h: 521 });
    expect(layout.slotHeader.y).toBeGreaterThanOrEqual(layout.board.y + layout.board.h);
    expect(layout.toolbar.y + layout.toolbar.h).toBeLessThanOrEqual(810);
    expect(layout.toolbarButtons.every((button) => button.w >= 44 && button.h >= 44)).toBe(true);
  });

  it('keeps the 320×568 board local and all fixed controls on screen', () => {
    const layout = computeLayout({ windowWidth: 320, windowHeight: 568,
      safeArea: { top: 20, bottom: 568 }, menuButton: { top: 24, left: 226, height: 32 } });
    expect(layout.board).toEqual({ x: 6, y: 66, w: 308, h: 330 });
    expect(layout.toolbar.y + layout.toolbar.h).toBeLessThanOrEqual(568);
    expect(layout.slotCells).toHaveLength(10);
    expect(layout.slotCells[0].x).toBeGreaterThanOrEqual(0);
    expect(layout.slotCells[9].x + layout.slotCells[9].w).toBeLessThanOrEqual(320);
    const d5 = computeBoardMetrics(layout.board, 7, 7);
    expect(d5.tileW).toBeGreaterThanOrEqual(44);
    expect(d5.panX).toBe(true);
  });
});
