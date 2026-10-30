export const PIACHAN_UPSTREAM = {
  repository: 'https://github.com/surevision/piachan',
  commit: '70d4900a1fee3af8801a3279fac2c1d3e2a0b0b5',
  prefabPath: 'assets/resources/lv/lv1.prefab',
} as const;

export interface PiachanSourcePosition {
  id: string;
  /** Horizontal half-grid coordinate from lv1.prefab. */
  x: number;
  /** Vertical half-grid coordinate from lv1.prefab. */
  y: number;
  row: number;
  column: number;
  layer: number;
}

export interface PiachanPosition extends PiachanSourcePosition {
  blockedBy: readonly string[];
}

/**
 * Exact unique positions from piachan's lv1.prefab. The upstream loader
 * deduplicates repeated map-editor cells by layer + x + y.
 */
export const PIACHAN_SOURCE_POSITIONS: readonly PiachanSourcePosition[] = [
  { id: 'piachan-l1-l1-01', x: 0, y: 0, row: 0, column: 0, layer: 1 },
  { id: 'piachan-l1-l1-02', x: 2, y: 2, row: 1, column: 1, layer: 1 },
  { id: 'piachan-l1-l1-03', x: 4, y: 4, row: 2, column: 2, layer: 1 },
  { id: 'piachan-l1-l1-04', x: 6, y: 6, row: 3, column: 3, layer: 1 },
  { id: 'piachan-l1-l1-05', x: 8, y: 8, row: 4, column: 4, layer: 1 },
  { id: 'piachan-l1-l1-06', x: 10, y: 10, row: 5, column: 5, layer: 1 },
  { id: 'piachan-l1-l1-07', x: 12, y: 12, row: 6, column: 6, layer: 1 },
  { id: 'piachan-l1-l1-08', x: 12, y: 0, row: 0, column: 6, layer: 1 },
  { id: 'piachan-l1-l1-09', x: 10, y: 2, row: 1, column: 5, layer: 1 },
  { id: 'piachan-l1-l1-10', x: 8, y: 4, row: 2, column: 4, layer: 1 },
  { id: 'piachan-l1-l1-11', x: 4, y: 8, row: 4, column: 2, layer: 1 },
  { id: 'piachan-l1-l1-12', x: 2, y: 10, row: 5, column: 1, layer: 1 },
  { id: 'piachan-l1-l1-13', x: 0, y: 12, row: 6, column: 0, layer: 1 },
  { id: 'piachan-l1-l1-14', x: 2, y: 6, row: 3, column: 1, layer: 1 },
  { id: 'piachan-l1-l1-15', x: 2, y: 4, row: 2, column: 1, layer: 1 },
  { id: 'piachan-l1-l1-16', x: 4, y: 2, row: 1, column: 2, layer: 1 },
  { id: 'piachan-l1-l1-17', x: 6, y: 2, row: 1, column: 3, layer: 1 },
  { id: 'piachan-l1-l1-18', x: 8, y: 2, row: 1, column: 4, layer: 1 },
  { id: 'piachan-l1-l1-19', x: 10, y: 4, row: 2, column: 5, layer: 1 },
  { id: 'piachan-l1-l1-20', x: 6, y: 4, row: 2, column: 3, layer: 1 },
  { id: 'piachan-l1-l1-21', x: 4, y: 6, row: 3, column: 2, layer: 1 },
  { id: 'piachan-l1-l1-22', x: 8, y: 6, row: 3, column: 4, layer: 1 },
  { id: 'piachan-l1-l1-23', x: 10, y: 6, row: 3, column: 5, layer: 1 },
  { id: 'piachan-l1-l1-24', x: 10, y: 8, row: 4, column: 5, layer: 1 },
  { id: 'piachan-l1-l1-25', x: 6, y: 8, row: 4, column: 3, layer: 1 },
  { id: 'piachan-l1-l1-26', x: 2, y: 8, row: 4, column: 1, layer: 1 },
  { id: 'piachan-l1-l1-27', x: 4, y: 10, row: 5, column: 2, layer: 1 },
  { id: 'piachan-l1-l1-28', x: 6, y: 10, row: 5, column: 3, layer: 1 },
  { id: 'piachan-l1-l1-29', x: 8, y: 10, row: 5, column: 4, layer: 1 },
  { id: 'piachan-l1-l2-01', x: 1, y: 1, row: 0, column: 0, layer: 2 },
  { id: 'piachan-l1-l2-02', x: 11, y: 11, row: 5, column: 5, layer: 2 },
  { id: 'piachan-l1-l2-03', x: 11, y: 1, row: 0, column: 5, layer: 2 },
  { id: 'piachan-l1-l2-04', x: 1, y: 11, row: 5, column: 0, layer: 2 },
  { id: 'piachan-l1-l2-05', x: 11, y: 9, row: 4, column: 5, layer: 2 },
  { id: 'piachan-l1-l2-06', x: 1, y: 9, row: 4, column: 0, layer: 2 },
  { id: 'piachan-l1-l2-07', x: 1, y: 3, row: 1, column: 0, layer: 2 },
  { id: 'piachan-l1-l2-08', x: 11, y: 3, row: 1, column: 5, layer: 2 },
  { id: 'piachan-l1-l2-09', x: 11, y: 5, row: 2, column: 5, layer: 2 },
  { id: 'piachan-l1-l2-10', x: 11, y: 7, row: 3, column: 5, layer: 2 },
  { id: 'piachan-l1-l2-11', x: 5, y: 1, row: 0, column: 2, layer: 2 },
  { id: 'piachan-l1-l2-12', x: 9, y: 3, row: 1, column: 4, layer: 2 },
  { id: 'piachan-l1-l2-13', x: 3, y: 3, row: 1, column: 1, layer: 2 },
  { id: 'piachan-l1-l2-14', x: 5, y: 5, row: 2, column: 2, layer: 2 },
  { id: 'piachan-l1-l2-15', x: 7, y: 5, row: 2, column: 3, layer: 2 },
  { id: 'piachan-l1-l2-16', x: 5, y: 7, row: 3, column: 2, layer: 2 },
  { id: 'piachan-l1-l2-17', x: 1, y: 5, row: 2, column: 0, layer: 2 },
  { id: 'piachan-l1-l2-18', x: 1, y: 7, row: 3, column: 0, layer: 2 },
  { id: 'piachan-l1-l2-19', x: 7, y: 1, row: 0, column: 3, layer: 2 },
  { id: 'piachan-l1-l2-20', x: 5, y: 11, row: 5, column: 2, layer: 2 },
  { id: 'piachan-l1-l2-21', x: 7, y: 11, row: 5, column: 3, layer: 2 },
  { id: 'piachan-l1-l2-22', x: 3, y: 9, row: 4, column: 1, layer: 2 },
  { id: 'piachan-l1-l2-23', x: 9, y: 9, row: 4, column: 4, layer: 2 },
  { id: 'piachan-l1-l2-24', x: 7, y: 7, row: 3, column: 3, layer: 2 },
  { id: 'piachan-l1-l3-01', x: 2, y: 2, row: 1, column: 1, layer: 3 },
  { id: 'piachan-l1-l3-02', x: 2, y: 4, row: 2, column: 1, layer: 3 },
  { id: 'piachan-l1-l3-03', x: 2, y: 6, row: 3, column: 1, layer: 3 },
  { id: 'piachan-l1-l3-04', x: 2, y: 8, row: 4, column: 1, layer: 3 },
  { id: 'piachan-l1-l3-05', x: 2, y: 10, row: 5, column: 1, layer: 3 },
  { id: 'piachan-l1-l3-06', x: 4, y: 10, row: 5, column: 2, layer: 3 },
  { id: 'piachan-l1-l3-07', x: 4, y: 6, row: 3, column: 2, layer: 3 },
  { id: 'piachan-l1-l3-08', x: 4, y: 8, row: 4, column: 2, layer: 3 },
  { id: 'piachan-l1-l3-09', x: 4, y: 4, row: 2, column: 2, layer: 3 },
  { id: 'piachan-l1-l3-10', x: 4, y: 2, row: 1, column: 2, layer: 3 },
  { id: 'piachan-l1-l3-11', x: 6, y: 2, row: 1, column: 3, layer: 3 },
  { id: 'piachan-l1-l3-12', x: 8, y: 2, row: 1, column: 4, layer: 3 },
  { id: 'piachan-l1-l3-13', x: 10, y: 2, row: 1, column: 5, layer: 3 },
  { id: 'piachan-l1-l3-14', x: 10, y: 4, row: 2, column: 5, layer: 3 },
  { id: 'piachan-l1-l3-15', x: 6, y: 4, row: 2, column: 3, layer: 3 },
  { id: 'piachan-l1-l3-16', x: 6, y: 6, row: 3, column: 3, layer: 3 },
  { id: 'piachan-l1-l3-17', x: 8, y: 4, row: 2, column: 4, layer: 3 },
  { id: 'piachan-l1-l3-18', x: 8, y: 6, row: 3, column: 4, layer: 3 },
  { id: 'piachan-l1-l3-19', x: 10, y: 6, row: 3, column: 5, layer: 3 },
  { id: 'piachan-l1-l3-20', x: 10, y: 8, row: 4, column: 5, layer: 3 },
  { id: 'piachan-l1-l3-21', x: 6, y: 8, row: 4, column: 3, layer: 3 },
  { id: 'piachan-l1-l3-22', x: 6, y: 10, row: 5, column: 3, layer: 3 },
  { id: 'piachan-l1-l3-23', x: 8, y: 8, row: 4, column: 4, layer: 3 },
  { id: 'piachan-l1-l3-24', x: 8, y: 10, row: 5, column: 4, layer: 3 },
  { id: 'piachan-l1-l3-25', x: 10, y: 10, row: 5, column: 5, layer: 3 },
  { id: 'piachan-l1-l4-01', x: 3, y: 2, row: 1, column: 1, layer: 4 },
  { id: 'piachan-l1-l4-02', x: 9, y: 2, row: 1, column: 4, layer: 4 },
  { id: 'piachan-l1-l4-03', x: 3, y: 6, row: 3, column: 1, layer: 4 },
  { id: 'piachan-l1-l4-04', x: 1, y: 8, row: 4, column: 0, layer: 4 },
  { id: 'piachan-l1-l4-05', x: 3, y: 10, row: 5, column: 1, layer: 4 },
  { id: 'piachan-l1-l4-06', x: 6, y: 10, row: 5, column: 3, layer: 4 },
  { id: 'piachan-l1-l4-07', x: 9, y: 10, row: 5, column: 4, layer: 4 },
  { id: 'piachan-l1-l4-08', x: 9, y: 6, row: 3, column: 4, layer: 4 },
  { id: 'piachan-l1-l4-09', x: 11, y: 8, row: 4, column: 5, layer: 4 },
  { id: 'piachan-l1-l4-10', x: 1, y: 4, row: 2, column: 0, layer: 4 },
  { id: 'piachan-l1-l4-11', x: 6, y: 6, row: 3, column: 3, layer: 4 },
  { id: 'piachan-l1-l4-12', x: 11, y: 4, row: 2, column: 5, layer: 4 },
];

