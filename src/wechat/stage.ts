import { composeBird, createGameFromLevel, findPlayableBirds, getExposedBoardTiles,
  selectBoardTile } from '../core/gameEngine';
import { getRegionalV7Puzzle } from '../core/regionalV7Puzzles';
import { geometryForTier } from '../core/regionalV7Geometry';
import type { RegionalTier } from '../core/regionalV7Data';
import type { GameState } from '../core/types';

export const WECHAT_STORAGE_KEY = 'bird.wechat.v1';
const TILE_SIZE = 48;
const TOUCH_SIZE = 44;

export interface WechatViewport {
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
}
export interface WechatStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}
export interface HitBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}
export interface WechatStageSnapshot {
  puzzleId: string;
  phase: GameState['phase'];
  remainingTiles: number;
  trayOccupancy: number;
  score: number;
  completedBirdCount: number;
  boardViewport: HitBox;
  panX: number;
  panY: number;
  boardWidth: number;
  boardHeight: number;
  safeTop: number;
  safeBottom: number;
  overlay: 'none' | 'words' | 'compose-list' | 'tile-picker' | 'result' | 'home';
  controls: readonly HitBox[];
  visibleTileHits: readonly HitBox[];
  completedPuzzleIds: readonly string[];
}

interface SavedProgress { version: 1; completedPuzzleIds: string[]; discoveredSpeciesIds: string[] }
function loadProgress(store: WechatStore): SavedProgress {
  try {
    const value = store.get(WECHAT_STORAGE_KEY) as Partial<SavedProgress> | undefined;
    if (value?.version === 1 && Array.isArray(value.completedPuzzleIds) && Array.isArray(value.discoveredSpeciesIds)) {
      return { version: 1, completedPuzzleIds: value.completedPuzzleIds.filter((id): id is string => typeof id === 'string'),
        discoveredSpeciesIds: value.discoveredSpeciesIds.filter((id): id is string => typeof id === 'string') };
    }
  } catch { /* Unavailable storage must not prevent local play. */ }
  return { version: 1, completedPuzzleIds: [], discoveredSpeciesIds: [] };
}

