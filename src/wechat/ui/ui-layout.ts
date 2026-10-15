/**
 * 《字里有鸟》对局主屏 · 布局计算（纯函数，无副作用，可单测）
 *
 * 输入来自微信 API：
 *   const sys = wx.getSystemInfoSync();          // windowWidth / windowHeight / safeArea / pixelRatio
 *   const menu = wx.getMenuButtonBoundingClientRect(); // 右上角胶囊
 * 输出为逻辑像素矩形。参考值（设计稿）：
 *   390×844 → board {x:8,y:95,w:374,h:521}, tile 48×54, 不平移
 *   320×568 → board {x:4,y:66,w:312,h:334}, tile 44×44, 棋盘完整显示
 */

export interface Rect { x: number; y: number; w: number; h: number; }

export interface ScreenInput {
  windowWidth: number;
  windowHeight: number;
  safeArea?: { top: number; bottom: number };          // 来自 getSystemInfoSync().safeArea
  menuButton?: { top: number; left: number; height: number }; // 来自 getMenuButtonBoundingClientRect()
}

export interface GameLayout {
  compact: boolean;           // 宽度 < 360 的小屏
  topBar: Rect;               // 返回 + 关卡信息 + 剩余字数（右侧已让出胶囊）
  board: Rect;                // 固定棋盘；字牌投影必须完整落在这里
  slotHeader: Rect;           // “字槽” + n/10
  tray: Rect;                 // 活字盘底
  slotCells: Rect[];          // 10 个格子（仅展示，不可点）
  compose: Rect;              // 组词行
  toolbar: Rect;              // 撤销 / 本关词表 / 重试 所在行
  toolbarButtons: [Rect, Rect, Rect];
  homeInset: number;          // 底部 Home 指示条安全区高度
}

const SLOT_COUNT = 10;
const CELL_GAP = 2;
const TRAY_PAD = 4;

export function computeLayout(input: ScreenInput): GameLayout {
  const W = input.windowWidth;
  const H = input.windowHeight;
  const compact = W < 360;
  const safeTop = input.safeArea?.top ?? 20;
  const safeBottom = input.safeArea?.bottom ?? H;
  const homeInset = Math.max(0, H - safeBottom);

  // 顶栏：与胶囊垂直居中对齐，高 44；右侧让出胶囊 + 8px
  const menu = input.menuButton ?? { top: safeTop + 4, left: W - 94, height: 32 };
  const capCenter = menu.top + menu.height / 2;
  const topY = Math.max(safeTop, Math.round(capCenter - 22));
  const topBar: Rect = { x: 0, y: topY, w: Math.max(0, menu.left - 8), h: 44 };

  // 自下而上排：工具栏 → 组词行 → 字槽 → 棋盘吃掉剩余高度
  const bottomPad = homeInset > 0 ? homeInset + 4 : 6;
  const tbH = compact ? 44 : 48;
  const toolbar: Rect = { x: 12, y: H - bottomPad - tbH, w: W - 24, h: tbH };
  const btnW = (toolbar.w - 2 * 8) / 3;
  const toolbarButtons: [Rect, Rect, Rect] = [0, 1, 2].map(i => ({
    x: toolbar.x + i * (btnW + 8), y: toolbar.y, w: btnW, h: tbH,
  })) as [Rect, Rect, Rect];

  const gap = compact ? 6 : 8;
  const cH = compact ? 48 : 52;
  const compose: Rect = { x: 12, y: toolbar.y - gap - cH, w: W - 24, h: cH };

  const cellW = clamp(Math.floor((W - 22 - (SLOT_COUNT - 1) * CELL_GAP) / SLOT_COUNT), 28, 34);
  const cellH = Math.round(cellW * 1.29);              // 34→44, 28→36
  const cellsW = SLOT_COUNT * cellW + (SLOT_COUNT - 1) * CELL_GAP;
  const cellX = Math.round((W - cellsW) / 2);
  const cellY = compose.y - TRAY_PAD - (compact ? 2 : 4) - cellH;
  const slotCells: Rect[] = Array.from({ length: SLOT_COUNT }, (_, i) => ({
    x: cellX + i * (cellW + CELL_GAP), y: cellY, w: cellW, h: cellH,
  }));
  const tray: Rect = { x: cellX - TRAY_PAD, y: cellY - TRAY_PAD, w: cellsW + 2 * TRAY_PAD, h: cellH + 2 * TRAY_PAD };
  const headH = compact ? 16 : 18;
  const slotHeader: Rect = { x: cellX, y: tray.y - headH, w: cellsW, h: headH };

  const bX = compact ? 4 : 8;
  const bY = topBar.y + topBar.h + (compact ? 2 : 4);
  const bBottom = slotHeader.y - (compact ? 2 : 8);
  const board: Rect = { x: bX, y: bY, w: W - 2 * bX, h: Math.max(0, bBottom - bY) };

  return { compact, topBar, board, slotHeader, tray, slotCells, compose, toolbar, toolbarButtons, homeInset };
}

