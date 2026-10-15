# 微信小游戏对局 UI 接入说明

本目录的 `ui-tokens.ts`、`ui-layout.ts` 和 `ui-draw-recipes.ts` 来自用户提供的设计交付包。`stage.ts` 在 Canvas 2D 上复用这些颜色、尺寸和绘制配方；浏览器 `?preview=wechat` 仅用于视觉和指针输入预览，不能替代微信开发者工具及真机验收。

## 数据接入（对应交付规格 §10）

| 界面数据 | 现有来源 |
| --- | --- |
| 省份、难度、局数 | `WechatBirdStage.tier/stageIndex` 与 `getRegionalV7Puzzle` |
| 字牌、层、遮挡和露出 | `GameState.boardTiles`、`getExposedBoardTiles`；`boardDisplay` 只投影显示坐标，不改题库几何 |
| 有序字槽 | `GameState.tray` |
| 可拼词及需高亮的格子 | `findPlayableBirds`；按 `composeBird` 的“每字取首个未使用格”规则求槽下标 |
| 首次发现及累计物种数 | 本局 `discoveredBirdIds` 与本地 `bird.wechat.v1` 进度；撤销后以当前状态重新计算 |
| 撤销角标 | 每局 3 次的 `undoRemaining`；只在成功撤销时扣减，换局/重试重置；未接入广告 |
| 失败、通关、词表 | `GameState.phase`、`activeCompositions`、配额与本局完成次数 |

## 边界和待验

- 原始字牌 ID、字符分配、层级、`blockedBy`、认证解、计分和组词引擎均未改动。D5 的 90 字 Piachan 逻辑几何保持原样。
- 布局按 320×568、390×844 设计数值计算；320 D5 只在棋盘视口内平移，切边露出字先滚入再取字。浏览器预览已作视觉核对，仍需微信真机检查安全区、性能与振动。
- PNG 来自用户交付包；其对外商业发布权需要由素材提供方确认。未打包宋体字库，当前使用系统字体回退；微信安卓机的字形需真机检查。
- 目前实现按下木牌、180ms 取字飞入、发现提示以及短振动。揭牌过渡、组词合并/槽位补齐、多词列表展开、失败抖动和惯性平移尚未按设计稿完成，不能将本版本视为完整视觉验收。
