import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import { analyzeCatalog } from './catalogAnalysis';

describe('canonical bird-catalog graph analysis', () => {
  it('reports the complete graph without mutating runtime content', () => {
    const analysis = analyzeCatalog();
    console.log(JSON.stringify(analysis, null, 2));
    expect(analysis.speciesCount).toBe(BIRD_CATALOG.length);
    expect(analysis.uniqueCharacterCount).toBeGreaterThan(0);
  });
});
