/**
 * 《字里有鸟》· Canvas 2D 绘制配方 + 棋盘手势判定（参考实现）
 *
 * 这些函数只负责“画成设计稿的样子”和“判断这一下是点还是拖”，
 * 不涉及取字/组词/胜负规则——规则仍由现有游戏逻辑决定。
 * 所有坐标均为逻辑像素；初始化时请先 ctx.scale(pixelRatio, pixelRatio)。
 */
import { color, radius, tileDepth, gesture } from './ui-tokens';

type Ctx = CanvasRenderingContext2D;

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  // 不依赖 ctx.roundRect（部分基础库/机型不支持）
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ---------------- 棋盘观察页 ---------------- */

export function drawBoardPage(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius.board);
  ctx.fillStyle = color.page;
  ctx.fill();
  ctx.clip();
  // 18px 方格
  ctx.strokeStyle = color.pageGrid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = x + 18; gx < x + w; gx += 18) { ctx.moveTo(gx + 0.5, y); ctx.lineTo(gx + 0.5, y + h); }
  for (let gy = y + 18; gy < y + h; gy += 18) { ctx.moveTo(x, gy + 0.5); ctx.lineTo(x + w, gy + 0.5); }
  ctx.stroke();
  ctx.restore();
  // 内描边
  ctx.save();
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius.board);
  ctx.strokeStyle = color.pageEdge;
  ctx.stroke();
  ctx.restore();
}

/* ---------------- 字牌 ---------------- */

export interface TileStyleOpts { serifFamily: string; fontSize: number; }

/** 露出、可点：黄杨木面 + 两层木边厚度 + 投影。pressed=true 时下沉 3px、厚边收起 */
export function drawExposedTile(ctx: Ctx, x: number, y: number, w: number, h: number, ch: string, o: TileStyleOpts, pressed = false) {
  const sink = pressed ? tileDepth.pressedSink : 0;
  const fy = y + sink;
  const dark = pressed ? 2 : tileDepth.edgeDark;
  const wood = pressed ? 1 : tileDepth.edgeWood;

  ctx.save();
  // 1) 投影 + 深色木边（最底）
  if (!pressed) {
    ctx.shadowColor = tileDepth.dropShadow.color;
    ctx.shadowBlur = tileDepth.dropShadow.blur;
    ctx.shadowOffsetY = tileDepth.dropShadow.offsetY - dark;
  }
  roundRectPath(ctx, x, fy + dark, w, h, radius.tile);
  ctx.fillStyle = color.woodDark;
  ctx.fill();
  ctx.restore();

  ctx.save();
  // 2) 浅色木边
  roundRectPath(ctx, x, fy + wood, w, h, radius.tile);
  ctx.fillStyle = color.woodEdge;
  ctx.fill();
  // 3) 木面渐变
  const g = ctx.createLinearGradient(0, fy, 0, fy + h);
  g.addColorStop(0, pressed ? color.woodFaceBottom : color.woodFaceTop);
  g.addColorStop(1, pressed ? '#EAD6AF' : color.woodFaceBottom);
  roundRectPath(ctx, x, fy, w, h, radius.tile);
  ctx.fillStyle = g;
  ctx.fill();
  // 4) 描边
  roundRectPath(ctx, x + 0.5, fy + 0.5, w - 1, h - 1, radius.tile - 0.5);
  ctx.strokeStyle = color.woodDark;
  ctx.lineWidth = 1;
  ctx.stroke();
  // 5) 顶部高光
  if (!pressed) {
    ctx.beginPath();
    ctx.moveTo(x + radius.tile, fy + 1.5);
    ctx.lineTo(x + w - radius.tile, fy + 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();
  }
  // 6) 字
  drawGlyph(ctx, ch, x + w / 2, fy + h / 2, o, color.ink, 900);
  ctx.restore();
}

/** 被压、不可点：沉入纸面。layer=0 为最底层（更深） */
export function drawCoveredTile(ctx: Ctx, x: number, y: number, w: number, h: number, ch: string, o: TileStyleOpts, layer: number) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius.tile);
  ctx.fillStyle = layer === 0 ? color.coveredL0 : color.coveredL1;
  ctx.fill();
  ctx.clip();
  // 内阴影（用顶部渐变近似 inset shadow）
  const g = ctx.createLinearGradient(0, y, 0, y + 6);
  g.addColorStop(0, 'rgba(60,40,15,0.20)');
  g.addColorStop(1, 'rgba(60,40,15,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 6);
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius.tile - 0.5);
  ctx.strokeStyle = color.coveredBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  drawGlyph(ctx, ch, x + w / 2, y + h / 2, o, layer === 0 ? color.coveredInkL0 : color.coveredInkL1, 700);
  ctx.restore();
}

