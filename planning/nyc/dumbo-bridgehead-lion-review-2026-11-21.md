# Brooklyn Bridge → DUMBO 接驳：LION / CSCL 证据和首个路口规划

**一次性只读规划 · 2026-11-21 · 不可当作游戏 GIS 坐标或路面改动指令**

- **视觉基线**：`codex/nyc-road-realism`（已存在的独立分支；本规划分支从其创建）。
- **本分支**：`codex/dumbo-lion-interchange-plan`。只新建规划／证据文件；不更改 `index.html`、桥面、飞行物理、`main` 或基线分支。
- **证据分级**：`verified-code` = 直接从基线源文件读出；`official-design` = 纽约市 DOT 已发布的图纸及文字；`official-schema` = 官方 GIS 字段定义；`unverified-now` = 尚未获得当前路段数据／现状施工核验。
- **关键限制**：截至本次调查，能确认 NYC LION / CSCL 官方数据来源、字段语义及 NYC DOT 设计图，但公共数据网站的逐路段 API 在本会话无法读取。**因此以下没有任何虚构的 LION SegmentID、NodeID、实际经纬度、实际车道数或 GIS→游戏坐标变换**。实际车道方向必须由所取的路段 `TrafDir` 与起止 Node 判定，不能把图上北向或折线点顺序直接视作车流方向。

## 1. 最严重的断路：游戏的桥头“画出来接通”，车辆拓扑实际断开（P0）

在 `codex/nyc-road-realism:index.html` 直接读取的**仅游戏空间**节点（不是地图投影坐标）：

| 部位 | 游戏空间 (x,z) | 来自源码 | 证据 |
| --- | --- | --- | --- |
| 桥体东侧／Brooklyn 接驳末端 | `(253,-342)` | `EAST_RIVER_BRIDGE = {x:82,halfLength:109,ramp:62,z:-342}`，末端 = 82+109+62 | verified-code |
| 桥上车辆路径 `CITY_STREETS[0]` 终点 | `(253,-342)` | `[[-89,-342],[253,-342]]` | verified-code |
| DUMBO 东向支路 `CITY_STREETS[2]` 起点 | `(253,-342)` | 接续 `(273,-333)`，`(314,-333)` 等 | verified-code |
| DUMBO 北向支路 `CITY_STREETS[6]` 起点 | `(253,-342)` | 接续 `(245,-319)`，`(232,-300)` 等 | verified-code |

**为什么这是 P0：** `prepareCityTraffic()` 把桥上车辆单独绑定 `CITY_STREETS[0]`，把部分城区车辆单独绑定 `CITY_STREETS[2]`；`trafficPose()` 对各自路线进行往返运行。虽然绘图折线端点相同，**没有把桥上行车路径以合法转向边连接到 DUMBO 路网，车辆不会穿过此处的路由节点**；`CITY_STREETS[6]` 甚至不在常规 `slice(0,3)` 车辆线路分配中。它不是一个已经验证过的真实路口。

第二层断路风险：`buildStreetScene()` 对 `CITY_STREETS.slice(1)` 的各段使用 `clipAuthoredNycStreet` 按水面／建筑碰撞裁剪，不能保证两条支路最终还到达 `(253,-342)`。而脚本独立在 `x=end-side*2.2` 处绘制桥头 9 道横纹以及固定信号灯，**不以裁剪后支路的实际终点和拓扑为开关**。因此固定斑马线不能当作 DUMBO 路口已接通的证明。

**修正方向（规划，不执行代码）：** 保持既有桥面、坡度和碰撞不变；先建立明确的分层 `bridge approach → Adams/Tillary vehicle roadbed` 接驳节点。驾驶方向连接必须是 `LION SegmentTyp E/R/C` 和 `TrafDir` 审核过的**有向边**。只有支路真正抵达对应节点且允许通行，才能为其规划停止线、转向箭头和跨路口路面；不可把游戏两条辐射线直接命名为纽约实路。

## 2. 现实道路与“首个路口”：优先审查 Adams St × Tillary St

这是**桥头 Adams/Tillary 主接驳走廊的第一优先受控路口**，不是说所有 Brooklyn Bridge 出口都会首先经过这个路口。纽约市 DOT 的 Tillary–Adams 重建项目（2014 开工、其后完成不同阶段）明确包含重新布置中央隔离带、慢行道和路口安全设施；原图纸具有实路背景，但不能把当时绘制的车道数量无条件当作 2026 现场现状。

