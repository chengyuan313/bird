/**
 * 《字里有鸟》对局主屏 · 设计变量
 * 来源：高保真设计稿「活字木牌 × 野外观察手册」
 * 单位：逻辑像素（CSS px / 微信 windowWidth 坐标系），绘制时统一乘 pixelRatio。
 * 只放视觉数值，不含任何游戏规则。
 */

export const color = {
  // 底色
  paper: '#EFE7D6',        // 页面底（手册纸）
  page: '#F8F2E4',         // 棋盘观察页、浮层底
  card: '#FBF7EC',         // 卡片、次级按钮底
  pageGrid: '#ECE2CE',     // 棋盘方格线
  pageEdge: '#DACDB1',     // 棋盘内描边
  line: '#CDBFA2',         // 卡片描边、工具按钮描边/厚边
  lineSoft: '#BFAF8E',     // 虚线提示框

  // 文字
  ink: '#1E2A26',          // 主文字、字牌字
  ink2: '#3F3A2E',         // 正文
  muted: '#5E5646',        // 说明文字（在 paper 上对比度 ≥ 4.5）
  disabled: '#8A7D63',     // 置灰文字、页面角标

  // 露出字牌（黄杨木）
  woodFaceTop: '#FBF3DF',
  woodFaceBottom: '#F2E2C1',
  woodFace: '#F6E7C8',     // 字槽内木牌、词表已拼出
  woodEdge: '#B5844B',     // 木边厚度（上层）
  woodDark: '#6B4A2B',     // 木边厚度（下层）+ 描边

  // 被压字牌
  coveredL0: '#C4B596',    // 最底层
  coveredL1: '#D0C3A7',    // 第 2 层及以上
  coveredBorder: '#A8997C',
  coveredInkL0: 'rgba(60,48,30,0.30)',
  coveredInkL1: 'rgba(60,48,30,0.34)',

  // 字槽（活字盘）
  tray: '#E2D3B3',
  trayHole: '#D6C5A1',

  // 功能色（每种只做一件事）
  teal: '#23535A',         // 组词主按钮、将被消耗的格子
  tealDark: '#163A40',     // 主按钮厚边
  tealTint: '#DCEAE8',     // 将被消耗格子底、列表选中底
  tealInk: '#12343A',
  ochre: '#B4561A',        // 满槽警示描边
  ochreTint: '#F8E7D8',
  ochreInk: '#6B2C0C',
  seal: '#C0392B',         // 朱砂：只用于“新”印、通关印

  scrim: 'rgba(30,42,38,0.55)',      // 失败时棋盘遮罩
  scrimLight: 'rgba(30,42,38,0.32)', // 多词列表打开时棋盘遮罩
  scrimPause: 'rgba(30,42,38,0.62)', // 词表暂停全屏遮罩
  white: '#FFFFFF',
} as const;

export const font = {
  /** 字牌、鸟名、标题：宋体（建议子集化后用 wx.loadFont 载入，见 spec.md §8） */
  serifFallback: '"Songti SC","STSong","Noto Serif SC","Source Han Serif SC",serif',
  /** 界面文字：系统黑体 */
  sans: '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif',
  tile390: 26, tile320: 22, tileWeight: 900,
  slot390: 20, slot320: 17,
  birdName: 22, birdNameLarge: 28,
  title: 16, caption: 11, body: 14, button: 14, buttonLarge: 16,
} as const;

export const radius = {
  tile: 8, slotCell: 6, tray: 10, board: 16, button: 12, card: 14, sheet: 18, pill: 999,
} as const;

/** 露出字牌的“木活字”分层（自上而下绘制顺序见 draw-recipes.ts） */
export const tileDepth = {
  edgeWood: 3,        // 木边 1：face 下方露出 3px
  edgeDark: 4,        // 木边 2：face 下方露出 4px
  dropShadow: { color: 'rgba(70,45,15,0.28)', blur: 12, offsetY: 8 },
  pressedSink: 3,     // 按下时整体下移 3px，厚边收起到 1/2px
  gap: 2,             // 同层相邻字牌间距
} as const;

export const motion = {
  pickFly: 180,           // 取字飞入字槽，ease-out，低弧线
  revealLift: 120,        // 被压字露出后“抬起”
  composeGlow: 100,       // 将被消耗的格子亮一下
  composeMerge: 240,      // 上浮合成鸟名签
  slotCompact: 160,       // 剩余字左移补齐
  foundIn: 200,           // 观察卡滑入
  sealStamp: 160,         // 朱砂印盖下（轻回弹）
  foundHold: 900,         // 停留
  foundOut: 200,          // 淡出
  knownToast: 600,        // 已发现过的鸟：轻提示总时长
  optionSwitch: 120,      // ‹ › 切换鸟名横滑
  failShake: 240,         // 字槽左右轻抖 2 次
  listOpen: 160,          // 多词列表弹出
  rubberBand: 24,         // 平移越界最大回弹距离（px）
} as const;

export const gesture = {
  tapSlop: 8,             // 位移 ≥ 8px 视为拖动，整段手势不再取字
  tapMaxDuration: 600,    // 按住超过 600ms 抬起不取字（防长按误触）
  minHit: 44,             // 所有可点目标最小 44×44
} as const;