/** 仅小屏平移时出现：露出但被视口切边。虚线 + 半透明，点按先滚入、不取字 */
export function drawCutTile(ctx: Ctx, x: number, y: number, w: number, h: number, ch: string, o: TileStyleOpts) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  roundRectPath(ctx, x, y, w, h, radius.tile);
  ctx.fillStyle = color.woodFace;
  ctx.fill();
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, radius.tile);
  ctx.strokeStyle = color.woodDark;
  ctx.stroke();
  ctx.setLineDash([]);
  drawGlyph(ctx, ch, x + w / 2, y + h / 2, o, color.ink, 900);
  ctx.restore();
}

function drawGlyph(ctx: Ctx, ch: string, cx: number, cy: number, o: TileStyleOpts, fill: string, weight: number) {
  ctx.font = `${weight} ${o.fontSize}px ${o.serifFamily}`;
  ctx.fillStyle = fill;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 中文宋体在 middle 基线下视觉略偏上，下移约 4% 字号
  ctx.fillText(ch, cx, cy + o.fontSize * 0.04);
}

/* ---------------- 字槽（活字盘） ---------------- */

export type SlotCellState = 'empty' | 'filled' | 'willConsume' | 'alert';

export function drawTray(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius.tray);
  ctx.fillStyle = color.tray;
  ctx.fill();
  ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + 5);
  g.addColorStop(0, 'rgba(70,45,15,0.25)');
  g.addColorStop(1, 'rgba(70,45,15,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 5);
  ctx.restore();
}

export function drawSlotCell(ctx: Ctx, x: number, y: number, w: number, h: number, state: SlotCellState, ch: string, o: TileStyleOpts) {
  ctx.save();
  if (state === 'empty') {
    roundRectPath(ctx, x, y, w, h, radius.slotCell);
    ctx.fillStyle = color.trayHole;
    ctx.fill();
    ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + 4);
    g.addColorStop(0, 'rgba(70,45,15,0.30)');
    g.addColorStop(1, 'rgba(70,45,15,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, 4);
    ctx.restore();
    return;
  }
  const spec = {
    filled:      { face: color.woodFace,  border: color.woodDark, bw: 1, edge: color.woodEdge, ink: color.ink },
    willConsume: { face: color.tealTint,  border: color.teal,     bw: 2, edge: color.teal,     ink: color.tealInk },
    alert:       { face: color.ochreTint, border: color.ochre,    bw: 2, edge: null,           ink: color.ochreInk },
  }[state];
  if (spec.edge) { roundRectPath(ctx, x, y + 2, w, h, radius.slotCell); ctx.fillStyle = spec.edge; ctx.fill(); }
  roundRectPath(ctx, x, y, w, h, radius.slotCell);
  ctx.fillStyle = spec.face;
  ctx.fill();
  roundRectPath(ctx, x + spec.bw / 2, y + spec.bw / 2, w - spec.bw, h - spec.bw, radius.slotCell);
  ctx.strokeStyle = spec.border;
  ctx.lineWidth = spec.bw;
  ctx.stroke();
  drawGlyph(ctx, ch, x + w / 2, y + h / 2, o, spec.ink, 900);
  ctx.restore();
}

/* ---------------- 按钮 ---------------- */

/** 黛青主按钮（全屏同一时间最多一个）。pressed 时下沉 3px、厚边消失 */
export function drawPrimaryButton(ctx: Ctx, x: number, y: number, w: number, h: number, pressed = false) {
  ctx.save();
  if (!pressed) {
    ctx.shadowColor = 'rgba(22,58,64,0.25)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
    roundRectPath(ctx, x, y + 3, w, h, radius.button);
    ctx.fillStyle = color.tealDark; ctx.fill();
  }
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, x, y + (pressed ? 3 : 0), w, h, radius.button);
  ctx.fillStyle = color.teal; ctx.fill();
  ctx.restore();
}

/** 工具栏按钮（描边纸面）。variant: normal | disabled | emphasis(满槽时撤销/重试) */
export function drawToolButton(ctx: Ctx, x: number, y: number, w: number, h: number, variant: 'normal' | 'disabled' | 'emphasis') {
  ctx.save();
  if (variant === 'normal') {
    roundRectPath(ctx, x, y + 2, w, h, radius.button); ctx.fillStyle = color.line; ctx.fill();
    roundRectPath(ctx, x, y, w, h, radius.button); ctx.fillStyle = color.card; ctx.fill();
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius.button); ctx.strokeStyle = color.line; ctx.lineWidth = 1; ctx.stroke();
  } else if (variant === 'disabled') {
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius.button); ctx.strokeStyle = color.pageEdge; ctx.lineWidth = 1; ctx.stroke();
  } else {
    roundRectPath(ctx, x, y, w, h, radius.button); ctx.fillStyle = color.ochreTint; ctx.fill();
    roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, radius.button); ctx.strokeStyle = color.ochre; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

