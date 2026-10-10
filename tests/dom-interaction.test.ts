import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('game DOM interactions', () => {
  it('takes an exposed tile and switches levels through mounted click handlers', async () => {
    const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.test/bird/' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.resetModules();
    await import('../src/main');

    const root = dom.window.document.querySelector('#app')!;
    expect(root.querySelector('.board-meta')?.textContent).toContain('22 / 22');
    root.querySelector<HTMLButtonElement>('[data-board-tile-id="l1-u01"]')!.click();
    expect(root.querySelector('.board-meta')?.textContent).toContain('21 / 22');
    expect(root.querySelectorAll('.tray-tile')).toHaveLength(1);

    root.querySelector<HTMLButtonElement>('[data-level-id="level-2"]')!.click();
    expect(root.querySelector('.score')?.textContent).toContain('第二关');
    expect(root.querySelector('.board-meta')?.textContent).toContain('33 / 33');
    expect(root.querySelectorAll('.tray-tile')).toHaveLength(0);

    root.querySelector<HTMLButtonElement>('[data-level-id="level-3"]')!.click();
    expect(root.querySelector('.score')?.textContent).toContain('第三关');
    expect(root.querySelector('.board-meta')?.textContent).toContain('90 / 90');
  });
});