function inside(box: HitBox, x: number, y: number): boolean {
  return x >= box.x && y >= box.y && x <= box.x + box.width && y <= box.y + box.height;
}
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export class WechatBirdStage {
  private state: GameState;
  private tier: RegionalTier = 1;
  private stageIndex = 1;
  private history: GameState[] = [];
  private progress: SavedProgress;
  private panX = 0;
  private panY = 0;
  private overlay: WechatStageSnapshot['overlay'] = 'none';
  private pickerIds: string[] = [];
  private wordPage = 0;
  private composePage = 0;
  private pickerPage = 0;
  private homePage = 0;
  private hits: HitBox[] = [];
  private tileHits: HitBox[] = [];
  private touchOrigin: { x: number; y: number; panX: number; panY: number; inBoard: boolean; moved: boolean } | null = null;

  constructor(private readonly context: CanvasRenderingContext2D,
    private viewport: WechatViewport, private readonly store: WechatStore) {
    this.progress = loadProgress(store);
    this.state = createGameFromLevel(getRegionalV7Puzzle('CN-SC', 1, 1)!.level);
    this.render();
  }

  private layout() {
    const margin = 12;
    const contentWidth = Math.max(120, this.viewport.width - margin * 2);
    const safeTop = clamp(this.viewport.safeTop, 0, this.viewport.height - 100);
    const safeBottom = clamp(this.viewport.safeBottom, safeTop + 100, this.viewport.height);
    if (safeBottom - safeTop < 344) throw new Error('WeChat safe area is too short for fixed game controls');
    const hudY = safeTop + 5;
    const controlsY = safeBottom - 53;
    const composeY = controlsY - 58;
    const trayY = composeY - 68;
    const boardY = hudY + 52;
    const boardHeight = Math.max(100, trayY - boardY - 8);
    return { margin, contentWidth, safeTop, safeBottom, hudY, controlsY, composeY, trayY,
      board: { id: 'board', x: margin, y: boardY, width: contentWidth, height: boardHeight, label: '棋盘局部视窗' } satisfies HitBox };
  }

  private geometry() { return geometryForTier(this.tier); }
  private overlayPageSize(height: number): number {
    return Math.max(1, Math.min(6, Math.floor((height - 110) / 48)));
  }
  private clampPan(board: HitBox): void {
    const geometry = this.geometry();
    this.panX = clamp(this.panX, Math.min(0, board.width - geometry.width), 0);
    this.panY = clamp(this.panY, Math.min(0, board.height - geometry.height), 0);
  }
  private button(id: string, label: string, x: number, y: number, width: number, height: number,
    enabled = true): void {
    const box = { id, label, x, y, width, height };
    this.context.fillStyle = enabled ? '#e9f2dc' : '#dce2d7';
    this.context.fillRect(x, y, width, height);
    this.context.strokeStyle = '#78916f'; this.context.strokeRect(x, y, width, height);
    this.context.fillStyle = enabled ? '#294b35' : '#7a8479';
    this.context.font = 'bold 14px sans-serif';
    this.context.textAlign = 'center'; this.context.textBaseline = 'middle';
    this.context.fillText(label, x + width / 2, y + height / 2, width - 6);
    if (enabled) this.hits.push(box);
  }
  private label(text: string, x: number, y: number, size = 14, color = '#294b35'): void {
    this.context.fillStyle = color;
    this.context.font = `${size}px sans-serif`;
    this.context.textAlign = 'left'; this.context.textBaseline = 'middle';
    this.context.fillText(text, x, y, Math.max(40, this.viewport.width - x - 10));
  }

  render(): void {
    const ctx = this.context;
    const layout = this.layout();
    const geometry = this.geometry();
    this.clampPan(layout.board);
    this.hits = []; this.tileHits = [];
    ctx.fillStyle = '#f7f5e9'; ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);
    this.label(`四川 D${this.tier} · 第${this.stageIndex}局`, layout.margin, layout.hudY + 15, 17);
    this.label(`剩余 ${this.state.boardTiles.filter((tile) => !tile.removed).length}/${this.state.boardTiles.length}  ·  得分 ${this.state.score}`,
      layout.margin, layout.hudY + 38, 12, '#566c5e');
    this.button('home', '关卡', layout.margin + layout.contentWidth - 48, layout.hudY, 48, 44);
    ctx.fillStyle = '#e4ebdf';
    ctx.fillRect(layout.board.x, layout.board.y, layout.board.width, layout.board.height);
    ctx.save(); ctx.beginPath(); ctx.rect(layout.board.x, layout.board.y, layout.board.width, layout.board.height); ctx.clip();
    const exposed = new Set(getExposedBoardTiles(this.state).map((tile) => tile.id));
    const tiles = this.state.boardTiles.filter((tile) => !tile.removed)
      .sort((a, b) => a.layer - b.layer || Number(exposed.has(a.id)) - Number(exposed.has(b.id)));
    for (const tile of tiles) {
      const x = layout.board.x + this.panX + tile.x;
      const y = layout.board.y + this.panY + tile.y;
      if (x + TILE_SIZE < layout.board.x || x > layout.board.x + layout.board.width ||
        y + TILE_SIZE < layout.board.y || y > layout.board.y + layout.board.height) continue;
      const available = exposed.has(tile.id) && this.state.phase === 'playing';
      ctx.fillStyle = available ? '#ffe3a5' : '#aeb9af';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = available ? '#b8783b' : '#718878'; ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = available ? '#503829' : '#54605b';
      ctx.font = 'bold 21px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tile.character, x + TILE_SIZE / 2, y + TILE_SIZE / 2);
      if (available && Math.min(x + TILE_SIZE, layout.board.x + layout.board.width) - Math.max(x, layout.board.x) >= TOUCH_SIZE &&
        Math.min(y + TILE_SIZE, layout.board.y + layout.board.height) - Math.max(y, layout.board.y) >= TOUCH_SIZE)
        this.tileHits.push({ id: tile.id, label: tile.character,
          x, y, width: TILE_SIZE, height: TILE_SIZE });
    }
    ctx.restore();
    this.label(`字槽 ${this.state.tray.filter(Boolean).length}/10`, layout.margin, layout.trayY + 11, 13);
    const slotGap = 2;
    const slotWidth = (layout.contentWidth - slotGap * 9) / 10;
    this.state.tray.forEach((tile, index) => {
      const x = layout.margin + index * (slotWidth + slotGap);
      ctx.fillStyle = tile ? '#f6e3b8' : '#e2e9dd';
      ctx.fillRect(x, layout.trayY + 23, slotWidth, 32);
      if (tile) {
        ctx.fillStyle = '#4a3b27'; ctx.font = '16px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(tile.character, x + slotWidth / 2, layout.trayY + 39, slotWidth);
      }
    });
    const formable = findPlayableBirds(this.state);
    if (formable.length) {
      const primary = formable[0];
      const showAll = formable.length > 1;
      const primaryWidth = showAll ? layout.contentWidth - 108 : layout.contentWidth;
      this.button(`compose:${primary.id}`, `${primary.name} +${primary.score}`,
        layout.margin, layout.composeY + 6, primaryWidth, 46);
      if (showAll) this.button('compose-all', `全部可拼 ${formable.length}`,
        layout.margin + primaryWidth + 6, layout.composeY + 6, 102, 46);
    } else this.label('当前无可拼鸟名 · 找亮起的字', layout.margin, layout.composeY + 29, 13);
    const controlWidth = (layout.contentWidth - 12) / 3;
    this.button('undo', '撤销', layout.margin, layout.controlsY, controlWidth, 46,
      this.history.length > 0 && this.state.phase !== 'level_complete');
    this.button('words', '本关词表', layout.margin + controlWidth + 6, layout.controlsY, controlWidth, 46);
    this.button('retry', '重试', layout.margin + (controlWidth + 6) * 2, layout.controlsY, controlWidth, 46);
    if (this.state.tray.filter(Boolean).length >= 7 && this.state.phase === 'playing') {
      this.label('字槽将满，可先拼词或撤销', layout.margin, layout.trayY - 9, 11, '#9a5d38');
    }
    if (this.state.phase !== 'playing' && this.overlay === 'none') this.overlay = 'result';
    if (this.overlay !== 'none') this.drawOverlay(layout);
  }

  private drawOverlay(layout: ReturnType<WechatBirdStage['layout']>): void {
    const ctx = this.context;
    const x = layout.margin + 4; const y = layout.safeTop + 55;
    const width = layout.contentWidth - 8; const height = layout.safeBottom - y - 55;
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#78916f'; ctx.strokeRect(x, y, width, height);
    this.hits = [];
    if (this.overlay === 'home') {
      const pageSize = Math.max(2, Math.floor((height - 110) / 52) * 2);
      const pages = Math.ceil(25 / pageSize);
      this.homePage = clamp(this.homePage, 0, pages - 1);
      this.label(`四川 · 选择关卡 ${this.homePage + 1}/${pages}`, x + 12, y + 25, 17);
      for (let index = this.homePage * pageSize + 1; index <= Math.min(25, (this.homePage + 1) * pageSize); index++) {
        const column = (index - this.homePage * pageSize - 1) % 2;
        const row = Math.floor((index - this.homePage * pageSize - 1) / 2);
        const tier = Math.floor((index - 1) / 5) + 1;
        const stageIndex = ((index - 1) % 5) + 1;
        this.button(`open:${tier}:${stageIndex}`, `D${tier} · 第${stageIndex}局`, x + 12 + column * ((width - 30) / 2 + 6),
          y + 56 + row * 52, (width - 42) / 2, 46);
      }
      if (pages > 1) {
        this.button('home-prev', '上一页', x + 12, y + height - 52, 78, 44, this.homePage > 0);
        this.button('home-next', '下一页', x + 96, y + height - 52, 78, 44, this.homePage + 1 < pages);
      }
      this.button('overlay-close', '返回对局', x + width - 108, y + height - 52, 96, 44);
    } else if (this.overlay === 'words') {
      this.label('本关词表 · 剩余次数', x + 12, y + 25, 17);
      const names = this.state.activeCompositions;
      const pageSize = this.overlayPageSize(height);
      const pages = Math.max(1, Math.ceil(names.length / pageSize));
      this.wordPage = clamp(this.wordPage, 0, pages - 1);
      names.slice(this.wordPage * pageSize, this.wordPage * pageSize + pageSize).forEach((bird, index) =>
        this.label(`${bird.name} ×${this.state.remainingCompositionQuotas[bird.id]}`, x + 13,
          y + 76 + index * 48, 14));
      this.button('words-prev', '上一页', x + 12, y + height - 52, 78, 44, this.wordPage > 0);
      this.button('words-next', '下一页', x + 96, y + height - 52, 78, 44, this.wordPage + 1 < pages);
      this.button('overlay-close', '关闭', x + width - 90, y + height - 52, 78, 44);
    } else if (this.overlay === 'compose-list') {
      const birds = findPlayableBirds(this.state);
      const pageSize = this.overlayPageSize(height);
      const pages = Math.max(1, Math.ceil(birds.length / pageSize));
      this.composePage = clamp(this.composePage, 0, pages - 1);
      this.label(`全部可拼 ${birds.length} · ${this.composePage + 1}/${pages}`, x + 12, y + 25, 17);
      birds.slice(this.composePage * pageSize, this.composePage * pageSize + pageSize).forEach((bird, index) =>
        this.button(`compose:${bird.id}`, `${bird.name} +${bird.score}`, x + 12,
          y + 54 + index * 48, width - 24, 44));
      this.button('compose-prev', '上一页', x + 12, y + height - 52, 78, 44, this.composePage > 0);
      this.button('compose-next', '下一页', x + 96, y + height - 52, 78, 44, this.composePage + 1 < pages);
      this.button('overlay-close', '关闭', x + width - 90, y + height - 52, 78, 44);
    } else if (this.overlay === 'tile-picker') {
      const pages = Math.max(1, Math.ceil(this.pickerIds.length / 6));
      this.pickerPage = clamp(this.pickerPage, 0, pages - 1);
      this.label(`请选择亮起的字 · ${this.pickerPage + 1}/${pages}`, x + 12, y + 25, 17);
      this.pickerIds.slice(this.pickerPage * 6, this.pickerPage * 6 + 6).forEach((id, index) => {
        const tile = this.state.boardTiles.find((item) => item.id === id)!;
        this.button(`pick:${id}`, tile.character, x + 12 + (index % 3) * ((width - 24) / 3),
          y + 58 + Math.floor(index / 3) * 53, (width - 30) / 3, 46);
      });
      if (pages > 1) {
        this.button('picker-prev', '上一页', x + 12, y + height - 52, 78, 44, this.pickerPage > 0);
        this.button('picker-next', '下一页', x + 96, y + height - 52, 78, 44, this.pickerPage + 1 < pages);
      }
      this.button('overlay-close', '取消', x + width - 90, y + height - 52, 78, 44);
    } else {
      this.label(this.state.phase === 'level_complete' ? '本局完成！' : '字槽已满', x + 12, y + 30, 20);
      this.label(this.state.phase === 'level_complete' ? `得分 ${this.state.score} · 发现已保存` : '可连续撤销，或重试本局',
        x + 12, y + 70, 14);
      if (this.state.phase === 'game_over') this.button('undo', '撤销一步', x + 12, y + height - 52, 80, 44,
        this.history.length > 0);
      else this.button('next-puzzle', '下一局', x + 12, y + height - 52, 80, 44);
      this.button('home', '关卡', x + width - 195, y + height - 52, 80, 44);
      this.button('retry', '重试本局', x + width - 107, y + height - 52, 95, 44);
    }
  }

  resize(viewport: WechatViewport): void { this.viewport = viewport; this.render(); }
  openPuzzle(tier: RegionalTier, stageIndex: number): void {
    const puzzle = getRegionalV7Puzzle('CN-SC', tier, stageIndex);
    if (!puzzle) throw new Error(`Unknown Sichuan puzzle D${tier}-${stageIndex}`);
    this.tier = tier; this.stageIndex = stageIndex;
    this.state = createGameFromLevel(puzzle.level);
    this.history = []; this.panX = 0; this.panY = 0; this.overlay = 'none';
    this.wordPage = 0; this.composePage = 0; this.pickerPage = 0; this.homePage = 0; this.render();
  }
  private transition(next: GameState): void {
    if (next === this.state) return;
    this.history.push(this.state);
    this.state = next;
    if (next.phase === 'level_complete') {
      this.progress = { version: 1,
        completedPuzzleIds: [...new Set([...this.progress.completedPuzzleIds, next.puzzleId!])],
        discoveredSpeciesIds: [...new Set([...this.progress.discoveredSpeciesIds, ...next.discoveredBirdIds])] };
      try { this.store.set(WECHAT_STORAGE_KEY, this.progress); } catch { /* Keep current win when storage is unavailable. */ }
    }
    this.render();
  }
  undo(): void {
    if (this.state.phase === 'level_complete') return;
    const previous = this.history.pop();
    if (!previous) return;
    this.state = previous; this.overlay = 'none'; this.render();
  }
  retry(): void { this.openPuzzle(this.tier, this.stageIndex); }

  touchStart(x: number, y: number): void {
    const board = this.layout().board;
    this.touchOrigin = { x, y, panX: this.panX, panY: this.panY,
      inBoard: this.overlay === 'none' && inside(board, x, y), moved: false };
  }
  touchMove(x: number, y: number): void {
    if (!this.touchOrigin?.inBoard) return;
    const origin = this.touchOrigin;
    if (Math.abs(x - origin.x) + Math.abs(y - origin.y) >= 7) origin.moved = true;
    if (!origin.moved) return;
    this.panX = origin.panX + x - origin.x;
    this.panY = origin.panY + y - origin.y;
    this.render();
  }
  touchEnd(x: number, y: number): void {
    const origin = this.touchOrigin;
    this.touchOrigin = null;
    if (!origin || origin.moved || Math.abs(x - origin.x) + Math.abs(y - origin.y) >= 7) return;
    this.tap(x, y);
  }
  tap(x: number, y: number): void {
    const control = this.hits.find((hit) => inside(hit, x, y));
    if (control) {
      if (control.id === 'undo') this.undo();
      else if (control.id === 'retry') this.retry();
      else if (control.id === 'next-puzzle') {
        if (this.stageIndex < 5) this.openPuzzle(this.tier, this.stageIndex + 1);
        else if (this.tier < 5) this.openPuzzle((this.tier + 1) as RegionalTier, 1);
        else { this.overlay = 'home'; this.render(); }
      }
      else if (control.id === 'home') { this.overlay = 'home'; this.render(); }
      else if (control.id === 'home-prev') { this.homePage--; this.render(); }
      else if (control.id === 'home-next') { this.homePage++; this.render(); }
      else if (control.id.startsWith('open:')) {
        const [, tier, index] = control.id.split(':');
        this.openPuzzle(Number(tier) as RegionalTier, Number(index));
      }
      else if (control.id === 'words') { this.overlay = 'words'; this.render(); }
      else if (control.id === 'words-prev') { this.wordPage--; this.render(); }
      else if (control.id === 'words-next') { this.wordPage++; this.render(); }
      else if (control.id === 'compose-all') { this.composePage = 0; this.overlay = 'compose-list'; this.render(); }
      else if (control.id === 'compose-prev') { this.composePage--; this.render(); }
      else if (control.id === 'compose-next') { this.composePage++; this.render(); }
      else if (control.id === 'picker-prev') { this.pickerPage--; this.render(); }
      else if (control.id === 'picker-next') { this.pickerPage++; this.render(); }
      else if (control.id === 'overlay-close') { this.overlay = 'none'; this.render(); }
      else if (control.id.startsWith('compose:')) {
        this.overlay = 'none'; this.transition(composeBird(this.state, control.id.slice(8)));
      }
      else if (control.id.startsWith('pick:')) {
        this.overlay = 'none'; this.transition(selectBoardTile(this.state, control.id.slice(5)));
      }
      return;
    }
    if (this.overlay !== 'none' || this.state.phase !== 'playing') return;
    const board = this.layout().board;
    if (!inside(board, x, y)) return;
    const matching = this.tileHits.filter((hit) => inside(hit, x, y));
    if (matching.length === 1) this.transition(selectBoardTile(this.state, matching[0].id));
    else if (matching.length > 1) {
      this.pickerIds = matching.map((item) => item.id);
      this.pickerPage = 0;
      this.overlay = 'tile-picker'; this.render();
    }
  }
  getState(): GameState { return this.state; }
  snapshot(): WechatStageSnapshot {
    const board = this.layout().board;
    return { puzzleId: this.state.puzzleId!, phase: this.state.phase,
      remainingTiles: this.state.boardTiles.filter((tile) => !tile.removed).length,
      trayOccupancy: this.state.tray.filter(Boolean).length, score: this.state.score,
      completedBirdCount: this.state.completedBirdCount, boardViewport: board,
      panX: this.panX, panY: this.panY, boardWidth: this.geometry().width, boardHeight: this.geometry().height,
      safeTop: this.layout().safeTop, safeBottom: this.layout().safeBottom,
      overlay: this.overlay, controls: [...this.hits], visibleTileHits: [...this.tileHits],
      completedPuzzleIds: [...this.progress.completedPuzzleIds] };
  }
}

