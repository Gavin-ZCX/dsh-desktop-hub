window.__ModuleLoader__.load({
  id: "dsh-desktop-hub",
  factory(require) {
    const React = require("react");
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef } = React;

    // --- 图标定义 ---
    function HubNavIcon({ size = 18, active = false }) {
      const edge = size || 18;
      const strokeColor = active ? "#38bdf8" : "currentColor";
      const fillColor = active ? "rgba(56, 189, 248, 0.2)" : "none";

      return h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: edge,
          height: edge,
          fill: "none",
          stroke: strokeColor,
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          style: { display: "inline-block", verticalAlign: "middle", flexShrink: 0 },
        },
        h("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.5", fill: fillColor }),
        h("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.5", fill: fillColor }),
        h("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.5", fill: fillColor }),
        h("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.5", fill: fillColor }),
        h("path", { d: "M10 6.5h4" }),
        h("path", { d: "M10 17.5h4" }),
        h("path", { d: "M6.5 10v4" }),
        h("path", { d: "M17.5 10v4" }),
        h("circle", { cx: "12", cy: "12", r: "1.8", fill: strokeColor })
      );
    }

    function SunIcon({ size = 16, style = {} }) {
      return h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: size,
          height: size,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          style: { display: "inline-block", verticalAlign: "middle", ...style },
        },
        h("circle", { cx: "12", cy: "12", r: "4" }),
        h("path", { d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" })
      );
    }

    function MoonIcon({ size = 16, style = {} }) {
      return h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: size,
          height: size,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          style: { display: "inline-block", verticalAlign: "middle", ...style },
        },
        h("path", { d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" })
      );
    }

    function RefreshIcon({ size = 15, spinning = false }) {
      return h(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: size,
          height: size,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          style: {
            display: "inline-block",
            verticalAlign: "middle",
            animation: spinning ? "dshHubSpin 0.8s linear infinite" : "none",
          },
        },
        h("path", { d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19" })
      );
    }

    // --- API 调用客户端 ---
    async function apiCall(endpoint, method = "GET", body = null) {
      const opts = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`/api/desktop-hub${endpoint}`, opts);
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) errMsg = data.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      return await res.json();
    }

    // --- 高可靠双轨主题切换 Hook ---
    function useCurrentTheme(ctx) {
      const checkIsDark = () => {
        if (typeof document === "undefined") return true;
        return (
          document.body?.hasAttribute("data-ds-dark-theme") ||
          document.documentElement?.getAttribute("data-ds-theme-source") === "dark" ||
          document.documentElement?.style?.colorScheme === "dark"
        );
      };

      const [isDark, setIsDark] = useState(checkIsDark);

      useEffect(() => {
        const update = () => setIsDark(checkIsDark());
        const observer = new MutationObserver(update);
        if (document.body) {
          observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
        }
        if (document.documentElement) {
          observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-ds-dark-theme", "data-ds-theme-source", "style"],
          });
        }
        const dispose = ctx?.on?.("theme/change", update);
        return () => {
          observer.disconnect();
          dispose?.();
        };
      }, [ctx]);

      const toggleTheme = useCallback(() => {
        const currentlyDark = checkIsDark();
        const nextScheme = currentlyDark ? "light" : "dark";

        // 1. 物理级 DOM 0 延迟切换：立即生效，视觉绝对变色
        try {
          document.documentElement.style.colorScheme = nextScheme;
          document.documentElement.setAttribute("data-ds-theme-source", nextScheme);
          if (nextScheme === "dark") {
            document.body?.setAttribute("data-ds-dark-theme", "");
          } else {
            document.body?.removeAttribute("data-ds-dark-theme");
          }
        } catch (domErr) {
          console.error("[dsh-desktop-hub] DOM theme error:", domErr);
        }

        // 2. 调用 Cordis theme 服务做持久化
        try {
          if (ctx?.theme?.setTheme) {
            ctx.theme.setTheme(nextScheme);
          }
        } catch (svcErr) {
          console.warn("[dsh-desktop-hub] ctx.theme.setTheme error:", svcErr);
        }

        setIsDark(nextScheme === "dark");
      }, [ctx]);

      return { isDark, toggleTheme };
    }

    // --- 顶栏快捷切换按钮 (会话右上角工具栏) ---
    function HeaderThemeToggle({ hostCtx }) {
      const { isDark, toggleTheme } = useCurrentTheme(hostCtx);
      const [hovered, setHovered] = useState(false);
      const title = isDark ? "切换为浅色外观 (Ctrl+Shift+L)" : "切换为深色外观 (Ctrl+Shift+L)";

      return h(
        "button",
        {
          type: "button",
          onClick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTheme();
          },
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
          title,
          "aria-label": title,
          style: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            padding: "0",
            margin: "0 2px",
            border: "none",
            borderRadius: "6px",
            background: hovered ? "var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.15))" : "transparent",
            color: hovered ? "var(--dsw-alias-label-primary, currentColor)" : "var(--dsw-alias-label-secondary, currentColor)",
            cursor: "pointer",
            transition: "all 0.15s ease",
            outline: "none",
            flexShrink: 0,
          },
        },
        isDark ? h(SunIcon, { size: 16 }) : h(MoonIcon, { size: 16 })
      );
    }

    // ==========================================
    //   桌面与中枢管理台主页面 (DesktopHubPage)
    // ==========================================

    // ==========================================
    // 中枢架构全景高清矢量图组件 (ArchitectureOverview)
    // ==========================================
    function ArchitectureOverview({ isDark = true }) {
      const bg = isDark ? "#0c0d12" : "#ffffff";
      const border = isDark ? "#232733" : "#e2e8f0";
      const textMain = isDark ? "#f1f5f9" : "#0f172a";
      const textMuted = isDark ? "#94a3b8" : "#64748b";
      const cardBg = isDark ? "rgba(22, 27, 34, 0.85)" : "#f8fafc";
      const hubBg = isDark ? "rgba(30, 27, 75, 0.45)" : "#f5f3ff";
      const dshColor = "#0284c7";
      const claudeColor = "#d97706";
      const docColor = "#10b981";
      const hubColor = "#6366f1";
      const gitColor = isDark ? "#818cf8" : "#4f46e5";

      return h(
        "svg",
        {
          viewBox: "0 0 960 520",
          width: "100%",
          height: "auto",
          style: {
            display: "block",
            borderRadius: "12px",
            border: "1px solid " + border,
            background: bg,
            boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.06)",
          },
        },
        h(
          "defs",
          null,
          h("marker", { id: "arrowDsh", markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto" },
            h("polygon", { points: "0 0, 6 3, 0 6", fill: dshColor })
          ),
          h("marker", { id: "arrowClaude", markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto" },
            h("polygon", { points: "0 0, 6 3, 0 6", fill: claudeColor })
          ),
          h("marker", { id: "arrowDoc", markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto" },
            h("polygon", { points: "0 0, 6 3, 0 6", fill: docColor })
          ),
          h("marker", { id: "arrowHub", markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto" },
            h("polygon", { points: "0 0, 6 3, 0 6", fill: hubColor })
          ),
          h("marker", { id: "arrowGit", markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto" },
            h("polygon", { points: "0 0, 6 3, 0 6", fill: gitColor })
          )
        ),

        // 顶层：双核 Agent 协作与项目文档
        h("rect", { x: 40, y: 25, width: 270, height: 105, rx: 10, fill: cardBg, stroke: dshColor, strokeWidth: 1.5 }),
        h("text", { x: 56, y: 52, fill: dshColor, fontSize: 15, fontWeight: "700" }, "DeepSeek Harness"),
        h("text", { x: 56, y: 74, fill: textMain, fontSize: 12, fontWeight: "600" }, "日常总入口 · 任务总控 · 插件定制"),
        h("text", { x: 56, y: 94, fill: textMuted, fontSize: 11 }, "· 多模型网关调度 (Magpie / Agy)"),
        h("text", { x: 56, y: 112, fill: textMuted, fontSize: 11 }, "· 任务形式化、前置拆解与多维中台"),

        h("rect", { x: 345, y: 35, width: 270, height: 85, rx: 10, fill: isDark ? "rgba(6, 78, 59, 0.35)" : "#ecfdf5", stroke: docColor, strokeWidth: 1.5 }),
        h("text", { x: 480, y: 62, fill: docColor, fontSize: 14, fontWeight: "700", textAnchor: "middle" }, "📄 具体项目文档 (单一事实来源)"),
        h("text", { x: 480, y: 84, fill: textMain, fontSize: 11, textAnchor: "middle" }, "Feedrate-Optimize · LaserAblation · ..."),
        h("text", { x: 480, y: 102, fill: textMuted, fontSize: 10.5, textAnchor: "middle" }, "双方各自感知项目文档 · 无私有黑盒通信"),

        h("rect", { x: 650, y: 25, width: 270, height: 105, rx: 10, fill: cardBg, stroke: claudeColor, strokeWidth: 1.5 }),
        h("text", { x: 666, y: 52, fill: claudeColor, fontSize: 15, fontWeight: "700" }, "Claude Desktop (Code模式)"),
        h("text", { x: 666, y: 74, fill: textMain, fontSize: 12, fontWeight: "600" }, "重大科研攻坚主力 · 顺手高效"),
        h("text", { x: 666, y: 94, fill: textMuted, fontSize: 11 }, "· 深度理论推导 · 算法长链路实现"),
        h("text", { x: 666, y: 112, fill: textMuted, fontSize: 11 }, "· 受 ~/.claude 全局规则与专用技能约束"),

        h("line", { x1: 310, y1: 78, x2: 343, y2: 78, stroke: dshColor, strokeWidth: 1.5, markerEnd: "url(#arrowDsh)" }),
        h("line", { x1: 650, y1: 78, x2: 617, y2: 78, stroke: claudeColor, strokeWidth: 1.5, markerEnd: "url(#arrowClaude)" }),

        // 中层：AgentWorkspace 本地总枢
        h("rect", { x: 40, y: 160, width: 880, height: 160, rx: 12, fill: hubBg, stroke: hubColor, strokeWidth: 1.5 }),
        h("text", { x: 60, y: 188, fill: hubColor, fontSize: 14, fontWeight: "700" }, "🏛️ AgentWorkspace 本地中枢 (C:\\AgentWorkspace · 全维单一维护源)"),
        h("text", { x: 900, y: 188, fill: textMuted, fontSize: 11, textAnchor: "end" }, "统一说明规则/技能从哪来、适用于谁、各电脑如何对齐"),

        h("rect", { x: 55, y: 205, width: 205, height: 100, rx: 8, fill: cardBg, stroke: border, strokeWidth: 1 }),
        h("text", { x: 70, y: 228, fill: textMain, fontSize: 12.5, fontWeight: "700" }, "1. 规则体系"),
        h("text", { x: 70, y: 246, fill: hubColor, fontSize: 10.5 }, "docs/agent-config/"),
        h("text", { x: 70, y: 266, fill: textMuted, fontSize: 10.5 }, "· DSH 独立纯净薄入口"),
        h("text", { x: 70, y: 282, fill: textMuted, fontSize: 10.5 }, "· Claude 全局规则正文"),
        h("text", { x: 70, y: 298, fill: textMuted, fontSize: 10.5 }, "· 各自独立 · 授权才共用"),

        h("rect", { x: 275, y: 205, width: 205, height: 100, rx: 8, fill: cardBg, stroke: border, strokeWidth: 1 }),
        h("text", { x: 290, y: 228, fill: textMain, fontSize: 12.5, fontWeight: "700" }, "2. 托管技能源码"),
        h("text", { x: 290, y: 246, fill: hubColor, fontSize: 10.5 }, "skills/ · SOURCES.json"),
        h("text", { x: 290, y: 266, fill: textMuted, fontSize: 10.5 }, "· 24个学术/绘图/治理包"),
        h("text", { x: 290, y: 282, fill: textMuted, fontSize: 10.5 }, "· 薄入口按需调用路由"),
        h("text", { x: 290, y: 298, fill: textMuted, fontSize: 10.5 }, "· SOURCES.json 版本账本"),

        h("rect", { x: 495, y: 205, width: 205, height: 100, rx: 8, fill: cardBg, stroke: border, strokeWidth: 1 }),
        h("text", { x: 510, y: 228, fill: textMain, fontSize: 12.5, fontWeight: "700" }, "3. 通用工作环境"),
        h("text", { x: 510, y: 246, fill: hubColor, fontSize: 10.5 }, "docs/environment/"),
        h("text", { x: 510, y: 266, fill: textMuted, fontSize: 10.5 }, "· Obsidian 9 资料库共用"),
        h("text", { x: 510, y: 282, fill: textMuted, fontSize: 10.5 }, "· 本机 MCP 自动化协议"),
        h("text", { x: 510, y: 298, fill: textMuted, fontSize: 10.5 }, "· 单机代理与硬件路由"),

        h("rect", { x: 715, y: 205, width: 190, height: 100, rx: 8, fill: cardBg, stroke: border, strokeWidth: 1 }),
        h("text", { x: 730, y: 228, fill: textMain, fontSize: 12.5, fontWeight: "700" }, "4. DSH 宿主基线"),
        h("text", { x: 730, y: 246, fill: hubColor, fontSize: 10.5 }, "deploy/dsh/baselines/"),
        h("text", { x: 730, y: 266, fill: textMuted, fontSize: 10.5 }, "· 标准插件与UI规范"),
        h("text", { x: 730, y: 282, fill: textMuted, fontSize: 10.5 }, "· 脱敏配置 · 排除凭据"),
        h("text", { x: 730, y: 298, fill: textMuted, fontSize: 10.5 }, "· 本地固化 / 自动对齐"),

        h("line", { x1: 175, y1: 130, x2: 175, y2: 158, stroke: dshColor, strokeWidth: 1.5, strokeDasharray: "3 3", markerEnd: "url(#arrowDsh)" }),
        h("line", { x1: 785, y1: 130, x2: 785, y2: 158, stroke: claudeColor, strokeWidth: 1.5, strokeDasharray: "3 3", markerEnd: "url(#arrowClaude)" }),

        // 底层：双机物理设备与 GitHub 远程中枢
        h("rect", { x: 60, y: 395, width: 250, height: 95, rx: 10, fill: cardBg, stroke: border, strokeWidth: 1.5 }),
        h("text", { x: 76, y: 422, fill: textMain, fontSize: 13.5, fontWeight: "700" }, "💻 Station P920"),
        h("text", { x: 76, y: 442, fill: textMuted, fontSize: 11 }, "高性能计算工作站 · TwinCAT工控机"),
        h("text", { x: 76, y: 462, fill: textMuted, fontSize: 10.5 }, "· 运行 DSH 中控与 Claude Desktop"),
        h("text", { x: 76, y: 478, fill: textMuted, fontSize: 10.5 }, "· C:\\AgentWorkspace 本地副本"),

        h("rect", { x: 345, y: 385, width: 270, height: 115, rx: 10, fill: isDark ? "rgba(49, 46, 129, 0.4)" : "#eef2ff", stroke: gitColor, strokeWidth: 1.8 }),
        h("text", { x: 480, y: 412, fill: gitColor, fontSize: 14, fontWeight: "700", textAnchor: "middle" }, "☁️ GitHub 私有中枢仓库"),
        h("text", { x: 480, y: 432, fill: textMain, fontSize: 11, textAnchor: "middle" }, "Gavin-ZCX/AgentWorkspace"),
        h("text", { x: 480, y: 454, fill: textMuted, fontSize: 10.5, textAnchor: "middle" }, "全中枢跨机同步权威唯一中介"),
        h("text", { x: 480, y: 472, fill: textMuted, fontSize: 10, textAnchor: "middle" }, "同步范围：规则 + 技能 + 环境 + 宿主基线"),
        h("text", { x: 480, y: 488, fill: hubColor, fontSize: 10, fontWeight: "600", textAnchor: "middle" }, "Git Pull 自动拉取 · Git Push 审慎推送"),

        h("rect", { x: 650, y: 395, width: 250, height: 95, rx: 10, fill: cardBg, stroke: border, strokeWidth: 1.5 }),
        h("text", { x: 666, y: 422, fill: textMain, fontSize: 13.5, fontWeight: "700" }, "💻 cxwork"),
        h("text", { x: 666, y: 442, fill: textMuted, fontSize: 11 }, "便携移动工作台 · 随身开发本"),
        h("text", { x: 666, y: 462, fill: textMuted, fontSize: 10.5 }, "· 运行 DSH 中控 (FlClash代理环境)"),
        h("text", { x: 666, y: 478, fill: textMuted, fontSize: 10.5 }, "· C:\\AgentWorkspace 本地副本"),

        h("line", { x1: 480, y1: 320, x2: 480, y2: 383, stroke: gitColor, strokeWidth: 2, strokeDasharray: "4 3", markerEnd: "url(#arrowGit)" }),
        h("line", { x1: 310, y1: 442, x2: 343, y2: 442, stroke: gitColor, strokeWidth: 1.5, markerEnd: "url(#arrowGit)" }),
        h("line", { x1: 650, y1: 442, x2: 617, y2: 442, stroke: gitColor, strokeWidth: 1.5, markerEnd: "url(#arrowGit)" })
      );
    }


    function DesktopHubPage({ hostCtx }) {
      const { isDark, toggleTheme } = useCurrentTheme(hostCtx);
      const [activeTab, setActiveTab] = useState("quit"); // "quit" | "sync" | "tools"
      const [loading, setLoading] = useState(true);
      const [status, setStatus] = useState(null);
      const [actionLoading, setActionLoading] = useState(false);
      const [consoleOutput, setConsoleOutput] = useState("");
      const [toast, setToast] = useState(null);
      const [pullPlanReady, setPullPlanReady] = useState(false);
      const [pullSchedule, setPullSchedule] = useState(null);
      const [repoStatus, setRepoStatus] = useState(null);

      const showToast = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
      };

      const fetchStatus = useCallback(async () => {
        try {
          setLoading(true);
          const res = await apiCall("/status");
          if (res.ok) {
            setStatus(res);
          }
        } catch (err) {
          showToast(`获取系统状态失败: ${err.message}`, "error");
        } finally {
          setLoading(false);
        }
      }, []);

      useEffect(() => {
        fetchStatus();
      }, [fetchStatus]);

      // GitHub 仓库状态（远端新提交、本地未推送、未提交文件）
      const fetchRepoStatus = useCallback(async () => {
        try {
          const res = await apiCall("/sync/repo-status");
          setRepoStatus(res);
        } catch (err) {
          setRepoStatus({ ok: false, error: err.message });
        }
      }, []);

      useEffect(() => {
        fetchRepoStatus();
      }, [fetchRepoStatus]);

      // 切换退出与托盘行为补丁
      const handleToggleQuitAction = async () => {
        try {
          setActionLoading(true);
          const res = await apiCall("/quit-action/toggle", "POST");
          if (res.ok) {
            showToast(res.result?.message || "切换成功！", "success");
            await fetchStatus();
          } else {
            showToast(res.error || "切换失败", "error");
          }
        } catch (err) {
          showToast(`操作失败: ${err.message}`, "error");
        } finally {
          setActionLoading(false);
        }
      };

      // 差异比对
      const handleRunDiff = async () => {
        try {
          setActionLoading(true);
          setConsoleOutput("正在比对当前 DSH 宿主环境与本地基线目录差异 (Diff)...\n");
          const res = await apiCall("/sync/diff", "POST");
          setConsoleOutput(res.output || "无输出");
          showToast(res.ok ? "差异比对完成" : "比对未完成，详见日志", res.ok ? "success" : "error");
        } catch (err) {
          setConsoleOutput("执行失败: " + err.message);
          showToast("比对失败: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      // 固化为本地基线（纯本地操作：脱敏写入 deploy/dsh/baselines/，绝不联网）
      const handleSaveBaseline = async () => {
        if (!confirm("确认将当前机器调好的 DSH 插件、配置与外观脱敏后，固化为本地基线？\n\n此操作仅在本地 C:\\AgentWorkspace 目录写入基线文件，不发起任何 Git 提交与远程推送。")) {
          return;
        }
        try {
          setActionLoading(true);
          setConsoleOutput("正在将本机 DSH 配置固化为本地中枢基线 (SaveBaseline)...\n");
          const res = await apiCall("/sync/save-baseline", "POST");
          setConsoleOutput(res.output || "无输出");
          showToast(res.ok ? "已成功固化为本地中枢基线！" : "固化基线未完成，详见日志", res.ok ? "success" : "error");
          await fetchStatus();
          await fetchRepoStatus();
        } catch (err) {
          setConsoleOutput("执行失败: " + err.message);
          showToast("固化失败: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      // 从 GitHub 远程拉取中枢仓库 (Git Pull)
      const handleGitPull = async () => {
        try {
          setActionLoading(true);
          setConsoleOutput("正在从 GitHub 拉取最新 AgentWorkspace 中枢资产 (Git Pull)...\n");
          const res = await apiCall("/sync/git-pull", "POST");
          setConsoleOutput(res.output || "无输出");
          showToast(res.ok ? "已从 GitHub 拉取最新提交" : "拉取未完成，详见日志", res.ok ? "success" : "error");
          await fetchRepoStatus();
          await fetchStatus();
        } catch (err) {
          setConsoleOutput("拉取失败: " + err.message);
          showToast("拉取失败: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      // 提交并推送到 GitHub 远程仓库 (Git Push)
      const handleGitPush = async () => {
        if (!confirm("确认将本地基线改动或未推送提交，推送到 GitHub 远程仓库？\n\n推送后另一台电脑即可拉取对齐。")) {
          return;
        }
        try {
          setActionLoading(true);
          setConsoleOutput("正在提交中枢基线并推送到 GitHub (Git Push)...\n");
          const res = await apiCall("/sync/git-push", "POST");
          setConsoleOutput(res.output || "无输出");
          showToast(res.ok ? "已成功推送到 GitHub！" : "推送未完成，详见日志", res.ok ? "success" : "error");
          await fetchRepoStatus();
        } catch (err) {
          setConsoleOutput("推送失败: " + err.message);
          showToast("推送失败: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      // 关闭 DSH 后自动对齐：查询已安排状态
      const fetchPullSchedule = useCallback(async () => {
        try {
          const res = await apiCall("/sync/pull-schedule");
          setPullSchedule(res.ok ? res : { ok: false, error: res.error });
        } catch (err) {
          setPullSchedule({ ok: false, error: err.message });
        }
      }, []);

      useEffect(() => {
        fetchPullSchedule();
      }, [fetchPullSchedule]);

      // 第一步：显示对齐计划（只预演），计划正常时出现“确认安排”卡片
      const handlePullPlan = async () => {
        try {
          setActionLoading(true);
          setPullPlanReady(false);
          setConsoleOutput("正在从 GitHub 拉取最新基线，然后生成对齐计划（只预演，不写入）...\n");
          const res = await apiCall("/sync/pull-plan", "POST");
          setConsoleOutput(res.output || "无输出");
          fetchRepoStatus();
          if (res.ok) {
            setPullPlanReady(true);
            showToast("对齐计划已生成，请在下方确认是否安排", "success");
          } else {
            showToast("对齐计划检查未通过，请看输出", "error");
          }
        } catch (err) {
          setConsoleOutput(`执行失败: ${err.message}`);
          showToast(`生成计划失败: ${err.message}`, "error");
        } finally {
          setActionLoading(false);
        }
      };

      // 第二步：确认后安排后台任务（DSH 退出后执行 Pull -Apply，成功后自动重新打开 DSH）
      const handlePullSchedule = async (closeNow = true) => {
        try {
          setActionLoading(true);
          const res = await apiCall("/sync/pull-schedule", "POST", { closeDsh: closeNow });
          if (res.ok) {
            setPullPlanReady(false);
            setPullSchedule(res);
            if (closeNow) {
              showToast("正在自动关闭 DSH 进行对齐...", "success");
            } else {
              showToast(
                res.outcome === "already" ? "已有一个安排在等待，未重复安排" : "已安排：关闭 DSH 后自动对齐",
                "success"
              );
            }
          } else {
            showToast("安排失败: " + (res.error || "未知错误"), "error");
            setConsoleOutput((prev) => prev + "\n\n[安排失败]\n" + (res.error || "") + "\n" + (res.output || ""));
          }
        } catch (err) {
          showToast("安排失败: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      // 一键全自动同步：拉取远端 -> 自动关闭 DSH 对齐并重启
      const handleOneClickSync = async () => {
        if (!confirm("【一键从 GitHub 对齐本机】\n\n将依次自动完成：\n1. 从 GitHub 拉取远程最新中枢资产 (Git Pull)\n2. 自动关闭 DSH 释放文件锁并应用对齐 (-Apply)\n3. 对齐完成后自动重新唤起打开 DSH\n\n是否立即执行？")) {
          return;
        }
        try {
          setActionLoading(true);
          setConsoleOutput("正在执行一键全自动同步 (拉取 GitHub -> 自动重启对齐)...\n");
          const res = await apiCall("/sync/auto-sync", "POST");
          if (res.ok) {
            showToast("已安排自动对齐，DSH 即将重启...", "success");
            setConsoleOutput((prev) => prev + "\n[Git Pull 成功]\n" + (res.pullOutput || "") + "\n\n正在关闭 DSH 进行热复位...");
          } else {
            showToast("一键同步失败: " + (res.error || "未知错误"), "error");
            setConsoleOutput((prev) => prev + "\n[一键同步失败]\n" + (res.error || ""));
          }
        } catch (err) {
          showToast("一键同步异常: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      // 一键固化并发布到 GitHub
      const handleOneClickPublish = async () => {
        if (!confirm("【一键固化并推送到 GitHub】\n\n将依次自动完成：\n1. 将当前机器 DSH 插件、配置脱敏固化写入本地基线\n2. 将本地基线更新安全提交 (git commit)\n3. 推送到远程 GitHub 仓库 (git push)\n\n是否立即执行？")) {
          return;
        }
        try {
          setActionLoading(true);
          setConsoleOutput("正在执行一键全自动发布 (固化基线 -> Git 提交 -> 推送 GitHub)...\n");
          // 先本地固化
          const resSave = await apiCall("/sync/save-baseline", "POST");
          if (!resSave.ok) {
            showToast("本地固化基线未完成，已中止推送", "error");
            setConsoleOutput(resSave.output || "固化失败");
            return;
          }
          // 再推送到 GitHub
          const resPush = await apiCall("/sync/git-push", "POST");
          setConsoleOutput((resSave.output || "") + "\n\n" + (resPush.output || ""));
          showToast(resPush.ok ? "已成功固化并推送到 GitHub！" : "推送未完成，详见日志", resPush.ok ? "success" : "error");
          await fetchRepoStatus();
          await fetchStatus();
        } catch (err) {
          setConsoleOutput("执行异常: " + err.message);
          showToast("发布异常: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      const handlePullCancel = async () => {
        try {
          setActionLoading(true);
          const res = await apiCall("/sync/pull-cancel", "POST");
          if (res.ok && res.cancelled) {
            showToast("已取消自动对齐", "success");
          } else if (res.ok && res.reason === "running") {
            showToast("对齐已在执行中，无法取消", "error");
          } else if (res.ok) {
            showToast("当前没有已安排的自动对齐", "success");
          } else {
            showToast(`取消失败: ${res.error || "未知错误"}`, "error");
          }
        } catch (err) {
          showToast(`取消失败: ${err.message}`, "error");
        } finally {
          await fetchPullSchedule();
          setActionLoading(false);
        }
      };

      // 重新挂载 Obsidian
      const handleRelinkObsidian = async () => {
        try {
          setActionLoading(true);
          const res = await apiCall("/tools/relink-obsidian", "POST");
          if (res.ok) {
            setConsoleOutput(res.output || "Obsidian 共享资产软链对齐完成");
            showToast("Obsidian 共享资产软链对齐完成", "success");
          } else {
            showToast(`执行失败: ${res.error}`, "error");
          }
        } catch (err) {
          showToast(`操作异常: ${err.message}`, "error");
        } finally {
          setActionLoading(false);
        }
      };

      // 样式常量
      const themeStyles = {
        bg: isDark ? "#0f1115" : "#f8fafc",
        cardBg: isDark ? "rgba(26, 29, 36, 0.85)" : "#ffffff",
        cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
        cardShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.4)" : "0 2px 12px rgba(0, 0, 0, 0.05)",
        textPrimary: isDark ? "#f1f5f9" : "#0f172a",
        textSecondary: isDark ? "#94a3b8" : "#64748b",
        accent: "#0ea5e9",
        btnSecondaryBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
        btnSecondaryText: isDark ? "#e2e8f0" : "#334155",
        statusGoodBg: isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
        statusGoodBorder: isDark ? "rgba(16, 185, 129, 0.3)" : "#a7f3d0",
        statusGoodText: isDark ? "#34d399" : "#059669",
        statusWarnBg: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
        statusWarnBorder: isDark ? "rgba(245, 158, 11, 0.3)" : "#fde68a",
        statusWarnText: isDark ? "#fbbf24" : "#d97706",
      };

      const isPatched =
        status?.quitAction?.status === "fully_patched" || status?.quitAction?.status === "patched";

      return h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            height: "100%",
            width: "100%",
            backgroundColor: themeStyles.bg,
            color: themeStyles.textPrimary,
            overflowY: "auto",
            padding: "24px 32px",
            boxSizing: "border-box",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          },
        },
        h(
          "style",
          null,
          `
          @keyframes dshHubSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes dshHubFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
          .dsh-tab-btn:hover { background-color: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}; }
          .dsh-action-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
          .dsh-action-btn:active { transform: translateY(0); }
        `
        ),

        // Toast 浮动提示
        toast
          ? h(
              "div",
              {
                style: {
                  position: "fixed",
                  top: "24px",
                  right: "32px",
                  padding: "12px 20px",
                  borderRadius: "8px",
                  background: toast.type === "error" ? "#ef4444" : "#10b981",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "500",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                  zIndex: 99999,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  animation: "dshHubFadeIn 0.2s ease",
                },
              },
              h("span", null, toast.type === "error" ? "⚠️" : "✅"),
              h("span", null, toast.msg)
            )
          : null,

        // 顶部 Header 区域
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "24px",
              paddingBottom: "16px",
              borderBottom: `1px solid ${themeStyles.cardBorder}`,
            },
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "16px" } },
            h(
              "div",
              {
                style: {
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                },
              },
              h(HubNavIcon, { size: 24, active: true })
            ),
            h(
              "div",
              null,
              h(
                "h1",
                {
                  style: {
                    margin: "0 0 4px 0",
                    fontSize: "22px",
                    fontWeight: "600",
                    color: themeStyles.textPrimary,
                  },
                },
                "桌面环境与跨机中枢管理台"
              ),
              h(
                "p",
                {
                  style: {
                    margin: 0,
                    fontSize: "13px",
                    color: themeStyles.textSecondary,
                  },
                },
                "在应用内可视化管理 DSH 退出行为、跨机基准双向同步与快捷外观切换"
              )
            )
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "12px" } },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  background: themeStyles.cardBg,
                  border: `1px solid ${themeStyles.cardBorder}`,
                  fontSize: "12px",
                  color: themeStyles.textSecondary,
                },
              },
              h("span", null, "当前主机:"),
              h(
                "strong",
                { style: { color: themeStyles.textPrimary, textTransform: "uppercase" } },
                status?.hostname || "检测中..."
              )
            ),
            h(
              "button",
              {
                type: "button",
                onClick: fetchStatus,
                disabled: loading || actionLoading,
                className: "dsh-action-btn",
                title: "刷新系统状态",
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  background: themeStyles.btnSecondaryBg,
                  color: themeStyles.btnSecondaryText,
                  border: `1px solid ${themeStyles.cardBorder}`,
                  cursor: "pointer",
                  fontSize: "13px",
                  transition: "all 0.15s ease",
                },
              },
              h(RefreshIcon, { size: 14, spinning: loading }),
              h("span", null, "刷新状态")
            )
          )
        ),

        // Tab 导航栏
        h(
          "div",
          {
            style: {
              display: "flex",
              gap: "8px",
              marginBottom: "20px",
              borderBottom: `1px solid ${themeStyles.cardBorder}`,
              paddingBottom: "8px",
            },
          },
          [
            { id: "quit", label: "🚪 窗口关闭与托盘行为" },
            { id: "sync", label: "🔄 跨机中枢同步管理" },
            { id: "tools", label: "⚙️ 外观与快捷工具" },
          ].map((tab) =>
            h(
              "button",
              {
                key: tab.id,
                type: "button",
                onClick: () => setActiveTab(tab.id),
                className: "dsh-tab-btn",
                style: {
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: activeTab === tab.id ? "600" : "400",
                  background: activeTab === tab.id ? (isDark ? "rgba(56, 189, 248, 0.15)" : "#e0f2fe") : "transparent",
                  color: activeTab === tab.id ? themeStyles.accent : themeStyles.textSecondary,
                  transition: "all 0.15s ease",
                },
              },
              tab.label
            )
          )
        ),

        // ==========================================
        // TAB 1: 窗口退出与托盘行为管理
        // ==========================================
        activeTab === "quit" &&
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "20px" } },
            h(
              "div",
              {
                style: {
                  background: themeStyles.cardBg,
                  borderRadius: "16px",
                  border: `1px solid ${themeStyles.cardBorder}`,
                  boxShadow: themeStyles.cardShadow,
                  padding: "24px 28px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                },
              },
              h(
                "div",
                { style: { maxWidth: "600px" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" } },
                  h(
                    "span",
                    {
                      style: {
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "600",
                        background: isPatched ? themeStyles.statusGoodBg : themeStyles.statusWarnBg,
                        border: `1px solid ${isPatched ? themeStyles.statusGoodBorder : themeStyles.statusWarnBorder}`,
                        color: isPatched ? themeStyles.statusGoodText : themeStyles.statusWarnText,
                      },
                    },
                    isPatched ? "已激活：彻底移除托盘 + 直接完全退出" : "当前为：官方默认（托盘后台驻留）"
                  )
                ),
                h(
                  "h2",
                  {
                    style: {
                      margin: "0 0 8px 0",
                      fontSize: "18px",
                      fontWeight: "600",
                      color: themeStyles.textPrimary,
                    },
                  },
                  isPatched ? "无托盘驻留，点击右上角 (X) 直接完全退出" : "点击关闭按钮隐藏至托盘后台驻留"
                ),
                h(
                  "p",
                  {
                    style: {
                      margin: 0,
                      fontSize: "13px",
                      lineHeight: "1.6",
                      color: themeStyles.textSecondary,
                    },
                  },
                  isPatched
                    ? "当前已彻底禁用系统托盘图标创建，任务栏通知区域干干净净；点击窗口右上角 (X) 时跳过所有阻隔立即平稳退出，完全不存在任何托盘残留。"
                    : "当前处于官方原版行为。启动时在任务栏右下角常驻托盘图标，点击右上角关闭按钮时窗口将隐藏到系统托盘，需在托盘右键退出。"
                )
              ),
              h(
                "div",
                null,
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handleToggleQuitAction,
                    disabled: actionLoading,
                    className: "dsh-action-btn",
                    style: {
                      padding: "12px 24px",
                      borderRadius: "10px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "600",
                      background: isPatched ? (isDark ? "rgba(255,255,255,0.12)" : "#e2e8f0") : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: isPatched ? themeStyles.textPrimary : "#ffffff",
                      boxShadow: isPatched ? "none" : "0 4px 14px rgba(16, 185, 129, 0.35)",
                      transition: "all 0.15s ease",
                    },
                  },
                  actionLoading
                    ? "正在处理中..."
                    : isPatched
                    ? "恢复为官方托盘后台驻留"
                    : "彻底移除托盘并直接退出 (推荐)"
                )
              )
            ),

            // 底层环境与文件信息
            h(
              "div",
              {
                style: {
                  background: themeStyles.cardBg,
                  borderRadius: "14px",
                  border: `1px solid ${themeStyles.cardBorder}`,
                  padding: "20px 24px",
                },
              },
              h(
                "h3",
                {
                  style: {
                    margin: "0 0 14px 0",
                    fontSize: "15px",
                    fontWeight: "600",
                    color: themeStyles.textPrimary,
                  },
                },
                "底层文件与安全机制"
              ),
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" } },
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between" } },
                  h("span", { style: { color: themeStyles.textSecondary } }, "核心程序包路径 (app.asar):"),
                  h("code", { style: { color: themeStyles.accent } }, status?.quitAction?.asarPath || "检测中...")
                ),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between" } },
                  h("span", { style: { color: themeStyles.textSecondary } }, "官方原版备份:"),
                  h(
                    "span",
                    { style: { color: status?.quitAction?.hasBackup ? themeStyles.statusGoodText : themeStyles.statusWarnText } },
                    status?.quitAction?.hasBackup ? "已安全留存 (app.asar.original)" : "尚未创建"
                  )
                ),
                h(
                  "div",
                  { style: { display: "flex", justifyContent: "space-between" } },
                  h("span", { style: { color: themeStyles.textSecondary } }, "补丁技术规范:"),
                  h("span", null, "原地等长字节对齐替换，彻底禁用 DesktopTray 并直达 quitWithoutConfirmation")
                ),
                h(
                  "div",
                  {
                    style: {
                      marginTop: "8px",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: isDark ? "rgba(2, 132, 199, 0.1)" : "#f0f9ff",
                      color: isDark ? "#38bdf8" : "#0369a1",
                      fontSize: "12px",
                      lineHeight: "1.5",
                    },
                  },
                  "💡 提示：在网页端点击切换后立即就地写入核心，重启 DeepSeek Harness Desktop 客户端即可生效。"
                )
              )
            )
          ),

        // ==========================================
        // TAB 2: 跨机中枢同步管理
        // ==========================================
        activeTab === "sync" &&
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "20px" } },

            // 1. 中枢架构全景矢量图
            h(
              "div",
              {
                style: {
                  background: themeStyles.cardBg,
                  borderRadius: "14px",
                  border: "1px solid " + themeStyles.cardBorder,
                  padding: "16px 20px",
                },
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" } },
                h("h3", { style: { margin: 0, fontSize: "15px", fontWeight: "600" } }, "🏛️ AgentWorkspace 双核与双机中枢架构全景"),
                h("span", { style: { fontSize: "12px", color: themeStyles.textSecondary } }, "以项目文档为单一事实来源 · 规则、技能与基线全维同步")
              ),
              h(ArchitectureOverview, { isDark })
            ),

            // 0. 极速一键操作区 (Fast Actions)
            h(
              "div",
              {
                style: {
                  background: isDark ? "rgba(30, 41, 59, 0.7)" : "#f1f5f9",
                  borderRadius: "14px",
                  border: "1px solid " + (isDark ? "rgba(99, 102, 241, 0.3)" : "#cbd5e1"),
                  padding: "16px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.04)",
                },
              },
              h(
                "div",
                null,
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" } },
                  h("h3", { style: { margin: 0, fontSize: "15px", fontWeight: "700", color: isDark ? "#c7d2fe" : "#3730a3" } }, "⚡ 极速全维闭环 (一键流)"),
                  h("span", { style: { fontSize: "11px", padding: "1px 6px", borderRadius: "6px", background: isDark ? "#312e81" : "#e0e7ff", color: isDark ? "#a5b4fc" : "#4338ca", fontWeight: "600" } }, "高频推荐")
                ),
                h(
                  "p",
                  { style: { margin: 0, fontSize: "12.5px", color: themeStyles.textSecondary } },
                  "一键搞定全流程：发布自动完成固化+提交+推送；对齐自动完成拉取+关闭DSH对齐+自动重新打开。"
                )
              ),
              h(
                "div",
                { style: { display: "flex", gap: "10px" } },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handleOneClickPublish,
                    disabled: actionLoading,
                    className: "dsh-action-btn",
                    title: "一键固化本地基线并推送到 GitHub 远程仓库",
                    style: {
                      padding: "8px 18px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                      boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                    },
                  },
                  "⚡ 一键固化并发布到 GitHub"
                ),
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handleOneClickSync,
                    disabled: actionLoading || Boolean(pullSchedule && pullSchedule.scheduled),
                    className: "dsh-action-btn",
                    title: "从 GitHub 拉取最新提交，自动关闭 DSH 对齐并重新打开",
                    style: {
                      padding: "8px 18px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      color: "#ffffff",
                      cursor: (pullSchedule && pullSchedule.scheduled) ? "not-allowed" : "pointer",
                      opacity: (pullSchedule && pullSchedule.scheduled) ? 0.6 : 1,
                      fontSize: "13px",
                      fontWeight: "600",
                      boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                    },
                  },
                  "🔄 一键拉取并自动重启对齐"
                )
              )
            ),

            // 2. 卡片一：DSH 宿主基线管理（纯本地环境）
            h(
              "div",
              {
                style: {
                  background: themeStyles.cardBg,
                  borderRadius: "14px",
                  border: "1px solid " + themeStyles.cardBorder,
                  padding: "18px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                },
              },
              h(
                "div",
                null,
                h("h3", { style: { margin: "0 0 6px 0", fontSize: "15px", fontWeight: "600" } }, "💾 DSH 宿主基线管理 (本地)"),
                h(
                  "p",
                  { style: { margin: 0, fontSize: "13px", color: themeStyles.textSecondary } },
                  "当前电脑 DSH 运行环境与本地工作区 deploy/dsh/baselines/ 的比对、固化与对齐（纯本地文件，不联网）。"
                )
              ),
              h(
                "div",
                { style: { display: "flex", gap: "10px" } },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handleRunDiff,
                    disabled: actionLoading,
                    className: "dsh-action-btn",
                    style: {
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid " + themeStyles.cardBorder,
                      background: themeStyles.btnSecondaryBg,
                      color: themeStyles.btnSecondaryText,
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "500",
                    },
                  },
                  "🔍 宿主比对 (Diff)"
                ),
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handleSaveBaseline,
                    disabled: actionLoading,
                    className: "dsh-action-btn",
                    title: "将当前跑通的插件与配置脱敏后写入本地基线目录，不推远程",
                    style: {
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                      boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                    },
                  },
                  "💾 固化为基线"
                ),
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handlePullPlan,
                    disabled: actionLoading || Boolean(pullSchedule && pullSchedule.scheduled),
                    className: "dsh-action-btn",
                    title: (pullSchedule && pullSchedule.scheduled)
                      ? "已安排关闭 DSH 后自动对齐；如需重新安排，请先在下方取消"
                      : "先显示对齐计划，确认后安排在关闭 DSH 后自动对齐",
                    style: {
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid " + themeStyles.cardBorder,
                      background: themeStyles.btnSecondaryBg,
                      color: themeStyles.btnSecondaryText,
                      cursor: (pullSchedule && pullSchedule.scheduled) ? "not-allowed" : "pointer",
                      opacity: (pullSchedule && pullSchedule.scheduled) ? 0.6 : 1,
                      fontSize: "13px",
                      fontWeight: "500",
                    },
                  },
                  (pullSchedule && pullSchedule.scheduled) ? "🕒 已安排对齐" : "⬇️ 对齐到中枢"
                )
              )
            ),

            // 3. 卡片二：GitHub 跨机仓库同步（远程中枢）
            h(
              "div",
              {
                style: {
                  background: themeStyles.cardBg,
                  borderRadius: "14px",
                  border: "1px solid " + themeStyles.cardBorder,
                  padding: "18px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                },
              },
              h(
                "div",
                null,
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" } },
                  h("h3", { style: { margin: 0, fontSize: "15px", fontWeight: "600" } }, "☁️ GitHub 跨机仓库同步 (远程中枢)"),
                  repoStatus && repoStatus.ok
                    ? h(
                        "span",
                        {
                          style: {
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "10px",
                            background:
                              repoStatus.behind > 0 || repoStatus.ahead > 0
                                ? themeStyles.statusWarnBg
                                : themeStyles.statusGoodBg,
                            color:
                              repoStatus.behind > 0 || repoStatus.ahead > 0
                                ? themeStyles.statusWarnText
                                : themeStyles.statusGoodText,
                            border: "1px solid " + (
                              repoStatus.behind > 0 || repoStatus.ahead > 0
                                ? themeStyles.statusWarnBorder
                                : themeStyles.statusGoodBorder
                            ),
                            fontWeight: "600",
                          },
                        },
                        repoStatus.behind > 0
                          ? ("落后 " + repoStatus.behind + " 提交")
                          : repoStatus.ahead > 0
                          ? ("领先 " + repoStatus.ahead + " 提交")
                          : "已与远端对齐"
                      )
                    : null
                ),
                h(
                  "p",
                  { style: { margin: 0, fontSize: "13px", color: themeStyles.textSecondary } },
                  "全维跨机协同中枢（包含多 Agent 规则体系、24 个技能资产、工作环境与 DSH 宿主基线）。"
                )
              ),
              h(
                "div",
                { style: { display: "flex", gap: "10px" } },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handleGitPull,
                    disabled: actionLoading,
                    className: "dsh-action-btn",
                    title: "从 GitHub 私有仓库拉取最新提交",
                    style: {
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid " + themeStyles.cardBorder,
                      background: themeStyles.btnSecondaryBg,
                      color: themeStyles.btnSecondaryText,
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "500",
                    },
                  },
                  "☁️ 从 GitHub 拉取 (Git Pull)"
                ),
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handleGitPush,
                    disabled: actionLoading,
                    className: "dsh-action-btn",
                    title: "将本地中枢资产（基线与已暂存资产）推送到 GitHub 远程仓库",
                    style: {
                      padding: "8px 18px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                      boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                    },
                  },
                  "🚀 推送到 GitHub (Git Push)"
                )
              )
            ),

            // 关闭 DSH 后自动对齐：确认安排 / 已安排状态 / 上次结果
            pullPlanReady && !pullSchedule?.scheduled
              ? h(
                  "div",
                  {
                    style: {
                      padding: "16px 20px",
                      borderRadius: "12px",
                      border: `1px solid ${themeStyles.statusWarnBorder}`,
                      background: themeStyles.statusWarnBg,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "16px",
                    },
                  },
                  h(
                    "div",
                    { style: { fontSize: "13px", lineHeight: "1.6" } },
                    h("strong", { style: { color: themeStyles.statusWarnText } }, "确认按下方黑框中的计划对齐本机？"),
                    h("br"),
                    "对齐会改写 DSH 自己的配置和插件，只能在 DSH 关闭后进行。确认后先安排好：你关闭 DSH（点窗口的 X）后，后台自动执行对齐，成功后自动重新打开 DSH；失败则不重新打开，并弹窗告诉你日志位置。4 小时内没关闭 DSH 则自动放弃。"
                  ),
                  h(
                    "div",
                    { style: { display: "flex", gap: "8px", flexShrink: 0 } },
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () => setPullPlanReady(false),
                        disabled: actionLoading,
                        className: "dsh-action-btn",
                        style: {
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: `1px solid ${themeStyles.cardBorder}`,
                          background: themeStyles.btnSecondaryBg,
                          color: themeStyles.btnSecondaryText,
                          cursor: "pointer",
                          fontSize: "13px",
                        },
                      },
                      "不用了"
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: handlePullSchedule,
                        disabled: actionLoading,
                        className: "dsh-action-btn",
                        style: {
                          padding: "8px 16px",
                          borderRadius: "8px",
                          border: "none",
                          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                          color: "#ffffff",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: "600",
                        },
                      },
                      "安排：关闭 DSH 后自动对齐"
                    )
                  )
                )
              : null,

            pullSchedule?.scheduled
              ? h(
                  "div",
                  {
                    style: {
                      padding: "16px 20px",
                      borderRadius: "12px",
                      border: `1px solid ${themeStyles.statusGoodBorder}`,
                      background: themeStyles.statusGoodBg,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "16px",
                    },
                  },
                  h(
                    "div",
                    { style: { fontSize: "13px", lineHeight: "1.6" } },
                    h("strong", { style: { color: themeStyles.statusGoodText } }, "🕒 已安排：关闭 DSH 后自动对齐"),
                    h("br"),
                    `关闭 DSH 后，后台会把本机对齐到基线 ${String(pullSchedule.task?.baseline || "").split(/[\\/]/).pop()}，成功后自动重新打开 DSH。`,
                    h("br"),
                    `等待截止：${pullSchedule.task?.deadline || "-"}（之后自动放弃） · 日志：`,
                    h("code", { style: { fontSize: "12px" } }, pullSchedule.task?.logPath || "-")
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      onClick: handlePullCancel,
                      disabled: actionLoading,
                      className: "dsh-action-btn",
                      style: {
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: `1px solid ${themeStyles.cardBorder}`,
                        background: themeStyles.btnSecondaryBg,
                        color: themeStyles.btnSecondaryText,
                        cursor: "pointer",
                        fontSize: "13px",
                        flexShrink: 0,
                      },
                    },
                    "取消安排"
                  )
                )
              : null,

            !pullSchedule?.scheduled && pullSchedule?.last
              ? h(
                  "div",
                  {
                    style: {
                      fontSize: "12px",
                      color:
                        pullSchedule.last.result === "failed" ? themeStyles.statusWarnText : themeStyles.textSecondary,
                    },
                  },
                  `上次自动对齐：${
                    {
                      success: "成功",
                      failed: "失败（DSH 未自动重开）",
                      timeout: "超时未关闭 DSH，已放弃",
                      cancelled: "已取消",
                    }[pullSchedule.last.result] || pullSchedule.last.result
                  }（${pullSchedule.last.finishedAt || ""}） · 日志：`,
                  h("code", null, pullSchedule.last.logPath || "-")
                )
              : null,

            pullSchedule && pullSchedule.ok === false
              ? h(
                  "div",
                  { style: { fontSize: "12px", color: themeStyles.statusWarnText } },
                  `无法查询自动对齐状态：${pullSchedule.error || "未知错误"}（同步脚本可能尚未更新到支持 -Schedule 的版本）`
                )
              : null,

            // 控制台输出展示卡片
            h(
              "div",
              {
                style: {
                  background: isDark ? "#090d13" : "#1e293b",
                  color: "#f8fafc",
                  borderRadius: "14px",
                  padding: "16px 20px",
                  fontFamily: "Consolas, 'Cascadia Code', monospace",
                  fontSize: "12px",
                  lineHeight: "1.6",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#334155"}`,
                  minHeight: "260px",
                  maxHeight: "420px",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.4)",
                },
              },
              consoleOutput || "点击上方按钮比对差异、对齐到中枢或发布本机配置，结果显示在这里..."
            ),

            // 操作说明与指引
            h(
              "div",
              {
                style: {
                  padding: "14px 18px",
                  borderRadius: "10px",
                  background: isDark ? "rgba(255, 255, 255, 0.04)" : "#f1f5f9",
                  fontSize: "13px",
                  color: themeStyles.textSecondary,
                  lineHeight: "1.6",
                },
              },
              h("strong", { style: { color: themeStyles.textPrimary } }, "💡 换机与同步 SOP："),
              h("br"),
              "1. 本地基线调试：在当前 PC 调好插件或配置后，点击「💾 固化为基线」，安全脱敏保存到本地工作区；",
              h("br"),
              "2. 跨机协同推送：确认本地中枢状态良好后，点击「🚀 推送到 GitHub」，把最新规则、技能与宿主基线推向远端；",
              h("br"),
              "3. 另一台 PC 接入：点击「☁️ 从 GitHub 拉取」，再点击「⬇️ 对齐到中枢」完成关闭 DSH 后的自动热复位；DSH 未启动时用根目录「跨机中枢同步.bat」离线对齐。"
            )
          ),

        // ==========================================
        // TAB 3: 外观与快捷工具
        // ==========================================
        activeTab === "tools" &&
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "20px" } },
            h(
              "div",
              {
                style: {
                  background: themeStyles.cardBg,
                  borderRadius: "14px",
                  border: `1px solid ${themeStyles.cardBorder}`,
                  padding: "20px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                },
              },
              h(
                "div",
                null,
                h("h3", { style: { margin: "0 0 6px 0", fontSize: "16px", fontWeight: "600" } }, "浅色 / 深色外观快捷切换"),
                h(
                  "p",
                  { style: { margin: 0, fontSize: "13px", color: themeStyles.textSecondary } },
                  `当前模式: ${isDark ? "深色暗调模式 (Dark)" : "浅色明亮模式 (Light)"} · 全局快捷键: Ctrl + Shift + L`
                )
              ),
              h(
                "button",
                {
                  type: "button",
                  onClick: toggleTheme,
                  className: "dsh-action-btn",
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 20px",
                    borderRadius: "10px",
                    border: "none",
                    background: isDark ? "#fbbf24" : "#1e293b",
                    color: isDark ? "#1e293b" : "#ffffff",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "all 0.15s ease",
                  },
                },
                isDark ? h(SunIcon, { size: 18 }) : h(MoonIcon, { size: 18 }),
                h("span", null, isDark ? "切换为浅色外观" : "切换为深色外观")
              )
            ),

            // Obsidian 资产辅助工具卡片
            h(
              "div",
              {
                style: {
                  background: themeStyles.cardBg,
                  borderRadius: "14px",
                  border: `1px solid ${themeStyles.cardBorder}`,
                  padding: "20px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                },
              },
              h(
                "div",
                null,
                h("h3", { style: { margin: "0 0 6px 0", fontSize: "16px", fontWeight: "600" } }, "Obsidian 共享资产软链对齐"),
                h(
                  "p",
                  { style: { margin: 0, fontSize: "13px", color: themeStyles.textSecondary } },
                  "批量扫描并重建本机 9 个资料库的 12 项共享软链 (relink_all.py --apply)"
                )
              ),
              h(
                "button",
                {
                  type: "button",
                  onClick: handleRelinkObsidian,
                  disabled: actionLoading,
                  className: "dsh-action-btn",
                  style: {
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: `1px solid ${themeStyles.cardBorder}`,
                    background: themeStyles.btnSecondaryBg,
                    color: themeStyles.btnSecondaryText,
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "500",
                  },
                },
                "执行软链对齐"
              )
            )
          )
      );
    }

    // 侧栏图标组件包装
    function DesktopHubSidebarIcon({ size, active }) {
      return h(HubNavIcon, { size, active });
    }

    return {
      inject: ["slots", "theme"],
      apply(ctx) {
        console.log("[dsh-desktop-hub] Client plugin applying...");

        // 1. 注册左侧导航图标 (sidebar.panellist)
        ctx.slots.inject("sidebar.panellist", () =>
          ctx.slots.register(
            {
              name: "sidebar.panellist",
              id: "desktop-hub",
              order: 6,
              label: () => "桌面与中枢",
            },
            DesktopHubSidebarIcon
          )
        );

        // 2. 注册主面板页面 (main)
        ctx.slots.inject("main", () =>
          ctx.slots.register(
            {
              name: "main",
              key: "desktop-hub",
            },
            (props) => h(DesktopHubPage, { ...props, hostCtx: ctx })
          )
        );

        // 3. 注册会话顶部右侧工具栏外观切换按钮 (底栏已按需移除)
        ctx.slots.inject("conversation.session.header.utilities", () =>
          ctx.slots.register(
            {
              name: "conversation.session.header.utilities",
              id: "desktop-hub-header-theme",
              order: 2,
              label: () => "切换外观",
            },
            (props) => h(HeaderThemeToggle, { ...props, hostCtx: ctx })
          )
        );

        // 4. 注册全局快捷键：Ctrl+Shift+L / Cmd+Shift+L
        if (typeof window !== "undefined") {
          const handleKeydown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === "KeyL" || e.key === "L" || e.key === "l")) {
              e.preventDefault();
              e.stopPropagation();
              const isDark =
                document.body?.hasAttribute("data-ds-dark-theme") ||
                document.documentElement?.getAttribute("data-ds-theme-source") === "dark" ||
                document.documentElement?.style?.colorScheme === "dark";
              const nextMode = isDark ? "light" : "dark";

              document.documentElement.style.colorScheme = nextMode;
              document.documentElement.setAttribute("data-ds-theme-source", nextMode);
              if (nextMode === "dark") {
                document.body?.setAttribute("data-ds-dark-theme", "");
              } else {
                document.body?.removeAttribute("data-ds-dark-theme");
              }

              try {
                ctx?.theme?.setTheme(nextMode);
              } catch (_) {}
            }
          };
          window.addEventListener("keydown", handleKeydown, true);

          ctx.on("dispose", () => {
            window.removeEventListener("keydown", handleKeydown, true);
          });
        }
      },
    };
  },
});