/**
 * Mirrors NodeInfo.refreshCoverState: two half-grid tiles overlap when any
 * authored corner key is shared, which is equivalent to both deltas <= 1.
 */
export function piachanPositionsOverlap(
  first: Pick<PiachanSourcePosition, 'x' | 'y'>,
  second: Pick<PiachanSourcePosition, 'x' | 'y'>,
): boolean {
  return Math.abs(first.x - second.x) <= 1 && Math.abs(first.y - second.y) <= 1;
}

export const PIACHAN_POSITIONS: readonly PiachanPosition[] = PIACHAN_SOURCE_POSITIONS.map((tile) => ({
  ...tile,
  blockedBy: PIACHAN_SOURCE_POSITIONS
    .filter((candidate) => candidate.layer > tile.layer && piachanPositionsOverlap(tile, candidate))
    .map((candidate) => candidate.id),
}));

export interface PiachanPreviewState {
  removedIds: ReadonlySet<string>;
}

export function createPiachanPreviewState(): PiachanPreviewState {
  return { removedIds: new Set<string>() };
}

export function isPiachanTileExposed(state: PiachanPreviewState, tileId: string): boolean {
  const tile = PIACHAN_POSITIONS.find((candidate) => candidate.id === tileId);
  return Boolean(tile)
    && !state.removedIds.has(tileId)
    && tile!.blockedBy.every((blockerId) => state.removedIds.has(blockerId));
}

export function removePiachanTile(state: PiachanPreviewState, tileId: string): PiachanPreviewState {
  if (!isPiachanTileExposed(state, tileId)) return state;
  return { removedIds: new Set([...state.removedIds, tileId]) };
}

export function remainingPiachanTiles(state: PiachanPreviewState): number {
  return PIACHAN_POSITIONS.length - state.removedIds.size;
}
