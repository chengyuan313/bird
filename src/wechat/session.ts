import { composeBird, createGameFromLevel, GAMEPLAY_RULESET_VERSION, selectBoardTile } from '../core/gameEngine';
import { REGIONAL_V7_CONTENT_VERSION, type RegionalTier } from '../core/regionalV7Data';
import { getRegionalV7Puzzle } from '../core/regionalV7Puzzles';
import type { GameState, WinningAction } from '../core/types';

export const WECHAT_SESSION_KEY = 'bird.wechat.session.v1';
export const WECHAT_PREFERENCES_KEY = 'bird.wechat.preferences.v1';
export interface WechatPreferences {
  version: 1;
  vibration: boolean;
  motion: boolean;
  tutorialSeen: boolean;
}
export const DEFAULT_PREFERENCES: WechatPreferences = {
  version: 1, vibration: true, motion: true, tutorialSeen: false,
};
export function readPreferences(value: unknown): WechatPreferences {
  const data = value as Partial<WechatPreferences> | null;
  if (!data || data.version !== 1) return { ...DEFAULT_PREFERENCES };
  return { version: 1, vibration: data.vibration !== false, motion: data.motion !== false,
    tutorialSeen: data.tutorialSeen === true };
}
export interface WechatSession {
  version: 1;
  rulesetVersion: string;
  contentVersion: string;
  puzzleId: string;
  boardHash: string;
  tier: RegionalTier;
  stageIndex: number;
  actions: WinningAction[];
  undoRemaining: number;
}
export interface RestoredWechatSession {
  session: WechatSession;
  state: GameState;
  history: GameState[];
}
/** Reconstruct from current immutable puzzle inputs. Never trust saved scores,
 * tile coordinates, quotas, discoveries, or serialized engine states. */
export function restoreWechatSession(value: unknown): RestoredWechatSession | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as WechatSession;
  if (data.version !== 1 || data.rulesetVersion !== GAMEPLAY_RULESET_VERSION ||
    data.contentVersion !== REGIONAL_V7_CONTENT_VERSION || ![1, 2, 3, 4, 5].includes(data.tier) ||
    !Number.isInteger(data.stageIndex) || !Array.isArray(data.actions) || data.actions.length > 180 ||
    !Number.isInteger(data.undoRemaining) || data.undoRemaining < 0 || data.undoRemaining > 3) return null;
  const puzzle = getRegionalV7Puzzle('CN-SC', data.tier, data.stageIndex);
  if (!puzzle || data.puzzleId !== puzzle.record.puzzleId || data.boardHash !== puzzle.record.boardHash) return null;
  let state = createGameFromLevel(puzzle.level);
  const history: GameState[] = [];
  const actions: WinningAction[] = [];
  for (const raw of data.actions) {
    if (!raw || typeof raw !== 'object' || state.phase !== 'playing') return null;
    let action: WinningAction;
    if (raw.type === 'take' && typeof raw.tileId === 'string') action = { type: 'take', tileId: raw.tileId };
    else if (raw.type === 'compose' && typeof raw.birdId === 'string') action = { type: 'compose', birdId: raw.birdId };
    else return null;
    const next = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
    if (next === state) return null;
    history.push(state); actions.push(action); state = next;
  }
  // Completed puzzles are committed to progress instead of resumed as sessions.
  if (state.phase === 'level_complete') return null;
  return { state, history, session: { version: 1, rulesetVersion: GAMEPLAY_RULESET_VERSION,
    contentVersion: REGIONAL_V7_CONTENT_VERSION, puzzleId: puzzle.record.puzzleId,
    boardHash: puzzle.record.boardHash, tier: data.tier, stageIndex: data.stageIndex,
    actions, undoRemaining: data.undoRemaining } };
}
