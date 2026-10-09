export interface RandomStep {
  value: number;
  state: number;
}
export function normalizeSeed(seed: number): number {
  return Number.isFinite(seed) ? seed >>> 0 : 0;
}

// Mulberry32 expressed as a serializable one-step state transition.
export function nextRandom(currentState: number): RandomStep {
  const state = (currentState + 0x6d2b79f5) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return {
    value: ((value ^ (value >>> 14)) >>> 0) / 4294967296,
    state,
  };
}

export function createWeightedOffer(
  rngState: number,
  weightedPool: readonly string[],
  size = 3,
): { offer: string[]; rngState: number } {
  const weights = new Map<string, number>();
  for (const character of weightedPool) {
    weights.set(character, (weights.get(character) ?? 0) + 1);
  }

  if (weights.size < size) {
    throw new Error(`Cannot create ${size} distinct candidates from ${weights.size} characters.`);
  }

  const available = [...weights.entries()];
  const offer: string[] = [];
  let state = rngState;

  while (offer.length < size) {
    const totalWeight = available.reduce((total, [, weight]) => total + weight, 0);
    const random = nextRandom(state);
    state = random.state;
    let cursor = random.value * totalWeight;
    let chosenIndex = available.length - 1;

    for (let index = 0; index < available.length; index += 1) {
      cursor -= available[index][1];
      if (cursor < 0) {
        chosenIndex = index;
        break;
      }
    }

    offer.push(available[chosenIndex][0]);
    available.splice(chosenIndex, 1);
  }

  return { offer, rngState: state };
}