/* ------------------------------------------------------------------ */
/* 棋盘：字牌尺寸与固定棋盘内的显示投影                                     */
/* ------------------------------------------------------------------ */

export interface BoardMetrics {
  tileW: number; tileH: number;
  pitchX: number; pitchY: number;   // 小屏可压缩显示步距，不改变逻辑坐标
  contentW: number; contentH: number;
  inset: number;                    // 视口内留白，保证投影与“完整可见”判定
  panX: boolean; panY: boolean;     // 哪个方向需要平移
}

export const TILE_MIN_W = 44;  // 不得小于 44（可点目标下限）
export const TILE_MAX_W = 48;  // 再大也不放大，保持棋盘“密度感”
const BOARD_INSET = 6;
const SHADOW_ROOM = 8;

/**
 * @param spanX 关卡内容横向跨度，单位“字牌宽”。含半格错层，例如最左 gx=0、最右 gx=6 → spanX = 7
 * @param spanY 关卡内容纵向跨度，单位“字牌高”
 * 关卡坐标约定：字牌位置 (gx, gy) 可为 0.5 的倍数；像素位置 = gx * pitchX, gy * pitchY
 */
export function computeBoardMetrics(board: Rect, spanX: number, spanY: number): BoardMetrics {
  if (board.w < 360) {
    // Keep the 44px tap target, but compress display spacing independently on
    // each axis. The certified tile coordinates and blocking graph stay intact.
    const tileW = TILE_MIN_W, tileH = TILE_MIN_W;
    const inset = 2;
    const pitchX = Math.min(tileW + 2, (board.w - 2 * inset - tileW) / Math.max(1, spanX - 1));
    const pitchY = Math.min(tileH + 2, (board.h - 2 * inset - SHADOW_ROOM - tileH) / Math.max(1, spanY - 1));
    const contentW = (spanX - 1) * pitchX + tileW;
    const contentH = (spanY - 1) * pitchY + tileH + SHADOW_ROOM;
    return { tileW, tileH, pitchX, pitchY, contentW, contentH, inset,
      panX: false, panY: false };
  }
  const fitW = (board.w - 2 * BOARD_INSET - (spanX - 1) * 2) / spanX;
  const fitH = (board.h - 2 * BOARD_INSET - SHADOW_ROOM - (spanY - 1) * 2) / spanY - 6;
  let tileW = Math.floor(Math.min(fitW, fitH, TILE_MAX_W));
  if (tileW < TILE_MIN_W) tileW = TILE_MIN_W;
  const tileH = tileW + 6;
  const pitchX = tileW + 2, pitchY = tileH + 2;
  const contentW = (spanX - 1) * pitchX + tileW;
  const contentH = (spanY - 1) * pitchY + tileH + SHADOW_ROOM;
  return {
    tileW, tileH, pitchX, pitchY, contentW, contentH, inset: BOARD_INSET,
    panX: contentW > board.w - 2 * BOARD_INSET,
    panY: contentH > board.h - 2 * BOARD_INSET,
  };
}