export function assertWechatTouchTargets(stage: WechatBirdStage): void {
  const snapshot = stage.snapshot();
  const board = snapshot.boardViewport;
  if (board.y < snapshot.safeTop || board.y + board.height > snapshot.safeBottom || board.height < 100)
    throw new Error('WeChat board is outside the safe game area');
  for (const control of snapshot.controls) {
    if (control.width < TOUCH_SIZE || control.height < TOUCH_SIZE) throw new Error(`Undersized WeChat control ${control.id}`);
    if (control.y < snapshot.safeTop || control.y + control.height > snapshot.safeBottom)
      throw new Error(`WeChat control outside safe area: ${control.id}`);
  }
  for (let index = 0; index < snapshot.controls.length; index++) for (let other = index + 1; other < snapshot.controls.length; other++) {
    const a = snapshot.controls[index]; const b = snapshot.controls[other];
    if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0 &&
      Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0)
      throw new Error(`Overlapping WeChat controls: ${a.id}, ${b.id}`);
  }
  for (const tile of snapshot.visibleTileHits) {
    if (tile.width < TOUCH_SIZE || tile.height < TOUCH_SIZE) throw new Error(`Undersized WeChat tile ${tile.id}`);
    if (Math.min(tile.x + tile.width, board.x + board.width) - Math.max(tile.x, board.x) < TOUCH_SIZE ||
      Math.min(tile.y + tile.height, board.y + board.height) - Math.max(tile.y, board.y) < TOUCH_SIZE)
      throw new Error(`Clipped WeChat tile: ${tile.id}`);
  }
}
