# 微信小游戏 Canvas 技术切片

这是一份独立于 Vite 网页的微信小游戏技术切片，不是已发布的完整微信游戏。它复用四川 V7 正式题库与纯游戏引擎，不改网页入口、正式题库、历史 puzzle ID 或网页版进度。当前用户可从固定 HUD 的关卡入口选择四川 D1–D5 共 25 局，经触摸取字、组词、撤销、重试、下一局继续游玩。100 鸟图鉴、来源入口、真人难度校准及真机适配仍未完成。

## 构建与导入

无需 AppID 的浏览器界面预览：启动 Vite 后打开 `/bird/?preview=wechat`（本机默认 `http://localhost:5173/bird/?preview=wechat`）。这个入口直接挂载同一个 `WechatBirdStage` Canvas 舞台，可切换 320×568 / 390×844，模拟安全区、鼠标与触屏操作；它不使用网页版的长页面对局 UI。浏览器预览仅用于快速评审布局和操作，不能替代微信运行时或真机验收。

在仓库根目录使用现有依赖运行 `node tools/buildWechat.mjs`（或 `pnpm run build:wechat`）。产物是忽略版本控制的 `dist-wechat/game.js` 与 `dist-wechat/game.json`；没有 WXML、DOM、AppID、远程资源、源凭据。构建走 Vite 的内联 `configFile: false`，避免 Windows sandbox 的 Vite 配置打包权限问题；没有新增全局包。将 `dist-wechat` 作为“小程序/小游戏”项目目录导入微信开发者工具，并由仓库所有者在开发者工具中提供自己的小游戏 AppID。**不能以网页 URL 或本地 VM 烟测代替微信开发者工具/真机验收。**

入口 `src/wechat/game.ts` 只依赖 `wx.createCanvas`、触摸事件、安全区窗口信息与 `wx` 本地存储。舞台 `src/wechat/stage.ts` 接收 Canvas2D、视口、安全区与存储接口，因此可在浏览器 Canvas 测试壳中复用。存储键 `bird.wechat.v1` 独立于网页存档，记录完成 puzzle ID 与发现物种；胜利结算一次，胜利后不能撤销，失败后可连续撤销。若本地存储不可用，本局仍能游玩，但跨启动进度无法保证。

## 当前固定屏交互

- 320×568 / 390×844 按运行时 safeArea 分配 HUD、局部棋盘、十槽、组词和固定按钮；若有效安全高度小于 344px 则显式拒绝，以免棋盘与控件重叠。整个舞台不使用网页滚动。
- 棋盘字块为 48px；局部拖动只改变棋盘 pan，结束时不取字。仅显示完整有效露出至少 44×44 的可取字 hitbox；重叠露出字点按进入 44px 候选层，候选可双向分页。被阻挡字不进入候选层。
- 同时多个可拼词有“全部可拼 n”入口；组词列表按弹层真实高度分页，双向切换且每行间隔 48px。词表也按高度分页。
- 结算层可下一局或返回当前极简关卡层；最小安全高度下关卡层分页。固定 HUD 的关卡入口可浏览并选择全部 25 局。

## 自动验证与尚缺验收

`tests/wechat-stage.test.ts` 覆盖两种视口、D5 四角平移与拖动不取字、露出字及真实重叠点击、3/6/7 个可拼词的逐项点击、候选 >6 双向分页、最小安全区无控件重叠、连续撤销、全部 25 局导航、D1 与 D5 证书经 Canvas 控件回放、胜利持久化及下一局身份。`tools/smokeWechatBundle.mjs` 在无 DOM 的 VM 中启动构建产物，检查 Canvas、2× 像素与触摸回调。模拟点击不能证明真实设备上的 44px 命中率、长词文字可读性、切后台恢复或微信本地存储兼容；需要按 `docs/wechat-minigame-product.md` 在开发者工具及两台真实触屏设备上验收。

参考微信官方小游戏样例的 `game.js` / `game.json` 工程结构：[wechat-miniprogram/minigame-demo](https://github.com/wechat-miniprogram/minigame-demo)。