/** 撤销次数角标（18px 圆）。剩余 3 次规则由游戏逻辑提供，这里只画 */
export function drawCountBadge(ctx: Ctx, cx: number, cy: number, n: number, variant: 'normal' | 'disabled' | 'emphasis', sans: string) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  if (variant === 'disabled') { ctx.strokeStyle = color.line; ctx.lineWidth = 1; ctx.stroke(); }
  else { ctx.fillStyle = variant === 'emphasis' ? color.ochre : color.ink; ctx.fill(); }
  ctx.font = `700 11px ${sans}`;
  ctx.fillStyle = variant === 'disabled' ? color.disabled : (variant === 'emphasis' ? color.white : color.card);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n), cx, cy + 0.5);
  ctx.restore();
}

/* ---------------- 图标着色 ---------------- */

/**
 * 素材里的图标 PNG 都是松烟墨色。需要其他颜色（置灰/赭石/黛青）时用离屏画布着色一次并缓存：
 *   const tinted = tintIcon(img, '#8A7D63', 24 * dpr);
 */
export function tintIcon(img: CanvasImageSource, fill: string, sizePx: number,
  createCanvas: () => HTMLCanvasElement): HTMLCanvasElement {
  const c = createCanvas();
  c.width = sizePx; c.height = sizePx;
  const x = c.getContext('2d') as Ctx;
  x.drawImage(img, 0, 0, sizePx, sizePx);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = fill;
  x.fillRect(0, 0, sizePx, sizePx);
  return c;
}

/* ---------------- 棋盘手势：点 or 拖 ---------------- */

export type BoardGestureResult =
  | { kind: 'none' }
  | { kind: 'tap'; x: number; y: number }   // 交给命中测试：完整可见的露出字 → 取字；切边字 → bringIntoView
  | { kind: 'panEnd'; vx: number; vy: number };  // 松手速度（px/ms），用于惯性

/**
 * 规则：
 *  - 只有一根手指；第二根手指按下立即取消本次手势。
 *  - 位移 < 8px 且按住 < 600ms 抬起 → tap。
 *  - 位移一旦 ≥ 8px：若棋盘可平移 → 进入平移，本次手势永不取字；不可平移 → 直接作废。
 *  - 按下时可让被按字牌显示 pressed 态；进入平移或作废时立即还原。
 */
export class BoardGesture {
  private startX = 0; private startY = 0; private startT = 0;
  private lastX = 0; private lastY = 0; private lastT = 0;
  private vx = 0; private vy = 0;
  private mode: 'idle' | 'pending' | 'pan' | 'cancelled' = 'idle';

  constructor(private canPan: () => boolean, private onPan: (dx: number, dy: number) => void) {}

  get isPanning() { return this.mode === 'pan'; }
  get isPending() { return this.mode === 'pending'; }

  start(x: number, y: number, t: number, touchCount: number) {
    if (touchCount > 1) { this.mode = 'cancelled'; return; }
    this.mode = 'pending';
    this.startX = this.lastX = x; this.startY = this.lastY = y; this.startT = this.lastT = t;
    this.vx = this.vy = 0;
  }

  move(x: number, y: number, t: number, touchCount: number) {
    if (touchCount > 1) { this.mode = 'cancelled'; return; }
    if (this.mode === 'pending') {
      const d = Math.hypot(x - this.startX, y - this.startY);
      if (d >= gesture.tapSlop) this.mode = this.canPan() ? 'pan' : 'cancelled';
    }
    if (this.mode === 'pan') {
      const dt = Math.max(1, t - this.lastT);
      this.vx = (x - this.lastX) / dt; this.vy = (y - this.lastY) / dt;
      this.onPan(x - this.lastX, y - this.lastY);
    }
    this.lastX = x; this.lastY = y; this.lastT = t;
  }

  end(x: number, y: number, t: number): BoardGestureResult {
    const m = this.mode; this.mode = 'idle';
    if (m === 'pending' && t - this.startT <= gesture.tapMaxDuration) return { kind: 'tap', x, y };
    if (m === 'pan') return { kind: 'panEnd', vx: this.vx, vy: this.vy };
    return { kind: 'none' };
  }

  cancel() { this.mode = 'idle'; }
}