/** Larger tutorial letters fill the fixed board while preserving the Piachan
 * half-grid overlap test: adjacent full cells remain separate, half cells overlap. */
export function computeDenseTutorialMetrics(board: Rect, spanX: number, spanY: number,
  preferredTileW: number): BoardMetrics {
  const inset = 2;
  const heightExtra = board.w < 360 ? 0 : 6;
  const widthFit = (board.w - 2 * inset - (spanX - 1) * 2) / spanX;
  const heightFit = (board.h - 2 * inset - SHADOW_ROOM - (spanY - 1) * 2) / spanY - heightExtra;
  const tileW = Math.max(TILE_MIN_W, Math.floor(Math.min(preferredTileW, widthFit, heightFit)));
  const tileH = tileW + heightExtra;
  const pitchX = Math.min(tileW + 2, (board.w - 2 * inset - tileW) / Math.max(1, spanX - 1));
  const pitchY = Math.min(tileH + 2, (board.h - 2 * inset - SHADOW_ROOM - tileH) / Math.max(1, spanY - 1));
  const contentW = (spanX - 1) * pitchX + tileW;
  const contentH = (spanY - 1) * pitchY + tileH + SHADOW_ROOM;
  return { tileW, tileH, pitchX, pitchY, contentW, contentH, inset, panX: false, panY: false };
}

/** A tight grid-backed page around the tutorial pile, with corners kept
 * inside even the narrowest 320px board viewport. */
export function computeDenseBoardPage(board: Rect, metrics: BoardMetrics): Rect {
  const offsetX = (board.w - metrics.contentW) / 2;
  const offsetY = (board.h - metrics.contentH) / 2;
  const padX = Math.min(12, Math.max(0, offsetX));
  const padY = Math.min(12, Math.max(0, offsetY));
  return { x: board.x + offsetX - padX, y: board.y + offsetY - padY,
    w: metrics.contentW + 2 * padX, h: metrics.contentH + 2 * padY };
}

/** 平移偏移（内容原点相对视口左上角）的合法区间；不需要平移的方向固定居中 */
export function panRange(board: Rect, m: BoardMetrics) {
  const rx = m.panX
    ? { min: board.w - m.inset - m.contentW, max: m.inset }
    : { min: Math.round((board.w - m.contentW) / 2), max: Math.round((board.w - m.contentW) / 2) };
  const ry = m.panY
    ? { min: board.h - m.inset - m.contentH, max: m.inset }
    : { min: Math.round((board.h - m.contentH) / 2), max: Math.round((board.h - m.contentH) / 2) };
  return { x: rx, y: ry };
}

/** 字牌在视口内是否“完整可见”。只有完整可见的露出字才能被取走 */
export function isFullyVisible(tileX: number, tileY: number, m: BoardMetrics, off: { x: number; y: number }, board: Rect): boolean {
  const vx = off.x + tileX, vy = off.y + tileY;
  return vx >= 0 && vy >= 0 && vx + m.tileW <= board.w && vy + m.tileH <= board.h;
}

/** 点到切边的露出字时：算出能让它完整进入视口（含 inset）的最小平移目标 */
export function bringIntoView(tileX: number, tileY: number, m: BoardMetrics, off: { x: number; y: number }, board: Rect) {
  const r = panRange(board, m);
  let x = off.x, y = off.y;
  const vx = off.x + tileX, vy = off.y + tileY;
  if (vx < m.inset) x += m.inset - vx;
  if (vx + m.tileW > board.w - m.inset) x -= vx + m.tileW - (board.w - m.inset);
  if (vy < m.inset) y += m.inset - vy;
  if (vy + m.tileH > board.h - m.inset) y -= vy + m.tileH - (board.h - m.inset);
  return { x: clamp(x, r.x.min, r.x.max), y: clamp(y, r.y.min, r.y.max) };
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && py >= r.y && px <= r.x + r.w && py <= r.y + r.h;
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