| 待规划元素 | 方向／连接（来源与确定性） | 位置处理 |
| --- | --- | --- |
| Adams St 机动车 | 纵向**北向靠近 Brooklyn Bridge 入口、南向离开桥区**的不同路床／方向应分别处理；NYC DOT 历史改造图展示了中心岛两侧不同的汽车行驶方向。**各车道精确数量、各段 `TrafDir` 仍待逐段核实。** | 拟建双向、有中央岛的 roadbed 模型；不要把两向车流混成单一交叉道路 |
| Tillary St 机动车 | 横向 eastbound / westbound 的分隔道路；设计图显示中间种植带及多条车道，不能自动套用基线网格里的 `2+1`／奇偶街 `j%2` 一行逻辑。 | LION 道路两侧 `R`（roadbed）与 `E/C` 连接段逐一匹配 |
| 首路口连接 | Tillary ↔ Adams 有特定转向限制。NYC DOT 2008 项目记录禁止 **Adams 北行→Tillary 西行**和 **Tillary 东行→Adams 北行（去桥）**的左转；这是历史官方证据，不保证 2026 未变。 | `turn_restrictions` 先置为 `historically documented / needs current check`，不要把全部左转开放 |
| 第一个完整人行横道 | 在**Adams × Tillary 街口各自实际机动车道出口／入口**跨越，允许通过中央隔离岛分段穿行。市 DOT 图纸标示斑马线和中央待行区域。 | 不把桥头游戏坐标 `(253,-342)` 的 9 道纹线直接误当此路口；真实 crossing geometry 须由 DOT 路口图+路缘线校准 |
| 自行车／步行 | Adams 北段存在沿中央分隔岛的共享桥接通道，Tillary 设计有独立保护自行车设施。 | 与机动车转弯边分层处理；避免“自行车通道”被误建为汽车车道 |

### 下一处真实严重断点：Adams St × Johnson St（自行车）

2026-06 NYC DOT 项目介绍／报道指出，Brooklyn Bridge 下桥向南骑行者经 Adams 中央区域，到 **Johnson Street** 时存在自行车通路结束、需要危险转向的接驳问题；计划于 2026 秋后加入 Johnson–Fulton 的受保护双向自行车连接。**2026-10 NYC DOT 已正式宣布开始 Adams/Boerum 段施工**（下方新增官方链接）；但没有工程验收或精确开放日期证据，**不能宣称 Johnson 接驳缺口已消失**。

建议将该点作为 **P1 自行车网络联通验收**：检查 `BIKE_TRAFDIR`、节点可通行性与临时施工布置；不能仅因为 2026 年设计方案就自动标记 `connected`。

### DUMBO 步行出口是第三种连接：Washington St × Prospect St

Brooklyn Bridge Park 的官方访问信息指出，DUMBO 方向桥上人行步道由 **Washington Street / Cadman Plaza East × Prospect Street** 附近的楼梯接入。这是步行楼梯／桥上人行道连接，**不是桥面机动车直接转入 DUMBO 的出口**；不要在这里生成汽车转弯车道或把这条接驳与 Adams–Tillary 机动车信号合并。

### P1 扩展：DUMBO 的 Sands St → Adams St → York St → Front St（2027 施工计划）

NYC DOT 在 2026-09 发布的街区方案明确区分 **Sands Street：Jay→Adams**，以及 **Adams Street：Sands→Front**。2026-10 官方通报称计划将 Adams 的 Sands–York 段升级为受保护自行车道、York–Front 段使用常规自行车道，并改善 Sands 的 Jay–Adams 骑行接驳；市府“Current Projects”页面将 Sands/Adams 道路施工计划放在 **2027 年街道重铺之后**。因此不能把这些规划车道作为 2026-11 已完成的路网边，也不能用其修改现有汽车车道方向。

- 官方在建声明：https://www.nyc.gov/html/dot/html/pr2026/biketober-brooklyn-bridge-cycling-upgrade.shtml
- 官方现行项目清单：https://www.nyc.gov/html/dot/html/about/current-projects.shtml
- DOT 2026-06 Adams/Boerum 分隔岛与自行车道方案：https://www.nyc.gov/html/dot/downloads/pdf/adams-st-boerum-pl-jun2026.pdf （Fulton→Johnson 标示 10 英尺双向保护骑行道，并说明保持既有机动车车道；它是提议断面，不是施工验收图）

**建模界限：** 将该段标记 `planned_2027_unverified_current`；不在城市街段尚未验证 LION `SegmentID/BIKE_TRAFDIR` 前画连续自行车绿道，更不得跨桥面／从桥口直接转接到普通街口。现实街区机动车车道数不能从这个自行车工程图覆盖到整张游戏地图。

## 3. LION / CSCL 数据对照规则（待导入真实记录）

官方来源：

1. DCP LION：https://data.cityofnewyork.us/City-Government/LION/2v4z-66xt
2. NYC CSCL Centerline：https://data.cityofnewyork.us/City-Government/NYC-Street-Centerline-CSCL-/inkn-q76z
3. DCP LION 元数据（字段语义）：https://nycopendata.socrata.com/api/views/2v4z-66xt/files/ddf2c488-9746-443c-bb97-40ffb583ee2c?download=true&filename=lion_metadata.pdf
4. 纽约市 CSCL 官方元数据：https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/CSCL_Pub.md

