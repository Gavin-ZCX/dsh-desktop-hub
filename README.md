# dsh-desktop-hub

DeepSeek Harness 原生桌面环境控制与跨机中枢可视化管理面板（独立插件页面）。

## 功能特性

1. **左侧栏原生入口与独立主面板**：
   - 挂载于 `sidebar.panellist`（order: 6，位于 Obsidian 资产旁边）；
   - 在 `main` 槽位渲染全功能控制面板，提供可视化交互，无需额外打开外部黑框或控制台。
2. **窗口关闭与退出行为管理 (Desktop Window Exit Control)**：
   - 实时检测当前 `app.asar` 的退出行为（直接完全退出 vs 隐藏至托盘）；
   - 页面上一键平滑切换，自动维护 `app.asar.original` 备份，毫秒级就地等长字节对齐写入；
   - 解决每次退出都需要去托盘右键退出的繁琐操作。
3. **跨机中枢双向同步 (Central Hub Sync)**：
   - 可视化展示当前 PC 客户端与所配置中枢工作区（`agentWorkspace`）基准的状态；
   - 一键在线执行差异比对（Diff）、提交改动到中枢基准（Push）；
   - 查看对齐计划（Pull Plan）与多 PC 协同 SOP 指引；
   - 内置控制台日志输出窗口，实时呈现比对与提交结果。
4. **外观快捷切换与全局增强**：
   - 控制面板内外观实时状态与一键切换；
   - 会话顶栏右上角日/月图标快捷切换；
   - 侧边栏底部设置图标旁快捷切换；
   - 全局快捷键 `Ctrl + Shift + L`（Mac: `Cmd + Shift + L`）无感切换。
5. **系统与资产快捷辅助**：
   - 一键批量重建 Obsidian 资料库共享软链（`relink_all.py --apply`）；
   - 一键生成/修复 Windows 桌面快捷方式。

## 安装与配置

在 DSH Desktop profile 的 `package.json` 中按版本标签引用：

```json
"dsh-desktop-hub": "github:<owner>/dsh-desktop-hub#v1.2.0"
```

并把 `dsh-desktop-hub` 加入 `dsh.profile.bundles`。插件源码不写死任何本机路径，在 profile 的 `cordis.patch.yml` 中配置：

```yaml
- id: dsh-desktop-hub
  name: dsh-desktop-hub
  config:
    enabled: true
    agentWorkspace: "D:/path/to/your/workspace"   # 必填；也可用环境变量 DSH_AGENT_WORKSPACE
    obsidianShared: "D:/path/to/obsidian-shared"  # 可选；也可用环境变量 DSH_OBSIDIAN_SHARED
    # baselineRoot: 默认 <agentWorkspace>/deploy/dsh/baselines
    # scriptsDir:   默认 <agentWorkspace>/deploy/dsh
```

| 配置项 | 用途 | 未配置时 |
|---|---|---|
| `agentWorkspace` | 中枢工作区根目录 | 同步、比对、快捷方式功能返回“未配置”提示 |
| `baselineRoot` | 基线目录所在位置（目录名 `YYYY-MM-DD`，同日修订加 `-N` 后缀），面板显示名称最新的一份 | 默认 `<agentWorkspace>/deploy/dsh/baselines` |
| `scriptsDir` | `dsh-profile-sync.ps1`、`create-desktop-shortcut.ps1` 所在目录 | 默认 `<agentWorkspace>/deploy/dsh` |
| `obsidianShared` | Obsidian 共享配置目录（含 `relink_all.py`） | Obsidian 链接重建功能返回“未配置”提示 |

## 注意

“窗口关闭直接退出”功能会对 DeepSeek Harness 安装目录下的 `app.asar` 做等长字节补丁，并保留 `app.asar.original` 备份。DSH 升级后补丁会被覆盖，需要重新应用。
