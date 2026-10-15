import { generateLevel3Content } from './level3Generator';
import type { LevelDefinition, WinningAction } from './types';

export const PREVALIDATED_LEVEL_3_SEEDS = [8, 10, 15, 25, 30] as const;
export type PrevalidatedLevel3Seed = typeof PREVALIDATED_LEVEL_3_SEEDS[number];
export const PREVALIDATED_LEVEL_3_SEED: PrevalidatedLevel3Seed = PREVALIDATED_LEVEL_3_SEEDS[0];

const REPLAY_BY_SEED: Readonly<Record<PrevalidatedLevel3Seed, string>> = {
  8: 't:q07 t:q06 c:bailu t:m30 t:m31 c:bailu t:m32 t:m33 t:m34 t:x06 c:baitoubei t:m37 t:m36 t:m40 t:m39 t:q05 t:q04 c:canglu t:m25 c:shanbanjiu t:m24 t:m23 c:xique t:m22 c:yelu t:m13 t:m14 t:m15 t:m02 c:huixique t:q03 t:q02 t:x05 t:x04 t:x03 t:x02 t:m03 c:xiaobailu t:x12 t:x11 t:m38 c:canglu t:x10 t:m27 c:shumaque t:m26 t:m16 t:x09 c:yelu t:m19 t:m05 c:hongfujinji t:m28 t:m29 t:m17 t:m09 c:xique t:m18 t:x08 c:xiaobailu t:m07 c:heishuiji t:m20 t:m21 t:m12 c:shanbanjiu t:x07 c:heishuiji t:m35 c:hongsun t:m01 t:x01 c:shumaque t:m04 t:m06 t:q01 c:hongfujinji t:m08 t:m10 t:m11 c:dabailu',
  10: 't:q07 t:m30 c:xique t:m31 t:m32 t:m37 c:canglu t:m33 t:m40 c:bailu t:m34 t:m39 c:heishuiji t:m36 t:q06 t:q05 c:chilu t:q04 t:q03 t:q02 t:m38 c:xiaobailu t:x06 t:x05 t:x04 t:x03 t:x02 t:x12 t:x11 t:x10 c:bailu t:x09 c:xique t:x08 t:m24 c:daisheng t:m23 t:m22 c:shumaque t:m13 t:x07 c:zhujingbanjiu t:m14 t:m25 t:m15 c:chilu t:m01 t:m27 c:baitoubei t:m26 t:m28 c:baitoubei t:m29 t:m16 t:m17 c:hongsun t:m18 t:m19 c:canglu t:m03 c:heishuiji t:m20 t:m21 t:m02 c:huixique t:m04 t:m05 t:m12 c:huixique t:m06 t:m35 c:daisheng t:m07 t:q01 c:shanbanjiu t:m08 t:m11 c:xiaobailu t:m09 t:m10 t:x01 c:shumaque',
  15: 't:q07 t:m30 t:m31 t:m32 t:m37 c:heishuiji t:m33 t:m34 t:m36 t:m40 t:m39 t:x12 c:shumaque t:x11 c:huixique t:x10 c:bailu t:q06 t:q05 c:daisheng t:q04 t:q03 t:q02 t:x06 t:m26 c:hongfujinji t:m27 t:m28 t:m29 t:x05 t:m19 c:shumaque t:m16 t:x04 c:shanbanjiu t:x03 t:x02 t:x09 t:m18 c:dabailu t:m21 t:m12 c:xiaobailu t:x08 t:m09 t:m23 c:zhujingbanjiu t:m22 t:m13 t:m24 t:m25 c:bailu t:m15 c:xique t:m14 t:m17 t:m20 t:m04 c:hongfujinji t:m06 c:shanbanjiu t:m07 c:chilu t:m10 c:daisheng t:m01 t:m38 c:xique t:m02 t:x07 t:x01 c:huixique t:m03 t:m05 t:m08 t:m11 c:xiaobailu t:m35 t:q01 c:heishuiji',
  25: 't:q07 t:m30 t:m31 t:m32 t:m33 c:chilu t:m34 t:m37 t:m36 t:m40 t:m39 t:m26 c:hongfujinji t:m27 t:m28 t:q06 c:daisheng t:q05 t:q04 c:bailu t:q03 t:q02 t:m19 c:baitoubei t:m16 c:yelu t:x06 t:x05 t:x04 t:m38 c:heishuiji t:x03 t:x02 t:x12 t:x11 c:canglu t:x10 t:m29 c:canglu t:m21 c:shanbanjiu t:m18 t:x09 t:x08 c:xique t:m17 c:yelu t:m20 t:m09 t:m12 t:x07 c:zhujingbanjiu t:m10 t:m11 t:m22 t:m23 c:huixique t:m13 t:m24 t:m05 c:daisheng t:m14 t:m01 c:dabailu t:m25 t:m15 c:dabailu t:m07 c:hongfujinji t:m02 t:q01 c:zhujingbanjiu t:m03 t:m08 c:xiaobailu t:m04 t:x01 c:bailu t:m06 t:m35 c:xique',
  30: 't:q07 t:m30 t:m31 t:m32 t:m33 c:xique t:m34 c:yelu t:m37 t:q06 c:canglu t:m36 t:m40 t:m39 t:q05 t:q04 t:q03 t:q02 t:m25 c:xique t:m24 t:m15 c:bailu t:m23 t:m38 c:daisheng t:m22 t:m13 c:zhujingbanjiu t:m14 t:x06 t:m02 t:m35 c:baitoubei t:x05 t:x04 t:x03 c:hongsun t:x02 t:q01 c:bailu t:x01 c:yelu t:m01 t:m03 t:m28 c:huixique t:m27 t:m26 t:m19 c:heishuiji t:m16 t:m20 c:shumaque t:m17 t:m09 c:zhujingbanjiu t:x12 t:x11 t:x10 t:m29 c:hongsun t:m18 c:dabailu t:m21 t:m12 c:heishuiji t:x09 t:x08 c:huixique t:m04 t:m05 t:m06 t:m07 c:shumaque t:m08 t:m11 c:hongfujinji t:m10 t:x07 c:dabailu',
};

