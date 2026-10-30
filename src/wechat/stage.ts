import { composeBird, createGameFromLevel, findPlayableBirds, GAMEPLAY_RULESET_VERSION, getExposedBoardTiles,
  selectBoardTile } from '../core/gameEngine';
import { carryForwardRegionalV7Completions, getRegionalV7Puzzle, REGIONAL_V7_PUZZLES } from '../core/regionalV7Puzzles';
import { geometryForTier } from '../core/regionalV7Geometry';
import { REGIONAL_V7_CONTENT_VERSION, REGIONAL_V7_SOURCES, V7_SPECIES_MASTER, type RegionalTier } from '../core/regionalV7Data';
import type { GameState, WinningAction } from '../core/types';
import { DEFAULT_PREFERENCES, readPreferences, restoreWechatSession, WECHAT_PREFERENCES_KEY, WECHAT_SESSION_KEY,
  type WechatPreferences, type WechatSession } from './session';
import { collectionSpecies, drawExplorationPage, explorationPageSize, type ExplorationScene } from './exploration';
import { computeBoardMetrics, computeDenseBoardPage, computeDenseTutorialMetrics, computeLayout } from './ui/ui-layout';
import { color, font } from './ui/ui-tokens';
import { drawBoardPage, drawCoveredTile, drawExposedTile, drawPrimaryButton,
  drawSlotCell, drawToolButton, drawTray, drawCountBadge, drawCutTile, roundRectPath } from './ui/ui-draw-recipes';

export const WECHAT_STORAGE_KEY = 'bird.wechat.v1';
const TOUCH_SIZE = 44;
const UNDO_PER_PUZZLE = 3;

export interface WechatViewport {
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  menuButton?: { top: number; left: number; height: number };
}
export interface WechatStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}
export interface WechatStageAssets {
  createImage(): HTMLImageElement;
  pathFor(key: string): string;
}
export interface WechatStageEffects {
  vibrate(type: 'light' | 'medium' | 'heavy'): void;
  requestFrame?(callback: () => void): void;
  copyText?(text: string): Promise<boolean>;
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
  undoRemaining: number;
  boardViewport: HitBox;
  panX: number;
  panY: number;
  boardWidth: number;
  boardHeight: number;
  safeTop: number;
  safeBottom: number;
  overlay: 'none' | 'words' | 'compose-list' | 'tile-picker' | 'result' | 'tutorial' | 'switch-confirm';
  scene: ExplorationScene;
  hasSession: boolean;
  preferences: Readonly<WechatPreferences>;
  discoveredSpeciesIds: readonly string[];
  status: string;
  controls: readonly HitBox[];
  visibleTileHits: readonly HitBox[];
  cutTileHits: readonly HitBox[];
  completedPuzzleIds: readonly string[];
}

