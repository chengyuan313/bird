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

  it('offers and consumes the Level 2 麻雀 spelling through the rendered controls', async () => {
    const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.test/bird/' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.resetModules();
    await import('../src/main');

    const root = dom.window.document.querySelector('#app')!;
    root.querySelector<HTMLButtonElement>('[data-level-id="level-2"]')!.click();
    for (const tileId of ['l2-z09', 'l2-z10', 'l2-z11', 'l2-m09', 'l2-m10']) {
      const tile = root.querySelector<HTMLButtonElement>(`[data-board-tile-id="${tileId}"]`)!;
      expect(tile.disabled).toBe(false);
      tile.click();
    }
    expect(root.querySelector('.board-meta')?.textContent).toContain('28 / 33');
    expect(root.querySelectorAll('.tray-tile')).toHaveLength(5);
    const option = root.querySelector<HTMLButtonElement>('[data-bird-id="composition:maque"]');
    expect(option?.textContent).toContain('麻雀');
    option!.click();
    expect(root.querySelectorAll('.tray-tile')).toHaveLength(3);
    expect(root.querySelector('.board-meta')?.textContent).toContain('28 / 33');
    expect(root.querySelector('.score')?.textContent).toContain('10');
  });

  it('switches certified puzzle identity and retries that exact board through mounted controls', async () => {
    const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.test/bird/' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.resetModules();
    await import('../src/main');

    const root = dom.window.document.querySelector('#app')!;
    root.querySelector<HTMLButtonElement>('[data-level-id="level-3"]')!.click();
    const initialId = root.querySelector('.game-shell')!.getAttribute('data-puzzle-id');
    expect(root.querySelector('.puzzle-identity')?.textContent).toContain('谜题');
    const initialCharacters = [...root.querySelectorAll('[data-board-tile-id]')].map((tile) => tile.textContent).join('');
    root.querySelector<HTMLButtonElement>('[data-action="new-board"]')!.click();
    const nextId = root.querySelector('.game-shell')!.getAttribute('data-puzzle-id');
    expect(nextId).not.toBe(initialId);
    const nextCharacters = [...root.querySelectorAll('[data-board-tile-id]')].map((tile) => tile.textContent).join('');
    expect(nextCharacters).not.toBe(initialCharacters);
    root.querySelector<HTMLButtonElement>('.board-tile.exposed')!.click();
    expect(root.querySelectorAll('.tray-tile')).toHaveLength(1);
    root.querySelector<HTMLButtonElement>('[data-action="restart"]')!.click();
    expect(root.querySelector('.game-shell')!.getAttribute('data-puzzle-id')).toBe(nextId);
    expect([...root.querySelectorAll('[data-board-tile-id]')].map((tile) => tile.textContent).join('')).toBe(nextCharacters);
    expect(root.querySelectorAll('.tray-tile')).toHaveLength(0);
  });

  it('pages through certified challenges and selects an exact puzzle on mobile', async () => {
    const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.test/bird/' });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.resetModules();
    await import('../src/main');
    const root = dom.window.document.querySelector('#app')!;
    expect(root.querySelector('.level-tabs')?.textContent).toContain('教学');
    root.querySelector<HTMLButtonElement>('[data-level-id="level-3"]')!.click();
    const picker = root.querySelector<HTMLDetailsElement>('.challenge-picker')!;
    picker.open = true;
    expect(root.querySelector('.challenge-facts')?.textContent).toContain('难度未分级');
    root.querySelector<HTMLButtonElement>('[data-challenge-page="1"]')!.click();
    expect(root.querySelectorAll('[data-challenge-id]')).toHaveLength(5);
    const choice = root.querySelector<HTMLButtonElement>('[data-challenge-id]')!;
    const chosenId = choice.dataset.challengeId;
    choice.click();
    expect(root.querySelector('.game-shell')?.getAttribute('data-puzzle-id')).toBe(chosenId);
    expect(root.querySelector('.puzzle-identity')?.textContent).toContain('挑战 6');
    root.querySelector<HTMLButtonElement>('.board-tile.exposed')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="restart"]')!.click();
    expect(root.querySelector('.game-shell')?.getAttribute('data-puzzle-id')).toBe(chosenId);
    expect(root.querySelectorAll('.tray-tile')).toHaveLength(0);
  });
});
