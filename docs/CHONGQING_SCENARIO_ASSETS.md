# PATROL 重庆高精度场景：Scenario for Blender 工作流（V2）

这不是生成完成的照片级模型。GitHub 游戏中的重庆**已经升级**了程序化城市轮廓、
住宅/商务楼 PBR 外墙图集、白天/黄昏/夜间色彩与入口 HUD；
下面这套是让真正由 Scenario/Blender 制作的 GLB 能被安全审查并试载的管线。

## 官方软件与连接

- 官方扩展：https://github.com/scenario-labs/blender-plugin
- Blender 版本：**5.0 或更高版本**。
- Blender > Preferences > Get Extensions > Repositories > Add Remote：
  `https://blender.scenario.com/repo/index.json`
- 按 N 打开 Sidebar > Scenario。账号/API key 只配置在本机插件偏好。
- Scenario > Agents (MCP) 打开本机服务；通常为
  `http://127.0.0.1:9876/mcp`。端口和 Token 必须以本机显示为准，
  不能将 Bearer Token、API 密钥或访问凭据提交到 GitHub。
- 若需要连接 Codex，使用 Scenario 插件提供的 **Connect Codex** 控件。
  当前 ChatGPT 会话无法访问你的 Windows 本机 Blender MCP，也没有调用收费生成。

## 四个重点建筑（请按下面顺序）

1. **洪崖洞** `hongyadong`：11 层临江吊脚楼、木结构露台、瓦屋面、
   建筑立面温暖且不重复的窗口、真实山体与上层沧白路连接。
2. **千厮门大桥** `qiansimen`：单塔斜拉索、红色主桥桁架，上层道路
   与下层轨道系统比例及夜景灯光。不要把它建成普通双塔悬索桥。
3. **朝天门来福士** `raffles`：八栋帆型玻璃塔楼与横向空中连廊
   Crystal，真实曲面、立面窗框和金属/混凝土基座。
4. **李子坝** `liziba`：真实单轨梁、列车穿楼层、住宅立面空调外机、
   站台和山坡；请不要用普通双轨地铁或车厢立方体代替。

可参考建筑形态与坐标关系，不要复制 Google Maps 影像、街景瓦片、他人
未授权 3D 模型或广告素材。照片不等于用户拥有其再分发授权。

## Scenario 成本与生成检查

Scenario for Blender 生成 3D 或 PBR 资源可能消耗 Creative Units。
通过 MCP 先 `scene_summary`，再 `list_models`、
`model_schema`，使用 `estimate_cost` 获得本次精确报价。
**报价和资费由用户明确批准后才能执行 `generate`。**
不要把示例 API Key 或报价 ID 写死进脚本。也不要未经单独授权运行
插件的任意 Python 命令。

## 本地导出到 PATROL（不调用云端）

在 Blender 中将目标建筑模型、PBR 材质与贴图统一放进
`PATROL_CQ_EXPORT` Collection，模型以自己的建筑地面中心为原点；
不要预先移动到游戏的 world anchor，也不要反转 Y 轴。
检查贴图和法线、合并不必要的内部三角形，预算 25k triangles / 8 MiB。

```powershell
blender -b Chongqing.blend --python tools/blender/chongqing_scenario_export.py -- --asset hongyadong
```

导出后 **默认不会启用**。人工完成外观、授权、精度检查后：
```powershell
blender -b Chongqing.blend --python tools/blender/chongqing_scenario_export.py -- --asset hongyadong --reviewed --license "Original artwork: commercial redistribution approved" --activate
```

此命令仅启用**预览模式**，并不隐藏现有程序化场景，也不更新碰撞。
提交 GLB 与 manifest 后，可以打开
`/chongqing.html?time=dusk&scenarioPreview=1` 查看审核效果。
要正式替换现有地标，仍须在对应地标模块中按 id 分组，关闭
旧模型，匹配尺寸和碰撞，再验证视觉、FPS 和低配兼容模式。

## 当前生产状态

- 白天／黄昏／夜景场景入口和现有 PBR 材料支持已实现。
- 5 种程序化建筑轮廓与对应商住外墙图集已实现。
- Scenario runtime 是可选的 `preview-only` 加载器；4 个资产槽均为
  `enabled:false`，**尚未生成/安装 Blender 输出 GLB**。
- 纽约场景继续使用原有 PATROL WebGL2 引擎，重庆保留独立
  Three.js WebGL2 Scene；色调和菜单视觉接近，但**尚不属于
  同一渲染器或同一飞行控制系统**。也不应声称测绘级一比一。