interface SavedProgress { version: 1; completedPuzzleIds: string[]; discoveredSpeciesIds: string[] }
function loadProgress(store: WechatStore): SavedProgress {
  try {
    const value = store.get(WECHAT_STORAGE_KEY) as Partial<SavedProgress> | undefined;
    if (value?.version === 1 && Array.isArray(value.completedPuzzleIds) && Array.isArray(value.discoveredSpeciesIds)) {
      return { version: 1, completedPuzzleIds: carryForwardRegionalV7Completions(
        value.completedPuzzleIds.filter((id): id is string => typeof id === 'string')),
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
  private undoRemaining = UNDO_PER_PUZZLE;
  private progress: SavedProgress;
  private preferences: WechatPreferences = { ...DEFAULT_PREFERENCES };
  private scene: ExplorationScene = 'landing';
  private actions: WinningAction[] = [];
  private hasSession = false;
  private page = 0;
  private collectionPage = 0;
  private tierFilter = 0;
  private discoveredOnly = false;
  private speciesId: string | null = null;
  private storageWarning = '';
  private pageStatus = '';
  private tutorialStep = 0;
  private tutorialReturn: ExplorationScene = 'game';
  private pendingPuzzle: { tier: RegionalTier; stageIndex: number } | null = null;
  private panX = 0;
  private panY = 0;
  private pressedTileId: string | null = null;
  private flight: { character: string; fromX: number; fromY: number; toX: number; toY: number; started: number } | null = null;
  private framePending = false;
  private overlay: WechatStageSnapshot['overlay'] = 'none';
  private pickerIds: string[] = [];
  private wordPage = 0;
  private composePage = 0;
  private composeIndex = 0;
  private pickerPage = 0;
  private notice: { name: string; isNew: boolean; speciesCount: number } | null = null;
  private noticeSequence = 0;
  private initialDiscoveredIds = new Set<string>();
  private hits: HitBox[] = [];
  private tileHits: HitBox[] = [];
  private cutTileHits: HitBox[] = [];
  private stackHits: Array<{ box: HitBox; available: boolean }> = [];
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly loadedImages = new Set<string>();
  private touchOrigin: { x: number; y: number; time: number; inBoard: boolean; moved: boolean } | null = null;

  constructor(private readonly context: CanvasRenderingContext2D,
    private viewport: WechatViewport, private readonly store: WechatStore,
    assets?: WechatStageAssets, private readonly effects?: WechatStageEffects,
    options: { startAtHome?: boolean } = {}) {
    this.progress = loadProgress(store);
    this.initialDiscoveredIds = new Set(this.progress.discoveredSpeciesIds);
    this.state = createGameFromLevel(getRegionalV7Puzzle('CN-SC', 1, 1)!.level);
    try {
      this.preferences = readPreferences(store.get(WECHAT_PREFERENCES_KEY));
      const saved = store.get(WECHAT_SESSION_KEY);
      const restored = restoreWechatSession(saved);
      if (restored) {
        this.tier = restored.session.tier; this.stageIndex = restored.session.stageIndex;
        this.state = restored.state; this.history = restored.history;
        this.actions = restored.session.actions; this.undoRemaining = restored.session.undoRemaining;
        this.hasSession = true;
      } else if (saved != null) {
        this.storageWarning = '旧对局无法恢复，通关与观察记录仍保留。';
      }
    } catch { this.storageWarning = '本机存档暂不可用，退出可能丢失进度。'; }
    if (options.startAtHome === false) this.scene = 'game';
    if (assets) for (const key of ['back', 'pin', 'pan', 'undo', 'wordbook', 'retry']) {
      const image = assets.createImage();
      image.onload = () => { this.loadedImages.add(key); this.render(); };
      image.onerror = () => { this.images.delete(key); this.loadedImages.delete(key); };
      this.images.set(key, image);
      image.src = assets.pathFor(key);
    }
    this.render();
  }

  private icon(key: string, x: number, y: number, size: number, disabled = false): void {
    const image = this.images.get(key);
    if (!image || !this.loadedImages.has(key)) return;
    this.context.save();
    if (disabled) this.context.globalAlpha = 0.45;
    this.context.drawImage(image, x, y, size, size);
    this.context.restore();
  }

  private layout() {
    const safeTop = clamp(this.viewport.safeTop, 0, this.viewport.height - 100);
    const safeBottom = clamp(this.viewport.safeBottom, safeTop + 100, this.viewport.height);
    if (safeBottom - safeTop < 344) throw new Error('WeChat safe area is too short for fixed game controls');
    const ui = computeLayout({ windowWidth: this.viewport.width, windowHeight: this.viewport.height,
      safeArea: { top: safeTop, bottom: safeBottom }, menuButton: this.viewport.menuButton });
    return { ui, margin: ui.board.x, contentWidth: ui.board.w, safeTop, safeBottom,
      hudY: ui.topBar.y, controlsY: ui.toolbar.y, composeY: ui.compose.y - 6,
      trayY: ui.slotHeader.y,
      board: { id: 'board', x: ui.board.x, y: ui.board.y, width: ui.board.w, height: ui.board.h,
        label: '棋盘局部视窗' } satisfies HitBox };
  }

  private geometry() { return geometryForTier(this.tier); }
  private boardDisplay(board: HitBox) {
    const tiles = this.geometry().tiles;
    const minX = Math.min(...tiles.map((tile) => tile.x));
    const minY = Math.min(...tiles.map((tile) => tile.y));
    const maxX = Math.max(...tiles.map((tile) => tile.x));
    const maxY = Math.max(...tiles.map((tile) => tile.y));
    // The immutable level coordinates use a 44px full-grid pitch and 22px
    // half-grid offsets. This affine projection changes only presentation.
    const bounds = { x: board.x, y: board.y, w: board.width, h: board.height };
    const spanX = (maxX - minX) / 44 + 1, spanY = (maxY - minY) / 44 + 1;
    const metrics = this.tier <= 2
      ? computeDenseTutorialMetrics(bounds, spanX, spanY, this.tier === 1 ? 72 : 56)
      : computeBoardMetrics(bounds, spanX, spanY);
    const scaleX = metrics.pitchX / 44;
    const scaleY = metrics.pitchY / 44;
    const offsetX = (board.width - metrics.contentW) / 2;
    const offsetY = (board.height - metrics.contentH) / 2;
    return { metrics, minX, minY, scaleX, scaleY, offsetX, offsetY };
  }
  private overlayPageSize(height: number): number {
    return Math.max(1, Math.min(6, Math.floor((height - 110) / 48)));
  }
  private button(id: string, label: string, x: number, y: number, width: number, height: number,
    enabled = true): void {
    const box = { id, label, x, y, width, height };
    drawToolButton(this.context, x, y, width, height, enabled ? 'normal' : 'disabled');
    this.context.fillStyle = enabled ? color.ink : color.disabled;
    this.context.font = `700 14px ${font.sans}`;
    this.context.textAlign = 'center'; this.context.textBaseline = 'middle';
    this.context.fillText(label, x + width / 2, y + height / 2, width - 6);
    if (enabled) this.hits.push(box);
  }
  private label(text: string, x: number, y: number, size = 14, color = '#294b35'): void {
    this.context.fillStyle = color;
    this.context.font = `${size}px ${font.sans}`;
    this.context.textAlign = 'left'; this.context.textBaseline = 'middle';
    this.context.fillText(text, x, y, Math.max(40, this.viewport.width - x - 10));
  }

  render(): void {
    const ctx = this.context;
    const layout = this.layout();
    const display = this.boardDisplay(layout.board);
    const { metrics } = display;
    this.hits = []; this.tileHits = []; this.cutTileHits = []; this.stackHits = [];
    ctx.fillStyle = color.paper; ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);
    if (this.scene !== 'game') {
      drawExplorationPage(ctx, { scene: this.scene, width: this.viewport.width, top: layout.ui.topBar.y,
        bottom: layout.safeBottom, completed: this.progress.completedPuzzleIds,
        discovered: this.knownSpecies(), page: this.page, tierFilter: this.tierFilter,
        discoveredOnly: this.discoveredOnly, speciesId: this.speciesId,
        resumeLabel: this.hasSession ? `D${this.tier} · 第 ${this.stageIndex} 局` : null,
        vibration: this.preferences.vibration, motion: this.preferences.motion,
        status: this.pageStatus || this.storageWarning }, {
        button: (...args) => this.button(...args), text: (...args) => this.label(...args),
      });
      if (this.overlay === 'tutorial') this.drawTutorial(layout);
      return;
    }
    const boardPage = this.tier <= 2
      ? computeDenseBoardPage(layout.ui.board, metrics)
      : layout.ui.board;
    drawBoardPage(ctx, boardPage.x, boardPage.y, boardPage.w, boardPage.h);
    ctx.save(); ctx.beginPath(); ctx.rect(layout.board.x, layout.board.y, layout.board.width, layout.board.height); ctx.clip();
    const exposed = new Set(getExposedBoardTiles(this.state).map((tile) => tile.id));
    const tiles = this.state.boardTiles.filter((tile) => !tile.removed)
      .sort((a, b) => a.layer - b.layer || a.y - b.y || a.x - b.x);
    for (const tile of tiles) {
      const x = layout.board.x + display.offsetX + this.panX + (tile.x - display.minX) * display.scaleX;
      const y = layout.board.y + display.offsetY + this.panY + (tile.y - display.minY) * display.scaleY;
      if (x + metrics.tileW < layout.board.x || x > layout.board.x + layout.board.width ||
        y + metrics.tileH < layout.board.y || y > layout.board.y + layout.board.height) continue;
      const available = exposed.has(tile.id) && this.state.phase === 'playing';
      const tileStyle = { serifFamily: font.serifFallback,
        fontSize: Math.round(metrics.tileW * (metrics.tileW === 44 ? 0.5 : 0.54)) };
      const complete = x >= layout.board.x && y >= layout.board.y &&
        x + metrics.tileW <= layout.board.x + layout.board.width &&
        y + metrics.tileH <= layout.board.y + layout.board.height;
      if (available && complete) drawExposedTile(ctx, x, y, metrics.tileW, metrics.tileH, tile.character,
        tileStyle, tile.id === this.pressedTileId);
      else if (available) drawCutTile(ctx, x, y, metrics.tileW, metrics.tileH, tile.character, tileStyle);
      else drawCoveredTile(ctx, x, y, metrics.tileW, metrics.tileH, tile.character, tileStyle, tile.layer);
      const box = { id: tile.id, label: tile.character, x, y, width: metrics.tileW, height: metrics.tileH };
      this.stackHits.push({ box, available });
      if (available) {
        if (complete) this.tileHits.push(box);
        else this.cutTileHits.push(box);
      }
    }
    ctx.restore();
    const ui = layout.ui;
    const occupied = this.state.tray.filter(Boolean).length;
    const formable = findPlayableBirds(this.state);
    this.composeIndex = clamp(this.composeIndex, 0, Math.max(0, formable.length - 1));
    const selected = formable[this.composeIndex];
    const consumedIndices = new Set<number>();
    if (selected) for (const character of selected.characters) {
      const index = this.state.tray.findIndex((tile, slot) => tile?.character === character && !consumedIndices.has(slot));
      if (index >= 0) consumedIndices.add(index);
    }
    this.label('字槽', ui.slotHeader.x, ui.slotHeader.y + ui.slotHeader.h / 2, 11, color.muted);
    ctx.fillStyle = occupied === 10 ? color.ochre : color.ink;
    ctx.font = `900 15px ${font.serifFallback}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(`${occupied} / 10`, ui.slotHeader.x + ui.slotHeader.w, ui.slotHeader.y + ui.slotHeader.h / 2);
    drawTray(ctx, ui.tray.x, ui.tray.y, ui.tray.w, ui.tray.h);
    this.state.tray.forEach((tile, index) => {
      const slot = ui.slotCells[index];
      drawSlotCell(ctx, slot.x, slot.y, slot.w, slot.h,
        tile ? (this.state.phase === 'game_over' ? 'alert' : consumedIndices.has(index) ? 'willConsume' : 'filled') : 'empty', tile?.character ?? '',
        { serifFamily: font.serifFallback, fontSize: ui.compact ? font.slot320 : font.slot390 });
    });
    if (this.flight) {
      const elapsed = Date.now() - this.flight.started;
      if (elapsed >= 180) this.flight = null;
      else {
        const progress = 1 - Math.pow(1 - elapsed / 180, 3);
        const x = this.flight.fromX + (this.flight.toX - this.flight.fromX) * progress;
        const y = this.flight.fromY + (this.flight.toY - this.flight.fromY) * progress -
          Math.sin(Math.PI * progress) * 18;
        ctx.save(); ctx.globalAlpha = 1 - 0.25 * progress;
        drawExposedTile(ctx, x, y, 34 - 6 * progress, 40 - 4 * progress, this.flight.character,
          { serifFamily: font.serifFallback, fontSize: 18 });
        ctx.restore();
        if (!this.framePending && this.effects?.requestFrame) {
          this.framePending = true;
          this.effects.requestFrame(() => { this.framePending = false; this.render(); });
        }
      }
    }
    if (formable.length) {
      const primary = selected;
      const showAll = formable.length > 1;
      const primaryX = showAll ? ui.compose.x + 50 : ui.compose.x;
      const primaryWidth = showAll ? ui.compose.w - 162 : ui.compose.w;
      if (showAll) this.button('compose-prev-option', '‹', ui.compose.x, ui.compose.y, 44, ui.compose.h);
      drawPrimaryButton(ctx, primaryX, ui.compose.y, primaryWidth, ui.compose.h);
      ctx.fillStyle = color.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${showAll ? 20 : 23}px ${font.serifFallback}`;
      ctx.fillText(`组词 · ${primary.name}`, primaryX + primaryWidth / 2, ui.compose.y + ui.compose.h / 2, primaryWidth - 12);
      this.hits.push({ id: `compose:${primary.id}`, label: primary.name, x: primaryX, y: ui.compose.y,
        width: primaryWidth, height: ui.compose.h });
      if (showAll) {
        this.button('compose-next-option', '›', primaryX + primaryWidth + 6, ui.compose.y, 44, ui.compose.h);
        this.button('compose-all', `全部${formable.length}`,
          primaryX + primaryWidth + 56, ui.compose.y, 56, ui.compose.h);
      }
    } else {
      roundRectPath(ctx, ui.compose.x, ui.compose.y, ui.compose.w, ui.compose.h, 12);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = color.lineSoft; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = this.state.phase === 'game_over' ? color.ochreInk : color.muted;
      ctx.font = `13px ${font.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.state.phase === 'game_over' ? '字槽已满 · 拼不出本关鸟名' : '凑齐一个鸟名，这里出现「组词」',
        ui.compose.x + ui.compose.w / 2, ui.compose.y + ui.compose.h / 2, ui.compose.w - 16);
    }
    for (const [index, item] of ui.toolbarButtons.entries()) {
      const enabled = index !== 0 || (this.history.length > 0 && this.undoRemaining > 0 && this.state.phase !== 'level_complete');
      const emphasis = this.state.phase === 'game_over' && index !== 1;
      const variant = enabled ? (emphasis ? 'emphasis' : 'normal') : 'disabled';
      drawToolButton(ctx, item.x, item.y, item.w, item.h, variant);
      const text = ['撤销', '本关词表', '重试'][index];
      ctx.font = `700 14px ${font.sans}`; ctx.fillStyle = enabled ? (emphasis ? color.ochreInk : color.ink) : color.disabled;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, item.x + item.w / 2 + (index === 0 ? 3 : 8), item.y + item.h / 2, item.w - 30);
      this.icon(['undo', 'wordbook', 'retry'][index], item.x + 9, item.y + (item.h - 18) / 2, 18, !enabled);
      if (index === 0) drawCountBadge(ctx, item.x + item.w - 17, item.y + item.h / 2,
        this.undoRemaining, variant, font.sans);
      if (enabled) this.hits.push({ id: ['undo', 'words', 'retry'][index], label: text,
        x: item.x, y: item.y, width: item.w, height: item.h });
    }
    this.button('home', '', 6, ui.topBar.y, 44, 44);
    this.icon('back', 17, ui.topBar.y + 11, 22);
    this.icon('pin', 56, ui.topBar.y + 8, 14);
    this.label(`四川 · D${this.tier}`, 73, ui.topBar.y + 15, 16, color.ink);
    this.label(`第 ${this.stageIndex}/5 局  ·  得分 ${this.state.score}`, 58, ui.topBar.y + 34, 11, color.muted);
    const remaining = this.state.boardTiles.filter((tile) => !tile.removed).length;
    const badgeX = ui.topBar.w - 74;
    roundRectPath(ctx, badgeX, ui.topBar.y + 7, 70, 30, 8);
    ctx.fillStyle = color.woodFace; ctx.fill(); ctx.strokeStyle = color.woodDark; ctx.stroke();
    ctx.fillStyle = color.ink; ctx.textAlign = 'center'; ctx.font = `700 12px ${font.sans}`;
    ctx.fillText(`剩 ${remaining} 字`, badgeX + 35, ui.topBar.y + 22);
    if (this.state.phase !== 'playing' && this.overlay === 'none') this.overlay = 'result';
    if (this.overlay !== 'none') this.drawOverlay(layout);
    if (this.notice && (this.overlay === 'none' || this.overlay === 'result')) this.drawNotice(layout);
  }

  private drawNotice(layout: ReturnType<WechatBirdStage['layout']>): void {
    const notice = this.notice!;
    const ctx = this.context;
    const height = notice.isNew ? 104 : 44;
    const x = 16; const y = layout.ui.slotHeader.y - height - 12;
    roundRectPath(ctx, x, y, this.viewport.width - 32, height, 14);
    ctx.fillStyle = color.card; ctx.fill(); ctx.strokeStyle = color.line; ctx.stroke();
    if (notice.isNew) {
      roundRectPath(ctx, x + 12, y + 12, 78, 78, 10);
      ctx.fillStyle = color.paper; ctx.fill();
      ctx.fillStyle = color.disabled; ctx.font = `30px ${font.serifFallback}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('鸟', x + 51, y + 51);
      this.label('发现新鸟', x + 102, y + 25, 12, color.teal);
      ctx.fillStyle = color.ink; ctx.font = `900 25px ${font.serifFallback}`;
      ctx.textAlign = 'left'; ctx.fillText(notice.name, x + 102, y + 54,
        this.viewport.width - x - 136);
      this.label(this.state.phase === 'level_complete' ? `已记入观察手册 · 第 ${notice.speciesCount} 种` : '通关后记入观察手册', x + 102, y + 80, 11, color.muted);
      ctx.fillStyle = color.seal; ctx.font = `700 18px ${font.serifFallback}`;
      ctx.textAlign = 'right'; ctx.fillText('新', this.viewport.width - 30, y + 24);
    } else {
      this.label(`+ ${notice.name}`, x + 14, y + height / 2, 15, color.teal);
    }
  }

  private drawOverlay(layout: ReturnType<WechatBirdStage['layout']>): void {
    if (this.overlay === 'tutorial') { this.drawTutorial(layout); return; }
    if (this.overlay === 'switch-confirm') {
      const { safeTop, safeBottom } = layout;
      const y = safeTop + (safeBottom - safeTop - 230) / 2;
      this.context.fillStyle = color.scrimPause;
      this.context.fillRect(0, 0, this.viewport.width, this.viewport.height);
      drawBoardPage(this.context, 12, y, this.viewport.width - 24, 230);
      this.hits = [];
      this.label('要开始另一局吗？', 28, y + 34, 21, color.ink);
      this.label('当前对局会被替换，已通关记录保留。', 28, y + 72, 13, color.muted);
      this.button('switch-confirm', '开始所选关卡', 28, y + 104, this.viewport.width - 56, 44);
      this.button('switch-cancel', '保留当前对局', 28, y + 160, this.viewport.width - 56, 44);
      return;
    }
    const ctx = this.context;
    const fullScreen = this.overlay === 'words' ||
      (this.overlay === 'result' && layout.board.height < 300);
    const x = fullScreen ? 12 : this.overlay === 'compose-list' ? 12 : 24;
    const resultHeight = Math.min(300, layout.board.height - 40);
    const y = fullScreen ? layout.safeTop + 8 : this.overlay === 'compose-list'
      ? Math.max(layout.board.y + 12, layout.ui.slotHeader.y - 370)
      : layout.board.y + (layout.board.height - resultHeight) / 2;
    const width = this.viewport.width - x * 2;
    const height = fullScreen ? layout.safeBottom - y - 8 : this.overlay === 'compose-list'
      ? layout.ui.slotHeader.y - y - 8 : resultHeight;
    ctx.fillStyle = this.overlay === 'words' ? color.scrimPause : color.scrimLight;
    ctx.fillRect(0, fullScreen ? 0 : layout.board.y, this.viewport.width,
      fullScreen ? this.viewport.height : layout.board.height);
    roundRectPath(ctx, x, y, width, height, fullScreen ? 18 : 16);
    ctx.fillStyle = fullScreen ? color.page : color.card; ctx.fill();
    ctx.strokeStyle = color.line; ctx.stroke();
    this.hits = [];
    if (this.overlay === 'words') {
      this.label('本关词表', x + 16, y + 27, 22, color.ink);
      this.label(`四川 · D${this.tier}  可用 ${this.state.activeCompositions.length} 个鸟名 · 已拼出 ${this.state.completedBirdCount} 次`,
        x + 16, y + 59, 11, color.muted);
      const names = this.state.activeCompositions;
      const rows = Math.max(1, Math.floor((height - 164) / 52));
      const pageSize = rows * 2;
      const pages = Math.max(1, Math.ceil(names.length / pageSize));
      this.wordPage = clamp(this.wordPage, 0, pages - 1);
      names.slice(this.wordPage * pageSize, this.wordPage * pageSize + pageSize).forEach((bird, index) => {
        const column = index % 2; const row = Math.floor(index / 2);
        const cellW = (width - 40) / 2;
        const cellX = x + 14 + column * (cellW + 12);
        const cellY = y + 82 + row * 52;
        const used = (this.state.compositionQuotas[bird.id] ?? 0) -
          (this.state.remainingCompositionQuotas[bird.id] ?? 0);
        roundRectPath(ctx, cellX, cellY, cellW, 44, 8);
        ctx.fillStyle = used ? color.woodFace : color.page; ctx.fill();
        ctx.strokeStyle = used ? color.woodDark : color.lineSoft;
        ctx.setLineDash(used ? [] : [4, 3]); ctx.stroke(); ctx.setLineDash([]);
        this.label(bird.name, cellX + 8, cellY + 22, 14, used ? color.ink : color.muted);
      });
      this.button('words-prev', '上一页', x + 12, y + height - 52, 78, 44, this.wordPage > 0);
      this.button('words-next', '下一页', x + 96, y + height - 52, 78, 44, this.wordPage + 1 < pages);
      this.button('overlay-close', '关闭', x + width - 90, y + height - 52, 78, 44);
    } else if (this.overlay === 'compose-list') {
      const birds = findPlayableBirds(this.state);
      const pageSize = this.overlayPageSize(height);
      const pages = Math.max(1, Math.ceil(birds.length / pageSize));
      this.composePage = clamp(this.composePage, 0, pages - 1);
      this.label(`可拼 ${birds.length} 个鸟名 · 选一个组词`, x + 12, y + 25, 16, color.ink);
      birds.slice(this.composePage * pageSize, this.composePage * pageSize + pageSize).forEach((bird, index) => {
        const rowX = x + 12; const rowY = y + 54 + index * 48;
        const selected = birds[this.composeIndex]?.id === bird.id;
        roundRectPath(ctx, rowX, rowY, width - 24, 44, 8);
        ctx.fillStyle = selected ? color.tealTint : color.page; ctx.fill();
        ctx.strokeStyle = selected ? color.teal : color.line;
        ctx.lineWidth = selected ? 2 : 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(rowX + 21, rowY + 22, 7, 0, Math.PI * 2);
        ctx.strokeStyle = color.teal; ctx.lineWidth = 1.5; ctx.stroke();
        if (selected) { ctx.beginPath(); ctx.arc(rowX + 21, rowY + 22, 3, 0, Math.PI * 2); ctx.fillStyle = color.teal; ctx.fill(); }
        ctx.fillStyle = color.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.font = `900 19px ${font.serifFallback}`;
        ctx.fillText(bird.name, rowX + 38, rowY + 22, width - 106);
        ctx.textAlign = 'right'; ctx.font = `12px ${font.sans}`;
        ctx.fillText(`${bird.characters.length} 字`, rowX + width - 40, rowY + 22);
        this.hits.push({ id: `compose:${bird.id}`, label: bird.name,
          x: rowX, y: rowY, width: width - 24, height: 44 });
      });
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
      const won = this.state.phase === 'level_complete';
      this.label(won ? '本局完成！' : '字槽满了', x + 22, y + 38, 20, color.ink);
      if (!won) this.button('home', '关卡', x + width - 56, y + 12, 44, 44);
      this.label(won
        ? `得分 ${this.state.score} · 拼出 ${this.state.completedBirdCount} 次`
        : '这 10 个字拼不出本关的任何鸟名。', x + 22, y + 84, 14, color.muted);
      this.label(won
        ? `其中新发现 ${this.state.discoveredBirdIds.filter((id) => !this.initialDiscoveredIds.has(id)).length} 种`
        : '撤销一步换个字，或者重开本局。',
        x + 22, y + 108, 14, color.muted);
      if (won) {
        const completed = this.state.activeCompositions.filter((bird) =>
          (this.state.remainingCompositionQuotas[bird.id] ?? 0) < (this.state.compositionQuotas[bird.id] ?? 0));
        const labels = completed.slice(0, 3).map((bird) => bird.name);
        if (completed.length > 3) labels.push(`+${completed.length - 3}`);
        let tagX = x + 18;
        for (const name of labels) {
          const tagW = Math.min(68, Math.max(42, name.length * 13 + 16));
          if (tagX + tagW > x + width - 12) break;
          roundRectPath(ctx, tagX, y + 137, tagW, 30, 7);
          ctx.fillStyle = color.woodFace; ctx.fill(); ctx.strokeStyle = color.woodDark; ctx.stroke();
          ctx.fillStyle = color.ink; ctx.font = `700 12px ${font.serifFallback}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(name, tagX + tagW / 2, y + 152, tagW - 8);
          tagX += tagW + 6;
        }
      }
      const actionY = y + height - 108;
      const primaryW = Math.max(110, (width - 42) * 0.6);
      const primaryId = won ? 'next-puzzle' : this.undoRemaining > 0 && this.history.length ? 'undo' : 'retry';
      drawPrimaryButton(ctx, x + 12, actionY, primaryW, 50);
      ctx.fillStyle = color.white; ctx.font = `700 14px ${font.sans}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(won ? '下一局' : primaryId === 'undo' ? `撤销一步 · 剩 ${this.undoRemaining} 次` : '重试本局',
        x + 12 + primaryW / 2, actionY + 25, primaryW - 12);
      this.hits.push({ id: primaryId, label: primaryId, x: x + 12, y: actionY, width: primaryW, height: 50 });
      this.button(primaryId === 'retry' ? 'home' : 'retry', primaryId === 'retry' ? '返回关卡' : '重试本局',
        x + 18 + primaryW, actionY + 3, width - primaryW - 30, 44);
      this.button(won ? 'home' : 'words', won ? '返回关卡' : '先看看本关词表',
        x + 12, y + height - 50, width - 24, 44);
    }
  }

  private knownSpecies(): string[] {
    return V7_SPECIES_MASTER.filter((bird) => this.progress.discoveredSpeciesIds.includes(bird.id)).map((bird) => bird.id);
  }
  private writeStorage(key: string, value: unknown): void {
    try { this.store.set(key, value); }
    catch { this.storageWarning = '本机存档暂不可用，退出可能丢失进度。'; }
  }
  private savePreferences(): void { this.writeStorage(WECHAT_PREFERENCES_KEY, this.preferences); }
  saveSession(): void {
    if (!this.hasSession || this.state.phase === 'level_complete') return;
    const puzzle = getRegionalV7Puzzle('CN-SC', this.tier, this.stageIndex)!;
    const session: WechatSession = { version: 1, rulesetVersion: GAMEPLAY_RULESET_VERSION,
      contentVersion: REGIONAL_V7_CONTENT_VERSION, puzzleId: puzzle.record.puzzleId,
      boardHash: puzzle.record.boardHash, tier: this.tier, stageIndex: this.stageIndex,
      actions: this.actions.map((action) => ({ ...action })), undoRemaining: this.undoRemaining };
    this.writeStorage(WECHAT_SESSION_KEY, session);
  }
  suspend(): void {
    this.touchCancel(); this.flight = null; this.notice = null; this.noticeSequence++;
    this.saveSession();
  }
  resume(): void { this.framePending = false; this.touchCancel(); this.render(); }
  private showScene(scene: ExplorationScene): void {
    this.scene = scene; this.overlay = 'none'; this.page = 0; this.pageStatus = '';
    this.notice = null; this.noticeSequence++; this.flight = null; this.touchOrigin = null;
    this.pressedTileId = null; this.render();
  }
  private beginPuzzle(tier: RegionalTier, stageIndex: number): void {
    this.openPuzzle(tier, stageIndex);
    if (!this.preferences.tutorialSeen) {
      this.tutorialStep = 0; this.tutorialReturn = 'game'; this.overlay = 'tutorial'; this.render();
    }
  }
  private requestPuzzle(tier: RegionalTier, stageIndex: number): void {
    if (this.hasSession && this.actions.length && this.state.phase !== 'level_complete') {
      this.pendingPuzzle = { tier, stageIndex }; this.scene = 'game';
      this.overlay = 'switch-confirm'; this.render();
    } else this.beginPuzzle(tier, stageIndex);
  }
  private drawTutorial(layout: ReturnType<WechatBirdStage['layout']>): void {
    const y = layout.safeTop + (layout.safeBottom - layout.safeTop - 240) / 2;
    const steps = [
      ['点亮起的字', '亮起的木牌可以拿取，被压住的字要先揭开。', '点一下，字就进入下方字槽。'],
      ['凑齐鸟名再组词', '字的先后顺序不限，凑齐后点「组词」。', '本关词表可查看全部鸟名与剩余次数。'],
      ['留意十格字槽', '字槽满且不能组词时，这局就失败了。', '每局可撤销 3 次；也可以重试同一道题。'],
    ];
    this.context.fillStyle = color.scrimPause;
    this.context.fillRect(0, 0, this.viewport.width, this.viewport.height);
    drawBoardPage(this.context, 12, y, this.viewport.width - 24, 240);
    this.hits = [];
    this.label(`玩法 ${this.tutorialStep + 1}/3`, 28, y + 28, 13, color.teal);
    this.label(steps[this.tutorialStep][0], 28, y + 66, 24, color.ink);
    this.label(steps[this.tutorialStep][1], 28, y + 103, 13, color.muted);
    this.label(steps[this.tutorialStep][2], 28, y + 130, 13, color.muted);
    this.button('tutorial-next', this.tutorialStep < 2 ? '下一步' : '知道了', 28, y + 161, this.viewport.width - 56, 44);
    this.button('tutorial-close', '跳过说明', this.viewport.width - 106, y + 12, 78, 44);
  }
  resize(viewport: WechatViewport): void { this.viewport = viewport; this.render(); }
  openPuzzle(tier: RegionalTier, stageIndex: number): void {
    const puzzle = getRegionalV7Puzzle('CN-SC', tier, stageIndex);
    if (!puzzle) throw new Error(`Unknown Sichuan puzzle D${tier}-${stageIndex}`);
    this.tier = tier; this.stageIndex = stageIndex;
    this.state = createGameFromLevel(puzzle.level);
    this.scene = 'game'; this.hasSession = true; this.actions = [];
    this.history = []; this.undoRemaining = UNDO_PER_PUZZLE;
    this.panX = 0; this.panY = 0;
    this.pressedTileId = null; this.flight = null; this.overlay = 'none';
    this.wordPage = 0; this.composePage = 0; this.composeIndex = 0;
    this.notice = null; this.noticeSequence++;
    this.initialDiscoveredIds = new Set(this.progress.discoveredSpeciesIds);
    this.pickerPage = 0; this.saveSession(); this.render();
  }
  private transition(next: GameState, action: WinningAction): void {
    if (next === this.state) return;
    const newlyTaken = next.boardTiles.find((tile) => tile.removed &&
      !this.state.boardTiles.find((previous) => previous.id === tile.id)?.removed);
    if (newlyTaken && this.preferences.motion && this.effects?.requestFrame) {
      const from = this.tileHits.find((hit) => hit.id === newlyTaken.id);
      const slot = this.layout().ui.slotCells[this.state.tray.findIndex((tile) => tile === null)];
      if (from && slot) this.flight = { character: newlyTaken.character,
        fromX: from.x + from.width / 2 - 17, fromY: from.y + from.height / 2 - 20,
        toX: slot.x + slot.w / 2 - 14, toY: slot.y + slot.h / 2 - 18, started: Date.now() };
    }
    if (this.preferences.vibration) {
      if (next.phase === 'game_over' && this.state.phase !== 'game_over') this.effects?.vibrate('heavy');
      else if (next.completedBirdCount > this.state.completedBirdCount) this.effects?.vibrate('medium');
      else if (newlyTaken) this.effects?.vibrate('light');
    }
    if (next.completedBirdCount > this.state.completedBirdCount && next.lastCompletedBird) {
      const bird = next.activeCompositions.find((item) => item.id === next.lastCompletedBird!.birdId);
      if (bird) {
        const isNew = bird.speciesId !== null &&
          !this.initialDiscoveredIds.has(bird.speciesId) &&
          !this.state.discoveredBirdIds.includes(bird.speciesId);
        const speciesCount = new Set([...this.progress.discoveredSpeciesIds, ...next.discoveredBirdIds]).size;
        this.notice = { name: bird.name, isNew, speciesCount };
        const sequence = ++this.noticeSequence;
        setTimeout(() => {
          if (this.noticeSequence === sequence) { this.notice = null; this.render(); }
        }, isNew ? 1500 : 600);
      }
    }
    this.history.push(this.state);
    this.actions.push(action); this.hasSession = true;
    this.state = next;
    this.composeIndex = 0;
    if (next.phase === 'level_complete') {
      this.progress = { version: 1,
        completedPuzzleIds: [...new Set([...this.progress.completedPuzzleIds, next.puzzleId!])],
        discoveredSpeciesIds: [...new Set([...this.progress.discoveredSpeciesIds, ...next.discoveredBirdIds])] };
      this.writeStorage(WECHAT_STORAGE_KEY, this.progress);
      // Only clear the old session after the completion was saved. If progress
      // storage fails, retain the pre-win session so the final action can retry.
      try {
        const saved = this.store.get(WECHAT_STORAGE_KEY) as SavedProgress | undefined;
        if (saved?.completedPuzzleIds.includes(next.puzzleId!)) this.writeStorage(WECHAT_SESSION_KEY, null);
      } catch { /* The last pre-win checkpoint remains recoverable. */ }
      this.hasSession = false;
    } else this.saveSession();
    this.render();
  }
  undo(): void {
    if (this.state.phase === 'level_complete' || this.undoRemaining === 0) return;
    const previous = this.history.pop();
    if (!previous) return;
    this.undoRemaining--;
    this.actions.pop();
    this.state = previous; this.overlay = 'none'; this.saveSession(); this.render();
  }
  retry(): void { this.openPuzzle(this.tier, this.stageIndex); }

  touchStart(x: number, y: number): void {
    const board = this.layout().board;
    this.touchOrigin = { x, y, time: Date.now(),
      inBoard: this.overlay === 'none' && inside(board, x, y), moved: false };
    this.pressedTileId = this.touchOrigin.inBoard
      ? this.tileHits.find((hit) => inside(hit, x, y))?.id ?? null : null;
    if (this.pressedTileId) this.render();
  }
  touchMove(x: number, y: number): void {
    if (!this.touchOrigin?.inBoard) return;
    const origin = this.touchOrigin;
    if (origin.moved || Math.hypot(x - origin.x, y - origin.y) < 8) return;
    origin.moved = true;
    if (!this.pressedTileId) return;
    this.pressedTileId = null;
    this.render();
  }
  touchEnd(x: number, y: number): void {
    const origin = this.touchOrigin;
    this.touchOrigin = null;
    const wasPressed = this.pressedTileId !== null;
    this.pressedTileId = null;
    if (!origin || origin.moved || Math.hypot(x - origin.x, y - origin.y) >= 8 || Date.now() - origin.time > 600) {
      if (wasPressed) this.render();
      return;
    }
    const before = this.state;
    this.tap(x, y);
    if (wasPressed && before === this.state) this.render();
  }
  touchCancel(): void {
    this.touchOrigin = null;
    if (this.pressedTileId) { this.pressedTileId = null; this.render(); }
  }
  tap(x: number, y: number): void {
    const control = this.hits.find((hit) => inside(hit, x, y));
    if (control) {
      if (control.id === 'scene-back') {
        const parent = this.scene === 'species' ? 'collection' : this.scene === 'sources' ? 'settings' : 'landing';
        this.showScene(parent);
        if (parent === 'collection') { this.page = this.collectionPage; this.render(); }
      }
      else if (control.id === 'continue-game') {
        this.showScene('game');
        if (!this.preferences.tutorialSeen) {
          this.tutorialStep = 0; this.tutorialReturn = 'game'; this.overlay = 'tutorial'; this.render();
        }
      }
      else if (control.id === 'start-game') {
        const next = REGIONAL_V7_PUZZLES.find((item) => !this.progress.completedPuzzleIds.includes(item.record.puzzleId)) ?? REGIONAL_V7_PUZZLES[0];
        this.beginPuzzle(next.record.tier, next.record.stageIndex);
      }
      else if (['levels', 'collection', 'settings', 'sources'].includes(control.id)) this.showScene(control.id as ExplorationScene);
      else if (control.id === 'page-prev' || control.id === 'page-next') {
        const size = explorationPageSize(this.layout().ui.topBar.y, this.layout().safeBottom, this.scene === 'collection');
        const total = this.scene === 'collection' ? collectionSpecies({ tierFilter: this.tierFilter,
          discoveredOnly: this.discoveredOnly, discovered: this.knownSpecies() }).length : 25;
        this.page = clamp(this.page + (control.id === 'page-prev' ? -1 : 1), 0, Math.max(0, Math.ceil(total / size) - 1));
        this.render();
      }
      else if (control.id === 'filter-tier') { this.tierFilter = (this.tierFilter + 1) % 6; this.page = 0; this.render(); }
      else if (control.id === 'filter-discovered') { this.discoveredOnly = !this.discoveredOnly; this.page = 0; this.render(); }
      else if (control.id.startsWith('species:')) {
        this.collectionPage = this.page; this.speciesId = control.id.slice(8); this.showScene('species');
      }
      else if (control.id === 'toggle-vibration' || control.id === 'toggle-motion') {
        if (control.id === 'toggle-vibration') this.preferences.vibration = !this.preferences.vibration;
        else { this.preferences.motion = !this.preferences.motion; this.flight = null; }
        this.savePreferences(); this.render();
      }
      else if (control.id === 'help') {
        this.tutorialReturn = this.scene; this.tutorialStep = 0; this.overlay = 'tutorial'; this.render();
      }
      else if (control.id === 'tutorial-next' || control.id === 'tutorial-close') {
        if (control.id === 'tutorial-next' && this.tutorialStep < 2) this.tutorialStep++;
        else {
          this.preferences.tutorialSeen = true; this.savePreferences();
          this.overlay = 'none'; this.scene = this.tutorialReturn;
        }
        this.render();
      }
      else if (control.id === 'copy-source') {
        this.pageStatus = '正在复制…'; this.render();
        const sourceScene = this.scene;
        Promise.resolve().then(() => this.effects?.copyText?.(REGIONAL_V7_SOURCES[0].url) ?? false)
          .then((ok) => { if (this.scene === sourceScene) { this.pageStatus = ok ? '已复制来源链接' : '复制失败，请在支持的环境重试'; this.render(); } })
          .catch(() => { if (this.scene === sourceScene) { this.pageStatus = '复制失败，请在支持的环境重试'; this.render(); } });
      }
      else if (control.id === 'switch-confirm' && this.pendingPuzzle) {
        const target = this.pendingPuzzle; this.pendingPuzzle = null;
        this.beginPuzzle(target.tier, target.stageIndex);
      }
      else if (control.id === 'switch-cancel') { this.pendingPuzzle = null; this.showScene('levels'); }
      else if (control.id === 'undo') this.undo();
      else if (control.id === 'retry') this.retry();
      else if (control.id === 'next-puzzle') {
        if (this.stageIndex < 5) this.openPuzzle(this.tier, this.stageIndex + 1);
        else if (this.tier < 5) this.openPuzzle((this.tier + 1) as RegionalTier, 1);
        else this.showScene('landing');
      }
      else if (control.id === 'home') { this.saveSession(); this.showScene('landing'); }
      else if (control.id.startsWith('open:')) {
        const [, tier, index] = control.id.split(':');
        this.requestPuzzle(Number(tier) as RegionalTier, Number(index));
      }
      else if (control.id === 'words') { this.overlay = 'words'; this.render(); }
      else if (control.id === 'words-prev') { this.wordPage--; this.render(); }
      else if (control.id === 'words-next') { this.wordPage++; this.render(); }
      else if (control.id === 'compose-all') { this.composePage = 0; this.overlay = 'compose-list'; this.render(); }
      else if (control.id === 'compose-prev-option' || control.id === 'compose-next-option') {
        const length = findPlayableBirds(this.state).length;
        this.composeIndex = (this.composeIndex + (control.id === 'compose-prev-option' ? -1 : 1) + length) % length;
        this.render();
      }
      else if (control.id === 'compose-prev') { this.composePage--; this.render(); }
      else if (control.id === 'compose-next') { this.composePage++; this.render(); }
      else if (control.id === 'picker-prev') { this.pickerPage--; this.render(); }
      else if (control.id === 'picker-next') { this.pickerPage++; this.render(); }
      else if (control.id === 'overlay-close') { this.overlay = 'none'; this.render(); }
      else if (control.id.startsWith('compose:')) {
        if (this.overlay === 'compose-list') {
          this.composeIndex = findPlayableBirds(this.state).findIndex((bird) => bird.id === control.id.slice(8));
          this.overlay = 'none'; this.render();
        } else {
          this.overlay = 'none'; this.transition(composeBird(this.state, control.id.slice(8)), { type: 'compose', birdId: control.id.slice(8) });
        }
      }
      else if (control.id.startsWith('pick:')) {
        this.overlay = 'none'; this.transition(selectBoardTile(this.state, control.id.slice(5)), { type: 'take', tileId: control.id.slice(5) });
      }
      return;
    }
    if (this.scene !== 'game' || this.overlay !== 'none' || this.state.phase !== 'playing') return;
    const board = this.layout().board;
    if (!inside(board, x, y)) return;
    const topmost = [...this.stackHits].reverse().find((item) => inside(item.box, x, y));
    if (topmost && !topmost.available) return;
    const matching = this.tileHits.filter((hit) => inside(hit, x, y));
    if (matching.length === 1) this.transition(selectBoardTile(this.state, matching[0].id), { type: 'take', tileId: matching[0].id });
    else if (matching.length > 1) {
      this.pickerIds = matching.map((item) => item.id);
      this.pickerPage = 0;
      this.overlay = 'tile-picker'; this.render();
    }
  }
  getState(): GameState { return this.state; }
  snapshot(): WechatStageSnapshot {
    const board = this.layout().board;
    const display = this.boardDisplay(board);
    return { puzzleId: this.state.puzzleId!, phase: this.state.phase,
      remainingTiles: this.state.boardTiles.filter((tile) => !tile.removed).length,
      trayOccupancy: this.state.tray.filter(Boolean).length, score: this.state.score,
      completedBirdCount: this.state.completedBirdCount, undoRemaining: this.undoRemaining, boardViewport: board,
      panX: this.panX, panY: this.panY,
      boardWidth: display.metrics.contentW + display.offsetX + 6,
      boardHeight: display.metrics.contentH + display.offsetY + 6,
      safeTop: this.layout().safeTop, safeBottom: this.layout().safeBottom,
      overlay: this.overlay, controls: [...this.hits], visibleTileHits: [...this.tileHits],
      scene: this.scene, hasSession: this.hasSession, preferences: { ...this.preferences },
      discoveredSpeciesIds: this.knownSpecies(), status: this.pageStatus || this.storageWarning,
      cutTileHits: [...this.cutTileHits],
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
