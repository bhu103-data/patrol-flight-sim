# PATROL 项目对话同步记录

更新时间：2026-11-25

本文件只记录与 PATROL 飞行模拟器直接相关的 Codex / ChatGPT 项目产物；不上传无关对话、凭证或个人内容。

## 已合并到 `main`

- 地图选择器：纽约、拉斯维加斯保留可选并标记 `DEMO`；其余地图为不可选演示项。
- 重庆：照片风格夜景预览资源与菜单入口。
- 飞行器：选择器仅保留 Viper Jet、Cessna 185；移除 UFO 选择项及对应运行时代码。
- 共享城市资产：Kenney City Kit Roads（CC0）交通信号灯候选、导出结果、来源记录和 WebGL 对比页。
- Pages 工作流：`.github/workflows/deploy-pages.yml`。

## 对话/分支来源

以下内容已在 GitHub 上保留为可追溯分支或提交：

- Chongqing：`feat/chongqing-hongyadong-street-prototype`、`feat/chongqing-free-assets-catalog`
- NYC / PATROL 集成：`codex/patrol-integration-20261121`
- 共享城市资产：`codex/shared-city-assets`
- 本地交接与 QA：`codex/patrol-local-handoff-20261122`

旧分支没有直接整体合并：其中包含相对当前 `main` 的历史回滚或删除，整体合并会覆盖已有修复；可按具体功能单独 cherry-pick。

## 验证

- `node --test tests/launcher-options.test.mjs`
- `node --test tests/shared-city-asset.test.mjs tests/scenario-glb.test.mjs`
- 相关分支历史中已记录 Chongqing 107/107 和共享资产 5/5 的验证结果；本次不把历史结果冒充为本轮重新执行结果。