function parseReplay(replay: string): readonly WinningAction[] {
  return replay.split(' ').map((token): WinningAction => {
    const [type, value] = token.split(':', 2);
    if (type === 't') return { type: 'take', tileId: 'l3-' + value };
    if (type === 'c') return { type: 'compose', birdId: 'bird:' + value };
    throw new Error('Invalid fixture action: ' + token);
  });
}

export const PREVALIDATED_LEVEL_3_SOLUTIONS: Readonly<Record<PrevalidatedLevel3Seed, readonly WinningAction[]>> = {
  8: parseReplay(REPLAY_BY_SEED[8]),
  10: parseReplay(REPLAY_BY_SEED[10]),
  15: parseReplay(REPLAY_BY_SEED[15]),
  25: parseReplay(REPLAY_BY_SEED[25]),
  30: parseReplay(REPLAY_BY_SEED[30]),
};

export function isPrevalidatedLevel3Seed(seed: number): seed is PrevalidatedLevel3Seed {
  return PREVALIDATED_LEVEL_3_SEEDS.some((candidate) => candidate === seed);
}

export function nextPrevalidatedLevel3Seed(seed: number | undefined): PrevalidatedLevel3Seed {
  const index = PREVALIDATED_LEVEL_3_SEEDS.findIndex((candidate) => candidate === seed);
  return PREVALIDATED_LEVEL_3_SEEDS[(index + 1) % PREVALIDATED_LEVEL_3_SEEDS.length];
}

export function createPrevalidatedLevel3(
  seed: PrevalidatedLevel3Seed = PREVALIDATED_LEVEL_3_SEED,
): LevelDefinition {
  const generated = generateLevel3Content(seed);
  if (!generated.ok) {
    throw new Error('Prevalidated Level 3 seed is invalid: ' + generated.reason);
  }
  return {
    id: 'level-3',
    label: '第三关',
    seed,
    tiles: generated.value.tiles,
    winningSolution: PREVALIDATED_LEVEL_3_SOLUTIONS[seed],
  };
}
