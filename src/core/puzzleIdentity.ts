import type { BoardTileDefinition } from './types';

export const PUZZLE_BANK_SCHEMA_VERSION = 'certified-puzzle-bank-v1';
export const LEGACY_GENERATOR_VERSION = 'solution-first-v3';
export const GENERATOR_VERSION = 'solution-first-v4.2';
export const GENERATION_VOCABULARY_VERSION = 'beginner-36-v1';
export const GEOMETRY_VERSION = 'piachan-lv1-90-v1';

export interface PuzzleIdentityInputs {
  generatorVersion: string;
  generationVocabularyVersion: string;
  recognitionRulesVersion: string;
  geometryVersion: string;
  seed: number;
  candidateIndex: number;
  boardHash: string;
}

export interface CertificateHashInputs {
  puzzleId: string;
  characters: string;
  sampledBirdIds: readonly string[];
  winningTrace: string;
  witnessCertification: string;
  independentSearchStatus: string;
  diagnostics: {
    initialExposedTiles: number;
    distinctSampledSpecies: number;
    overlappingSpeciesPairs: number;
    overlapPairDensity: number;
    maximumTrayOccupancy: number;
    averageTrayOccupancy: number;
    checkpointFormableCompositions: readonly number[];
    uniqueBoardAssignmentsAtAcceptance: number;
  };
}

const ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

/** Synchronous SHA-256 over UTF-8, shared by Node certification and browser integrity checks. */
export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bitLength = BigInt(bytes.length) * 8n;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Number((bitLength >> 32n) & 0xffffffffn));
  view.setUint32(paddedLength - 4, Number(bitLength & 0xffffffffn));

  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const first = words[index - 15];
      const second = words[index - 2];
      words[index] = (words[index - 16] + (rotateRight(first, 7) ^ rotateRight(first, 18) ^ (first >>> 3))
        + words[index - 7] + (rotateRight(second, 17) ^ rotateRight(second, 19) ^ (second >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const choose = (e & f) ^ (~e & g);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const upperE = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const upperA = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const temp1 = (h + upperE + choose + ROUND_CONSTANTS[index] + words[index]) >>> 0;
      const temp2 = (upperA + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, index) => { hash[index] = (hash[index] + value) >>> 0; });
  }
  return hash.map((value) => value.toString(16).padStart(8, '0')).join('');
}

/** UTF-8 SHA-256 of JSON array rows sorted by tile ID (code-point order).
 * Each row is exactly [id,x,y,layer,blockedBySorted,character]; no object key order is involved.
 */
export function boardHash(tiles: readonly BoardTileDefinition[]): string {
  const rows = [...tiles]
    .sort((first, second) => first.id < second.id ? -1 : first.id > second.id ? 1 : 0)
    .map((tile) => [tile.id, tile.x, tile.y, tile.layer, [...tile.blockedBy].sort(), tile.character]);
  return sha256Hex(JSON.stringify(rows));
}

/** UTF-8 SHA-256 of this fixed-order JSON array, prefixed with `puzzle:`. */
export function puzzleId(inputs: PuzzleIdentityInputs): string {
  return `puzzle:${sha256Hex(JSON.stringify([
    inputs.generatorVersion,
    inputs.generationVocabularyVersion,
    inputs.recognitionRulesVersion,
    inputs.geometryVersion,
    inputs.seed,
    inputs.candidateIndex,
    inputs.boardHash,
  ]))}`;
}

/** SHA-256 of fixed-order certificate fields; catches accidental trace/diagnostic corruption. */
export function certificateHash(input: CertificateHashInputs): string {
  const metrics = input.diagnostics;
  return sha256Hex(JSON.stringify([
    input.puzzleId, input.characters, input.sampledBirdIds, input.winningTrace,
    input.witnessCertification, input.independentSearchStatus,
    metrics.initialExposedTiles, metrics.distinctSampledSpecies,
    metrics.overlappingSpeciesPairs, metrics.overlapPairDensity,
    metrics.maximumTrayOccupancy, metrics.averageTrayOccupancy,
    metrics.checkpointFormableCompositions, metrics.uniqueBoardAssignmentsAtAcceptance,
  ]));
}