真实取数时只选择该片区的实际道路段，按街名和**真实节点拓扑**追踪 Adams、Tillary、Johnson、Washington、Prospect、Sands/Pearl；取每条记录的 `SegmentID`、`FromNode`、`ToNode`、`TrafDir`、`SegmentTyp`、`NonPed`、`RB_Layer`、`BikeLane`、`BIKE_TRAFDIR` 及几何；实际字段名以获取的数据版本为准。留意 LION 中存在平行的 **generic** 假想中心线与不同 **roadbed** 实际路床，单纯空间相交不能证明车辆能转向。必要时核查坡道和高架层级、车道信号与转向限制。

LION 官方字典：`TrafDir=W` 是 From→To 单向，`A` 是 To→From 单向，`T` 双向，`P` 步行非机动车路径；`SegmentTyp=E` 是出入口坡道，`C` 是分隔道路连接线，`R` 是实际 roadbed，`G` 是 generic 虚拟线，`F` 是辅助接续线。方向 **不能** 根据游戏 x/z、街道命名、GIS 图形点序自己猜测。

**坐标门槛：** 纽约 CSCL 官方原生坐标为 EPSG:2263（US feet），公开 GeoJSON 视图可为 EPSG:4326。游戏道路采用自定义压缩坐标，不存在已验证的 GIS→游戏空间仿射／非线性变换。只有在从政府数据获取真实路段和控制点、确认坐标系、量测匹配残差后才允许生产转换；本报告拒绝写任何猜出来的经纬度、SegmentID、NodeID、道路真实米数。

## 4. 接下来给实现方的单次交接（不在本分支实施）

- [ ] 从官方 LION / CSCL 导出 Adams × Tillary 及与 Brooklyn Bridge 路床相连的 **真实 SegmentID+NodeID+TrafDir+SegmentTyp**，尤其区分两侧路床和不同出入口坡道；导出日期记录为版本。若无法导出则保持 null。
- [ ] 识别游戏 `CITY_STREETS[0]`, `[2]`, `[6]` 的真实对应关系；没有官方证据就不要进行自动节点吸附，也不要在物理相交但非同层道路上建立通行边。
- [ ] 将 Brooklyn 端第一优先路口建成两种网络：有向汽车路床/转向连接，与步行／自行车中央岛接驳；仅对已验证可连接的路段绘制停线／斑马线。
- [ ] 根据官方图纸规划 Adams×Tillary 的分段斑马线和中央岛；根据 2026 改造进度复核 Adams×Johnson 自行车缺口；单列 Washington×Prospect 的楼梯连接，不作为车道。
- [ ] 新增纯数据的拓扑回归检查：`bridge_to_brooklyn_vehicle` 不允许路线碰壁返回；`adams_tillary_turn_constraints` 不能默认全转；`adams_johnson_bike_path` 标记 2026 状态；`dumbo_ped_stairs` 禁止机动车进入。**请由正式负责源码的分支实现**。

## 5. 官方设计图与状态差异

- 纽约市 DOT 改造页面：https://www.nyc.gov/html/dot/html/about/projects-2020.shtml
- 纽约市 DOT Tillary / Adams 设计 PDF：https://www.nyc.gov/html/dot/downloads/pdf/tillary-adams-reconstruction.pdf （重点 PDF 页 8–12/15：车道分流、跨街及中央岛；图中多处为拟议示意）
- 纽约市 DOT 2008 项目左转限制历史：https://www.nyc.gov/html/dot/downloads/pdf/sustainable_streets_index_09.pdf
- Brooklyn Bridge Park 官方步行入口：https://brooklynbridgepark.org/places-to-see/brooklyn-bridge/
- 2026-06 Adams–Johnson 自行车网络中断与计划施工（DOT 社区汇报的新闻记录，非竣工证明）：https://nyc.streetsblog.org/2026/06/09/dot-will-install-protected-bike-lane-on-key-bklyn-bridge-connection-boerum-adams
- 2026-10 DOT 正式开工通告（不代表竣工）：https://www.nyc.gov/html/dot/html/pr2026/biketober-brooklyn-bridge-cycling-upgrade.shtml
- 2026-09 Sands/Adams→Front 的 2027 方案见当前项目列表：https://www.nyc.gov/html/dot/html/about/current-projects.shtml
- 2026-06 DOT 机动车/自行车分道断面：https://www.nyc.gov/html/dot/downloads/pdf/adams-st-boerum-pl-jun2026.pdf

**完整性说明**：此文件是规划证据，不是 LION 现场数据提取成果。第一次正式 GIS 导入前，任何精确 GIS 位置、节点连通和交通方向都必须保持 `unverified`。不涉及桥面几何或飞行物理。
