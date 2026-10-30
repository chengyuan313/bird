import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { V7_DIFFICULTY_POOLS, V7_PLAYABLE_NAMES, V7_PROVINCIAL_MEMBERSHIPS } from '../src/core/regionalV7Data';
import { emptyRegionalProgress, saveRegionalProgress } from '../src/core/regionalProgress';

describe('V7 Sichuan collection filters', () => {
  it('combines level, discovery, regional-feature, and search filters without losing provenance', async () => {
    const featured = V7_PROVINCIAL_MEMBERSHIPS.find((item) => item.regionalFeature)!;
    const featuredTier = V7_DIFFICULTY_POOLS.find((pool) => pool.newlyIntroducedSpeciesIds.includes(featured.speciesId))!.tier;
    const name = V7_PLAYABLE_NAMES.find((item) => item.speciesId === featured.speciesId)!.name;
    const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.test/bird/' });
    saveRegionalProgress(dom.window.localStorage, { ...emptyRegionalProgress(), discoveredSpeciesIds: { 'CN-SC': [featured.speciesId] } });
    vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.window.document); vi.resetModules();
    await import('../src/main');
    const root = dom.window.document.querySelector('#app')!;
    root.querySelector<HTMLButtonElement>('[data-region-id="CN-SC"]')!.click();
    const cards = () => [...root.querySelectorAll<HTMLElement>('[data-v7-species]:not([hidden])')];
    const result = root.querySelector<HTMLElement>('#v7-species-result-count')!;
    const tier = root.querySelector<HTMLSelectElement>('#v7-species-tier-filter')!;
    const discovery = root.querySelector<HTMLSelectElement>('#v7-species-discovery-filter')!;
    const feature = root.querySelector<HTMLSelectElement>('#v7-species-feature-filter')!;
    const search = root.querySelector<HTMLInputElement>('#v7-species-search')!;
    expect(cards()).toHaveLength(100);
    expect(result.textContent).toBe('显示 100 / 100 种');
    expect(result.getAttribute('aria-live')).toBe('polite');

    tier.value = String(featuredTier); tier.dispatchEvent(new dom.window.Event('change'));
    expect(cards()).toHaveLength(20);
    discovery.value = 'discovered'; discovery.dispatchEvent(new dom.window.Event('change'));
    expect(cards()).toHaveLength(1);
    feature.value = 'featured'; feature.dispatchEvent(new dom.window.Event('change'));
    expect(cards()).toHaveLength(1);
    expect(cards()[0].dataset.v7Species).toBe(name);
    expect(cards()[0].querySelector('a')?.getAttribute('href')).toBe(featured.sourceUrl);
    expect(cards()[0].textContent).toContain(`第${featured.sourceRow}条`);
    expect(result.textContent).toBe('显示 1 / 100 种');

    search.value = '不存在的鸟名'; search.dispatchEvent(new dom.window.Event('input'));
    expect(cards()).toHaveLength(0);
    expect(result.textContent).toBe('显示 0 / 100 种');
    search.value = name; search.dispatchEvent(new dom.window.Event('input'));
    expect(cards()).toHaveLength(1);
    feature.value = 'standard'; feature.dispatchEvent(new dom.window.Event('change'));
    expect(cards()).toHaveLength(0);
    feature.value = 'all'; discovery.value = 'undiscovered';
    discovery.dispatchEvent(new dom.window.Event('change'));
    expect(cards()).toHaveLength(0);
    discovery.value = 'all'; tier.value = 'all'; search.value = '';
    tier.dispatchEvent(new dom.window.Event('change'));
    expect(cards()).toHaveLength(100);
  });

  it('retains mobile single-column cards with readable links and 44px filter controls', () => {
    const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    expect(styles).toMatch(/@media \(max-width: 480px\)\s*\{\s*\.v7-collection\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(styles).toMatch(/\.v7-collection-filters select\s*\{[^}]*min-height:\s*44px/);
    expect(styles).toMatch(/\.v7-collection \.bird-card a\s*\{[^}]*min-height:\s*44px/);
    expect(styles).toMatch(/\.v7-collection \.bird-card a\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(styles).toMatch(/\.v7-collection \.bird-card a\s*\{[^}]*font-size:\s*14px/);
  });
});
