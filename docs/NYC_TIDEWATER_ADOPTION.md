# Tidewater → PATROL 海洋画质移植和许可证记录

## 上游核实（2026-11-21）
- 源码 https://github.com/zzzhengqi/tidewater
- 演示 https://zzzhengqi.github.io/tidewater/
- 源码许可证：MIT，Copyright (c) 2026 DRG Software Solutions LLC。参考上游 `LICENSE`、`CREDITS.md`。
- 上游 README 描述的是**四级联 FFT**、Three.js/WebGPU/TSL，而用户收集的提示词中“三级联”只是早期需求。
- 核对过 `src/ocean/SeaDetail.js`（风斑、油膜、风排线）、`src/ocean/SurfFoam.js`、`src/ocean/ShoreSim.js`（泡沫、湿沙状态）、`src/ocean/Caustics.js`（分层折射焦散）、`src/materials/LODFade.js`（拜耳屏幕门式 LOD）、`src/ocean/WaterQuery.js`（GPU 海面查询）。
- 此 PR 是**参照公开原理、重新编写的 PATROL 原生 GLSL**，没有复制 Tidewater 源码、纹理、音频、模型、字体、场景或船只。将来如复制 MIT 源码须附随上游许可声明；原素材仍须分别核查 CC0 等许可。

## 当前落实的改动
- 在前置依赖 PR #105 的确定性 18 波谱、水面光学和 C185 浮力上，增设仅纽约水面生效的 `NYC_TIDEWATER_DETAIL` 编译期可回滚开关。
- 1 次额外值噪声采样，在世界空间生成随风缓慢移动的非重复粗糙/暗斑；用 `pixel` 范围 4–14 自适应淡出，避免远方闪烁。粗糙度最多增加 20%，反光色降低不超过 5.8%，不改变物理波高。
- 使用已经计算的 `breakup`/ `foamCells` 使浪峰泡沫破碎，并以 `pixel` 范围 0.42–2.0 混合成稳定平均值；不启用额外持久泡沫帧缓冲。
- 纽约水下焦散的亚像素细节加距离衰减，不改变其他地图的光学采样。
- 复用 `nyc-water-crest-compare.mjs` 同机位、同 shader 时间的 A/B 测试，加入 `PATROL_COMPARE_MODE=sea-detail`，分别生成 PNG + JSON + 16 个 RAF 间隔；非硬件 GPU 耗时。
- 本 PR 只改原生 WebGL2 水面片元着色和 QA/文档，不改渡轮船体/航线、水上飞机碰撞/浮力、其他地图、几何或输入绑定。

## 用户提供功能清单与采用策略

| 相关 Tidewater 功能 | PATROL 状态 | 当前 PR | 安全后续边界 |
|---|---|---|---|
| 无缝多尺度海浪 / 三级联或四级联 FFT | 已有原生确定性 18 模式、级联采样 | 不替换物理 | FFT WebGPU/TSL 架构不可直接拼到 WebGL2；先独立评估 WebGL2 MRT 和算力 |
| 浮筒随浪运动 | 前置 PR #105 已共享波高 | 保持 | 继续保护同步时钟、原始海底采样 |
| 世界空间风斑、油膜、近/远距粗糙度 | 只有旧 gust 噪声 | **实现风斑/暗斑** | 不把低频变化误认高质量海图 |
| 白浪、破碎泡沫与距离过滤 | 已有 4 次历史海浪压缩采样 | **实现近景碎片化与距离过滤** | 真正“持久累积”需海岸纹理和严格的 GPU 内存预算 |
| 焦散稳定度 | 已有解析焦散 | **实现纽约亚像素抑制** | 多焦平面渲染目标需另开分支验证成本 |
| Beer 定律、Fresnel、GGX、折射、日光闪烁 | 已有 | 保持 | 留意黄昏/湿路光照和色域 |
| 海岸浪卷、湿沙、退潮残留、喷溅粒子 | 多数为港口护岸、桥墩和码头 | 不套热带沙滩代码 | 需要真实纽约地形、干湿边界和局部水深 |
| 船头尾流与驾驶舱 | 另有渡轮 PR #104 | 不碰 | 留给渡轮专项，不合并两个 PR 的船体逻辑 |
| 水线分屏、潜水、游泳、镜头水滴 | 飞行模拟器没有游泳主角模式 | 不修改玩法 | 必须另做水下裁剪/深度测试和控制过渡设计 |
| 鲸鱼、珊瑚、鱼、鸟、沙滩蟹、海村 | 纽约写实位置不适合热带岛或巨鲸群 | 不加入虚构地点 | 适合独立热带地图，逐模型授权和精度核查 |
| 体积云、卷云、天空、雾霾、体积光 | 已有天空和雾 | 不改 | 独立天空/性能专项 |
| GTAO、级联阴影、运动模糊、镜头光晕、AO 修复 | 现有原生渲染链 | 不直接引入 Three.js 多通道 | 逐项预算 framebuffer、GPU 消耗和低画质回退 |
| Bayer 4×4 LOD 淡入 | PATROL NYC 目前是静态分区和合批建筑 | 不做无意义的片元丢弃 | 需要双 LOD 重叠、深度与遮挡一致性，单独 QA |
| FPS、太阳方位、风力、波幅、昼夜/水下 UI | 部分已有天气/时间控件 | 保留 | 要把参数和物理联动，避免仅视觉参数 |
| 鸟鸣、潮声、入水、鲸叫、走路环境音 | 不导入示例音效 | 保留 | 单独确认 CC0 来源、网络/播放限制、地图语义 |
| 手电筒、自由移动、游泳过渡、第一人称/第三人称 | 现有飞控 | 保持 | 要避免改飞行键位，非本水面渲染分支 |

## 回滚、测试与性能
- 新功能默认启用仅在纽约，测试可把 shader 中 `const bool NYC_TIDEWATER_DETAIL = true;` 仅在临时响应改为 false 做 A/B；恢复为 false 可完全关闭新效果。
- 原生 shader 不增加 RenderTarget、纹理、draw call、顶点、模型和网络请求；`pixel>=14` 时跳过附加噪声查找。近景只加一处值噪声，泡沫沿用既有两处。
- 执行 `node --test tests/nyc-tidewater-water-detail.test.mjs` 和现有 C185/全图回归；Actions 产出游戏内相同机位 `nyc-water-sea-detail-before/after.png` 与可检查的 JSON。
- 低帧率软件 SwiftShader 结果不得冒充硬件 FPS；60fps 和高档 WebGPU 不是当前补丁的验收结论。
- 该分支从 PR #105 的 HEAD 创建，建议草稿 PR 的 base 指向 `codex/nyc-c185-wave-buoyancy-20261121`；避免改动共享整合分支和 `main`。

## 第二轮兼容模式与 A/B 固定条件
- `uNYCSeaDetail` 是原生 WebGL2 uniform；当 `?graphics=compat` 或 `NYC Street FX=Basic (1)` 时自动关闭新色彩、泡沫、焦散调节。不影响其他地图、海浪波高、C185 浮力或低画质水面原有着色。
- A/B 临时页面将天空设为 12:00、季节 1、天气 Clear、街道质量 2，锁定相同机位以及渲染海浪时间 20 秒，减少独立场景加载和自动天气对结果的混淆。
- 现有 A/B 浏览器脚本可通过 `PATROL_BROWSER_CHANNEL=chrome` 使用 Windows 已安装 Chrome 的本地浏览器；显示 16 次 RAF 样本，但不声称是 GPU 帧耗。

## 长波同源相位弯曲（本轮）
- 旧版 18 个波谱模式中的第 0–5 个长波相位呈现过于规则的平行波峰，尤其在自由女神像邻近港口低空视角。
- 只对纽约长波使用两个缓慢变化的世界空间正弦相位场：`bend=0.70*sin(.027*x+.018*z+.035*t)*sin(.009*x-.013*z-.020*t)`。
- 由单一 JS `NYC_CREST_BEND` 常量导出 WebGL2 GLSL 相同的波相系数。GLSL 法线使用严格解析相位梯度，C185 使用同一浮筒 `floatOceanHeight`；非纽约地图相位严格不变。
- 这不是基于真实海况的测量数据，也不是 FFT 海浪，它是最低成本的规则波峰去机械化处理。真实海浪激励仍来自现有频谱；没有新增纹理、几何或 GPU Pass。
- A/B 使用 `PATROL_COMPARE_MODE=crest-warp`，仅在测试 HTML 响应把共同系数改为 0，同时关闭物理和画面的波峰弯曲；不修改 Git 仓库本身。三种 A/B（颜色、海面细节、波峰弯曲）均可独立复查。
- 检查新相位的低空视觉效果、漂浮机体高度和强浪谷是否继续通过。不得仅凭静态正则判定“无拼接/AAA/60 FPS”。
