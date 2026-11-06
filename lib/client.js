window.__ModuleLoader__.load({
  id: "dsh-desktop-hub",
  factory(require) {
    const React = require("react");
    const h = React.createElement;
    const { useState, useEffect, useCallback } = React;

    // --- 图标定义 ---
    function HubSyncNavIcon({ size = 18, active = false }) {
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
        h("circle", { cx: "18", cy: "18", r: "3", fill: fillColor }),
        h("circle", { cx: "6", cy: "6", r: "3", fill: fillColor }),
        h("path", { d: "M13 6h3a2 2 0 0 1 2 2v7" }),
        h("path", { d: "M11 18H8a2 2 0 0 1-2-2V9" }),
        h("polyline", { points: "15 9 18 6 21 9" }),
        h("polyline", { points: "9 15 6 18 3 15" })
      );
    }

    function DesktopSettingsNavIcon({ size = 18, active = false }) {
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
        h("rect", { x: "2", y: "3", width: "20", height: "14", rx: "2", fill: fillColor }),
        h("line", { x1: "8", y1: "21", x2: "16", y2: "21" }),
        h("line", { x1: "12", y1: "17", x2: "12", y2: "21" }),
        h("circle", { cx: "12", cy: "10", r: "2.5" })
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

    async function apiCall(endpoint, method = "GET", body = null) {
      const opts = { method, headers: { "Content-Type": "application/json" } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch("/api/desktop-hub" + endpoint, opts);
      if (!res.ok) {
        let errMsg = "HTTP " + res.status;
        try {
          const data = await res.json();
          if (data?.error) errMsg = data.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      return await res.json();
    }

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
        if (typeof MutationObserver === "undefined") return;
        const observer = new MutationObserver(() => setIsDark(checkIsDark()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-ds-theme-source"] });
        if (document.body) {
          observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
        }
        return () => observer.disconnect();
      }, []);

      const toggleTheme = useCallback(async () => {
        const nextIsDark = !isDark;
        setIsDark(nextIsDark);
        const scheme = nextIsDark ? "dark" : "light";
        document.documentElement.style.colorScheme = scheme;
        document.documentElement.setAttribute("data-ds-theme-source", scheme);
        if (document.body) {
          if (nextIsDark) document.body.setAttribute("data-ds-dark-theme", "true");
          else document.body.removeAttribute("data-ds-dark-theme");
        }
        try {
          if (ctx?.theme?.setTheme) ctx.theme.setTheme(nextIsDark ? "dark" : "light");
          else if (ctx?.theme?.toggle) ctx.theme.toggle();
        } catch (_) {}
      }, [isDark, ctx]);

      return { isDark, toggleTheme };
    }

    function SidebarFooterThemeToggle({ hostCtx }) {
      const { isDark, toggleTheme } = useCurrentTheme(hostCtx);
      const [hovered, setHovered] = useState(false);
      const [visible, setVisible] = useState(() => {
        if (typeof localStorage === "undefined") return true;
        return localStorage.getItem("dsh_sidebar_theme_btn_visible") !== "false";
      });

      useEffect(() => {
        const handleStorage = () => {
          setVisible(localStorage.getItem("dsh_sidebar_theme_btn_visible") !== "false");
        };
        window.addEventListener("dsh-hub-settings-changed", handleStorage);
        return () => window.removeEventListener("dsh-hub-settings-changed", handleStorage);
      }, []);

      if (!visible) return null;
      const titleText = isDark ? "切换为浅色外观" : "切换为深色外观";

      return h(
        "button",
        {
          type: "button",
          onClick: (e) => { e.stopPropagation(); toggleTheme(); },
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
          title: titleText,
          "aria-label": titleText,
          style: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            padding: "0",
            border: "none",
            borderRadius: "6px",
            background: hovered ? "var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.15))" : "transparent",
            color: hovered ? "var(--dsw-alias-label-primary, currentColor)" : "var(--dsw-alias-label-secondary, currentColor)",
            cursor: "pointer",
            outline: "none",
            flexShrink: 0,
          },
        },
        isDark ? h(SunIcon, { size: 15 }) : h(MoonIcon, { size: 15 })
      );
    }

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
        h("defs", null,
          h("marker", { id: "arrowDsh", markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto" }, h("polygon", { points: "0 0, 6 3, 0 6", fill: dshColor })),
          h("marker", { id: "arrowClaude", markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto" }, h("polygon", { points: "0 0, 6 3, 0 6", fill: claudeColor })),
          h("marker", { id: "arrowDoc", markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto" }, h("polygon", { points: "0 0, 6 3, 0 6", fill: docColor })),
          h("marker", { id: "arrowHub", markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto" }, h("polygon", { points: "0 0, 6 3, 0 6", fill: hubColor })),
          h("marker", { id: "arrowGit", markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto" }, h("polygon", { points: "0 0, 6 3, 0 6", fill: gitColor }))
        ),
        h("text", { x: "480", y: "36", textAnchor: "middle", fill: textMain, fontSize: "16", fontWeight: "700" }, "AgentWorkspace 双核与双机中枢架构全景"),
        h("text", { x: "480", y: "56", textAnchor: "middle", fill: textMuted, fontSize: "11" }, "单机多 Agent 平等分工  |  跨机唯一事实源中枢  |  原生语义与零符号链接"),
        h("rect", { x: "28", y: "76", width: "420", height: "418", rx: "10", fill: cardBg, stroke: border, strokeWidth: "1" }),
        h("rect", { x: "28", y: "76", width: "420", height: "30", rx: "10", fill: isDark ? "rgba(2, 132, 199, 0.12)" : "rgba(2, 132, 199, 0.08)" }),
        h("text", { x: "42", y: "96", fill: dshColor, fontSize: "12", fontWeight: "700" }, "单机双主力分工：DSH 中控 + Claude 编码"),
        h("rect", { x: "46", y: "118", width: "180", height: "96", rx: "8", fill: isDark ? "#111827" : "#ffffff", stroke: dshColor, strokeWidth: "1.5" }),
        h("text", { x: "58", y: "138", fill: dshColor, fontSize: "12", fontWeight: "700" }, "DSH (DeepSeek Harness)"),
        h("text", { x: "58", y: "156", fill: textMain, fontSize: "10.5" }, "角色：日常入口、中控编排"),
        h("text", { x: "58", y: "172", fill: textMuted, fontSize: "9.5" }, "加载：~/.dsh/AGENTS.md"),
        h("text", { x: "58", y: "188", fill: textMuted, fontSize: "9.5" }, "底座：Cordis + pnpm profiles"),
        h("rect", { x: "250", y: "118", width: "180", height: "96", rx: "8", fill: isDark ? "#111827" : "#ffffff", stroke: claudeColor, strokeWidth: "1.5" }),
        h("text", { x: "262", y: "138", fill: claudeColor, fontSize: "12", fontWeight: "700" }, "Claude Code / Desktop"),
        h("text", { x: "262", y: "156", fill: textMain, fontSize: "10.5" }, "角色：代码工程、大上下文分析"),
        h("text", { x: "262", y: "172", fill: textMuted, fontSize: "9.5" }, "加载：~/.claude/CLAUDE.md"),
        h("text", { x: "262", y: "188", fill: textMuted, fontSize: "9.5" }, "底座：官方 CLI + Desktop Code"),
        h("rect", { x: "46", y: "228", width: "384", height: "136", rx: "8", fill: isDark ? "rgba(16, 185, 129, 0.06)" : "#f0fdf4", stroke: docColor, strokeWidth: "1" }),
        h("text", { x: "58", y: "248", fill: docColor, fontSize: "11.5", fontWeight: "700" }, "单一事实源（Single Source of Truth）"),
        h("text", { x: "58", y: "268", fill: textMain, fontSize: "10" }, "docs/ 目录作为各 Agent 行为规范的权威定义层"),
        h("text", { x: "58", y: "286", fill: textMuted, fontSize: "9.5" }, "- DSH 独立规则正文：docs/agent-config/dsh/AGENTS.md"),
        h("text", { x: "58", y: "302", fill: textMuted, fontSize: "9.5" }, "- Claude 独立规则正文：docs/agent-config/claude/CLAUDE.md"),
        h("text", { x: "58", y: "318", fill: textMuted, fontSize: "9.5" }, "- 学术写作与通用技能：skills/ 目录集中托管与演进"),
        h("rect", { x: "46", y: "378", width: "384", height: "100", rx: "8", fill: isDark ? "#111827" : "#ffffff", stroke: border, strokeWidth: "1" }),
        h("text", { x: "58", y: "398", fill: textMain, fontSize: "11", fontWeight: "700" }, "Codex / AntiGravity（维持现状）"),
        h("text", { x: "58", y: "418", fill: textMuted, fontSize: "9.5" }, "- Codex：~/.codex/ 薄入口按需引导，不主动修改"),
        h("text", { x: "58", y: "434", fill: textMuted, fontSize: "9.5" }, "- AntiGravity：~/.gemini/ include 导入维持现状"),
        h("text", { x: "58", y: "450", fill: textMuted, fontSize: "9.5" }, "- 原生加载语义隔离，互不覆写、互不绑定"),
        h("rect", { x: "472", y: "76", width: "460", height: "418", rx: "10", fill: cardBg, stroke: border, strokeWidth: "1" }),
        h("rect", { x: "472", y: "76", width: "460", height: "30", rx: "10", fill: isDark ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.08)" }),
        h("text", { x: "486", y: "96", fill: hubColor, fontSize: "12", fontWeight: "700" }, "跨机对齐：AgentWorkspace 权威基线"),
        h("rect", { x: "510", y: "118", width: "170", height: "82", rx: "8", fill: isDark ? "#111827" : "#ffffff", stroke: "#38bdf8", strokeWidth: "1.5" }),
        h("text", { x: "522", y: "138", fill: "#38bdf8", fontSize: "12", fontWeight: "700" }, "cxwork"),
        h("text", { x: "522", y: "154", fill: textMain, fontSize: "10.5" }, "便携工作站 (Client A)"),
        h("text", { x: "522", y: "170", fill: textMuted, fontSize: "9.5" }, "环境：FlClash 代理 / 离线批处理"),
        h("rect", { x: "732", y: "118", width: "170", height: "82", rx: "8", fill: isDark ? "#111827" : "#ffffff", stroke: "#38bdf8", strokeWidth: "1.5" }),
        h("text", { x: "744", y: "138", fill: "#38bdf8", fontSize: "12", fontWeight: "700" }, "STATION-P920"),
        h("text", { x: "744", y: "154", fill: textMain, fontSize: "10.5" }, "工控与计算站 (Client B)"),
        h("text", { x: "744", y: "170", fill: textMuted, fontSize: "9.5" }, "环境：Magpie 网关 / 多显卡加速"),
        h("rect", { x: "510", y: "240", width: "392", height: "136", rx: "10", fill: hubBg, stroke: hubColor, strokeWidth: "2" }),
        h("text", { x: "526", y: "264", fill: hubColor, fontSize: "13", fontWeight: "700" }, "AgentWorkspace 本地中枢 (C:\\\\AgentWorkspace)"),
        h("text", { x: "526", y: "284", fill: textMain, fontSize: "10.5" }, "deploy/dsh/baselines/ (标准基线清单与补丁)"),
        h("text", { x: "526", y: "302", fill: textMuted, fontSize: "9.5" }, "- 插件清单 package.json + pnpm-lock.yaml 严格锁版"),
        h("text", { x: "526", y: "318", fill: textMuted, fontSize: "9.5" }, "- cordis.patch.yml 标准配置（自动隔离 Magpie 等本地项）"),
        h("text", { x: "526", y: "334", fill: textMuted, fontSize: "9.5" }, "- vendor/ 本地 PR 源码补丁（如 dsh-agy）统一随中枢分发"),
        h("text", { x: "526", y: "350", fill: textMuted, fontSize: "9.5" }, "- dsh-profile-sync.ps1 双向同步引擎与自愈验证"),
        h("rect", { x: "510", y: "418", width: "392", height: "60", rx: "8", fill: isDark ? "#111827" : "#ffffff", stroke: gitColor, strokeWidth: "1.5" }),
        h("text", { x: "526", y: "438", fill: gitColor, fontSize: "11.5", fontWeight: "700" }, "GitHub 私有云端仓库 (Gavin-ZCX/AgentWorkspace)"),
        h("text", { x: "526", y: "456", fill: textMuted, fontSize: "9.5" }, "跨机对齐通道：全量暂存工作区资产 (git add -A)，绝无凭据与会话泄露")
      );
    }

    function getThemeStyles(isDark) {
      return {
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
    }

    const COMMON_CSS = `
      @keyframes dshHubSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes dshHubFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .dsh-action-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
      .dsh-action-btn:active { transform: translateY(0); }

      .dsh-hub-main {
        width: 100%;
        max-width: 1020px;
        margin: 0 auto;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      }

      .dsh-hub-card {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        gap: 16px !important;
        box-sizing: border-box !important;
        transition: all 0.2s ease !important;
      }

      .dsh-hub-card-body {
        flex: 1 1 340px !important;
        min-width: 0 !important;
      }

      .dsh-hub-card-actions {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        flex-wrap: wrap !important;
        flex-shrink: 0 !important;
        justify-content: flex-end !important;
      }

      @media (max-width: 940px) {
        .dsh-hub-root { padding: 20px 24px !important; }
        .dsh-hub-card { padding: 16px 20px !important; gap: 14px !important; }
        .dsh-hub-card-actions { justify-content: flex-start !important; }
      }

      @media (max-width: 800px) {
        .dsh-hub-root { padding: 14px 16px !important; }
        .dsh-hub-header { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
        .dsh-hub-card { flex-direction: column !important; align-items: stretch !important; gap: 14px !important; padding: 16px 16px !important; }
        .dsh-hub-card-body { width: 100% !important; max-width: 100% !important; flex: none !important; }
        .dsh-hub-card-actions { width: 100% !important; justify-content: flex-start !important; margin-top: 2px !important; }
        .dsh-hub-card-actions > button { flex: 0 1 auto; }
      }

      @media (max-width: 600px) {
        .dsh-hub-card-actions > button { flex: 1 1 100%; text-align: center; justify-content: center; }
      }
    `;

    function SyncPage({ hostCtx }) {
      const { isDark } = useCurrentTheme(hostCtx);
      const themeStyles = getThemeStyles(isDark);

      const [loading, setLoading] = useState(true);
      const [status, setStatus] = useState(null);
      const [repoStatus, setRepoStatus] = useState(null);
      const [actionLoading, setActionLoading] = useState(false);
      const [consoleOutput, setConsoleOutput] = useState("");
      const [toast, setToast] = useState(null);
      const [pullPlanReady, setPullPlanReady] = useState(false);
      const [pullSchedule, setPullSchedule] = useState(null);
      const [showAdvanced, setShowAdvanced] = useState(false);

      const showToast = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
      };

      const fetchStatus = useCallback(async () => {
        try {
          setLoading(true);
          const res = await apiCall("/status");
          if (res.ok) setStatus(res);
        } catch (err) {
          showToast("获取状态失败: " + err.message, "error");
        } finally {
          setLoading(false);
        }
      }, []);

      const fetchRepoStatus = useCallback(async () => {
        try {
          const res = await apiCall("/sync/repo-status");
          setRepoStatus(res);
        } catch (err) {
          setRepoStatus({ ok: false, error: err.message });
        }
      }, []);

      const fetchPullSchedule = useCallback(async () => {
        try {
          const res = await apiCall("/sync/pull-schedule");
          setPullSchedule(res.ok ? res : { ok: false, error: res.error });
        } catch (err) {
          setPullSchedule({ ok: false, error: err.message });
        }
      }, []);

      useEffect(() => {
        fetchStatus();
        fetchRepoStatus();
        fetchPullSchedule();
      }, [fetchStatus, fetchRepoStatus, fetchPullSchedule]);

      const handleRunDiff = async () => {
        try {
          setActionLoading(true);
          setConsoleOutput("正在比对云端中枢、本地工作区与 DSH 运行时差异 (Diff)...\n");
          const res = await apiCall("/sync/diff", "POST");
          setConsoleOutput(res.output || "无输出");
          showToast(res.ok ? "差异比对完成" : "比对未完成，详见日志", res.ok ? "success" : "error");
          await fetchRepoStatus();
        } catch (err) {
          setConsoleOutput("执行失败: " + err.message);
          showToast("比对失败: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      const handleOneClickPublish = async () => {
        if (!confirm("【全量推送到云端 (Push)】\n\n流向：本机 DSH 运行时 ➔ 本地工作区 ➔ 云端中枢\n\n将依次自动完成：\n1. 将本机调好的 DSH 插件与配置提炼固化到本地基线\n2. 全量暂存并提交本地工作区内所有资产（规则/技能/脚本/基线）\n3. 推送到 GitHub 远端私有仓库\n\n是否立即执行？")) {
          return;
        }
        try {
          setActionLoading(true);
          setConsoleOutput("正在执行全量发布 (固化基线 -> 全量 Git 暂存提交 -> 推送云端)...\n");
          const resSave = await apiCall("/sync/save-baseline", "POST");
          if (!resSave.ok) {
            showToast("本地固化基线未完成，已中止推送", "error");
            setConsoleOutput(resSave.output || "固化失败");
            return;
          }
          const resPush = await apiCall("/sync/git-push", "POST");
          setConsoleOutput((resSave.output || "") + "\n\n" + (resPush.output || ""));
          showToast(resPush.ok ? "已全量提交并推送到 GitHub！" : "推送未完成，详见日志", resPush.ok ? "success" : "error");
          await fetchRepoStatus();
          await fetchStatus();
        } catch (err) {
          setConsoleOutput("执行异常: " + err.message);
          showToast("发布异常: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      const handleOneClickSync = async () => {
        if (!confirm("【从云端拉取并对齐 (Pull)】\n\n流向：云端中枢 ➔ 本地工作区 ➔ 本机 DSH 运行时\n\n将依次自动完成：\n1. 从 GitHub 拉取远程最新工作区改动 (Git Pull)\n2. 自动优雅关闭 DSH 释放文件锁并应用对齐 (-Apply)\n3. 对齐完成后自动重新唤起打开 DSH\n\n是否立即执行？")) {
          return;
        }
        try {
          setActionLoading(true);
          setConsoleOutput("正在执行一键从云端拉取并重启对齐...\n");
          const res = await apiCall("/sync/auto-sync", "POST");
          if (res.ok) {
            showToast("已安排自动对齐，DSH 即将重启...", "success");
            setConsoleOutput((prev) => prev + "\n[Git Pull 成功]\n" + (res.pullOutput || "") + "\n\n正在关闭 DSH 进行热复位...");
          } else {
            showToast("一键对齐失败: " + (res.error || "未知错误"), "error");
            setConsoleOutput((prev) => prev + "\n[一键对齐失败]\n" + (res.error || ""));
          }
        } catch (err) {
          showToast("执行异常: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      const handleSaveBaselineOnly = async () => {
        try {
          setActionLoading(true);
          setConsoleOutput("正在仅将本机 DSH 运行时固化为本地基线 (不联网、不提交)...\n");
          const res = await apiCall("/sync/save-baseline", "POST");
          setConsoleOutput(res.output || "无输出");
          showToast(res.ok ? "本地基线固化完成" : "固化未完成", res.ok ? "success" : "error");
          await fetchRepoStatus();
        } catch (err) {
          setConsoleOutput("固化失败: " + err.message);
        } finally {
          setActionLoading(false);
        }
      };

      const handleGitPullOnly = async () => {
        try {
          setActionLoading(true);
          setConsoleOutput("正在仅从 GitHub 拉取工作区最新提交 (不动 ~/.dsh)...\n");
          const res = await apiCall("/sync/git-pull", "POST");
          setConsoleOutput(res.output || "无输出");
          showToast(res.ok ? "Git Pull 完成" : "拉取未完成", res.ok ? "success" : "error");
          await fetchRepoStatus();
        } catch (err) {
          setConsoleOutput("拉取失败: " + err.message);
        } finally {
          setActionLoading(false);
        }
      };

      const handleGitPushOnly = async () => {
        try {
          setActionLoading(true);
          setConsoleOutput("正在全量暂存工作区改动并推送到 GitHub...\n");
          const res = await apiCall("/sync/git-push", "POST");
          setConsoleOutput(res.output || "无输出");
          showToast(res.ok ? "全量推送完成" : "推送未完成", res.ok ? "success" : "error");
          await fetchRepoStatus();
        } catch (err) {
          setConsoleOutput("推送失败: " + err.message);
        } finally {
          setActionLoading(false);
        }
      };

      const handlePullPlan = async () => {
        try {
          setActionLoading(true);
          setPullPlanReady(false);
          setConsoleOutput("正在生成对齐计划 (只预演，不写入)...\n");
          const res = await apiCall("/sync/pull-plan", "POST");
          setConsoleOutput(res.output || "无输出");
          if (res.ok) {
            setPullPlanReady(true);
            showToast("对齐计划已生成，请在下方确认", "success");
          } else {
            showToast("计划检查未通过", "error");
          }
        } catch (err) {
          setConsoleOutput("生成计划失败: " + err.message);
        } finally {
          setActionLoading(false);
        }
      };

      const handlePullSchedule = async () => {
        try {
          setActionLoading(true);
          const res = await apiCall("/sync/pull-schedule", "POST", { closeDsh: true });
          if (res.ok) {
            setPullPlanReady(false);
            setPullSchedule(res);
            showToast("正在自动关闭 DSH 进行对齐...", "success");
          } else {
            showToast("安排失败: " + (res.error || "未知错误"), "error");
          }
        } catch (err) {
          showToast("安排失败: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      const handlePullCancel = async () => {
        try {
          setActionLoading(true);
          const res = await apiCall("/sync/pull-cancel", "POST");
          showToast(res.ok ? "已取消自动对齐" : "取消失败", res.ok ? "success" : "error");
        } catch (err) {
          showToast("取消失败: " + err.message, "error");
        } finally {
          await fetchPullSchedule();
          setActionLoading(false);
        }
      };

      return h(
        "div",
        {
          className: "dsh-hub-root",
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
        h("style", null, COMMON_CSS),
        toast ? h("div", {
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
        }, h("span", null, toast.type === "error" ? "⚠️" : "✅"), h("span", null, toast.msg)) : null,
        h(
          "div",
          { className: "dsh-hub-main" },
          h(
            "div",
            {
              className: "dsh-hub-header",
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "20px",
                paddingBottom: "16px",
                borderBottom: "1px solid " + themeStyles.cardBorder,
                flexWrap: "wrap",
                gap: "12px",
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
                h(HubSyncNavIcon, { size: 24, active: true })
              ),
              h(
                "div",
                null,
                h("h1", { style: { margin: "0 0 4px 0", fontSize: "22px", fontWeight: "600", color: themeStyles.textPrimary } }, "跨机中枢同步管理"),
                h("p", { style: { margin: 0, fontSize: "13px", color: themeStyles.textSecondary } }, "在活体运行时、本地工作区与云端 GitHub 之间双向全量对齐中枢资产")
              )
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "10px" } },
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
                    border: "1px solid " + themeStyles.cardBorder,
                    fontSize: "12px",
                    color: themeStyles.textSecondary,
                  },
                },
                h("span", null, "主机:"),
                h("strong", { style: { color: themeStyles.textPrimary, textTransform: "uppercase" } }, status?.hostname || "检测中...")
              ),
              h(
                "span",
                {
                  style: {
                    fontSize: "11px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontWeight: "600",
                    background: !repoStatus ? "transparent" : (repoStatus.behind > 0 || repoStatus.ahead > 0) ? themeStyles.statusWarnBg : (isDark ? "rgba(16, 185, 129, 0.12)" : "#ecfdf5"),
                    color: !repoStatus ? themeStyles.textSecondary : (repoStatus.behind > 0 || repoStatus.ahead > 0) ? themeStyles.statusWarnText : (isDark ? "#34d399" : "#059669"),
                    border: "1px solid " + (!repoStatus ? "transparent" : (repoStatus.behind > 0 || repoStatus.ahead > 0) ? themeStyles.statusWarnBorder : (isDark ? "rgba(16, 185, 129, 0.25)" : "#a7f3d0")),
                  },
                },
                !repoStatus ? "检查中..." : repoStatus.ok === false ? "未联网" : repoStatus.behind > 0 ? ("云端领先 " + repoStatus.behind + " 提交") : repoStatus.ahead > 0 ? ("本地领先 " + repoStatus.ahead + " 提交") : "云端已同步"
              ),
              h(
                "button",
                {
                  type: "button",
                  onClick: handleRunDiff,
                  disabled: actionLoading,
                  className: "dsh-action-btn",
                  title: "检查本地基线与云端工作区差异",
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    background: themeStyles.btnSecondaryBg,
                    color: themeStyles.btnSecondaryText,
                    border: "1px solid " + themeStyles.cardBorder,
                    cursor: "pointer",
                    fontSize: "13px",
                  },
                },
                h(RefreshIcon, { size: 14, spinning: actionLoading }),
                h("span", null, "差异检查 (Diff)")
              )
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "16px" } },
            h(
              "div",
              {
                className: "dsh-hub-card",
                style: {
                  background: isDark ? "rgba(30, 41, 59, 0.7)" : "#f1f5f9",
                  borderRadius: "14px",
                  border: "1px solid " + (isDark ? "rgba(2, 132, 199, 0.35)" : "#cbd5e1"),
                  padding: "18px 24px",
                  boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.04)",
                },
              },
              h(
                "div",
                { className: "dsh-hub-card-body" },
                h("h3", { style: { margin: "0 0 6px 0", fontSize: "16px", fontWeight: "700", color: isDark ? "#38bdf8" : "#0284c7" } }, "🚀 全量推送到云端 (Push)"),
                h("p", { style: { margin: 0, fontSize: "13px", color: themeStyles.textSecondary, lineHeight: "1.5" } }, "流向：本机 DSH 运行时 ➔ 本地工作区 ➔ 云端中枢。自动提炼当前插件配置固化为基线，并将整个工作区内所有改动全量推送到 GitHub 远端。")
              ),
              h(
                "div",
                { className: "dsh-hub-card-actions" },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handleOneClickPublish,
                    disabled: actionLoading,
                    className: "dsh-action-btn",
                    style: {
                      padding: "10px 22px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                      color: "#ffffff",
                      cursor: "pointer",
                      fontSize: "13.5px",
                      fontWeight: "600",
                      boxShadow: "0 2px 8px rgba(2, 132, 199, 0.35)",
                    },
                  },
                  "⚡ 固化并全量推送到 GitHub"
                )
              )
            ),
            h(
              "div",
              {
                className: "dsh-hub-card",
                style: {
                  background: isDark ? "rgba(30, 41, 59, 0.7)" : "#f1f5f9",
                  borderRadius: "14px",
                  border: "1px solid " + (isDark ? "rgba(99, 102, 241, 0.35)" : "#cbd5e1"),
                  padding: "18px 24px",
                  boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.04)",
                },
              },
              h(
                "div",
                { className: "dsh-hub-card-body" },
                h("h3", { style: { margin: "0 0 6px 0", fontSize: "16px", fontWeight: "700", color: isDark ? "#c7d2fe" : "#3730a3" } }, "🔄 从云端拉取并对齐 (Pull)"),
                h("p", { style: { margin: 0, fontSize: "13px", color: themeStyles.textSecondary, lineHeight: "1.5" } }, "流向：云端中枢 ➔ 本地工作区 ➔ 本机 DSH 运行时。从 GitHub 拉取工作区最新改动，随后自动安全关闭 DSH、后台静默安装插件对齐基线，并自动重新打开。")
              ),
              h(
                "div",
                { className: "dsh-hub-card-actions" },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handleOneClickSync,
                    disabled: actionLoading || Boolean(pullSchedule && pullSchedule.scheduled),
                    className: "dsh-action-btn",
                    style: {
                      padding: "10px 22px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      color: "#ffffff",
                      cursor: (pullSchedule && pullSchedule.scheduled) ? "not-allowed" : "pointer",
                      opacity: (pullSchedule && pullSchedule.scheduled) ? 0.6 : 1,
                      fontSize: "13.5px",
                      fontWeight: "600",
                      boxShadow: "0 2px 8px rgba(99, 102, 241, 0.35)",
                    },
                  },
                  (pullSchedule && pullSchedule.scheduled) ? "🕒 已安排对齐" : "⬇️ 一键拉取并自动重启对齐"
                )
              )
            ),
            pullPlanReady && !pullSchedule?.scheduled ? h(
              "div",
              {
                className: "dsh-hub-card",
                style: {
                  padding: "16px 20px",
                  borderRadius: "12px",
                  border: "1px solid " + themeStyles.statusWarnBorder,
                  background: themeStyles.statusWarnBg,
                },
              },
              h(
                "div",
                { className: "dsh-hub-card-body", style: { fontSize: "13px", lineHeight: "1.6" } },
                h("strong", { style: { color: themeStyles.statusWarnText } }, "确认按下方黑框中的计划对齐本机？"),
                h("br"),
                "对齐将覆盖本机配置并自动更新插件依赖。确认后后台将安排在关闭 DSH 后执行并自动重启恢复工作台。"
              ),
              h(
                "div",
                { className: "dsh-hub-card-actions", style: { display: "flex", gap: "8px" } },
                h("button", { type: "button", onClick: () => setPullPlanReady(false), className: "dsh-action-btn", style: { padding: "8px 14px", borderRadius: "8px", border: "1px solid " + themeStyles.cardBorder, background: themeStyles.btnSecondaryBg, color: themeStyles.btnSecondaryText, cursor: "pointer", fontSize: "13px" } }, "不用了"),
                h("button", { type: "button", onClick: handlePullSchedule, className: "dsh-action-btn", style: { padding: "8px 16px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#ffffff", cursor: "pointer", fontSize: "13px", fontWeight: "600" } }, "确认并关闭 DSH 对齐")
              )
            ) : null,
            pullSchedule?.scheduled ? h(
              "div",
              {
                className: "dsh-hub-card",
                style: {
                  padding: "16px 20px",
                  borderRadius: "12px",
                  border: "1px solid " + themeStyles.statusGoodBorder,
                  background: themeStyles.statusGoodBg,
                },
              },
              h(
                "div",
                { className: "dsh-hub-card-body", style: { fontSize: "13px", lineHeight: "1.6" } },
                h("strong", { style: { color: themeStyles.statusGoodText } }, "🕒 已安排：关闭 DSH 后自动对齐"),
                h("br"),
                "关闭当前窗口后后台将自动执行基线对齐，成功后重新打开。等待截止：" + (pullSchedule.task?.deadline || "-")
              ),
              h(
                "div",
                { className: "dsh-hub-card-actions" },
                h("button", { type: "button", onClick: handlePullCancel, className: "dsh-action-btn", style: { padding: "8px 16px", borderRadius: "8px", border: "1px solid " + themeStyles.cardBorder, background: themeStyles.btnSecondaryBg, color: themeStyles.btnSecondaryText, cursor: "pointer", fontSize: "13px" } }, "取消安排")
              )
            ) : null,
            h(
              "div",
              {
                style: {
                  background: themeStyles.cardBg,
                  borderRadius: "12px",
                  border: "1px solid " + themeStyles.cardBorder,
                  padding: "14px 20px",
                },
              },
              h(
                "div",
                {
                  onClick: () => setShowAdvanced(!showAdvanced),
                  style: { display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" },
                },
                h("span", { style: { fontSize: "13.5px", fontWeight: "600", color: themeStyles.textSecondary } }, "⚙️ 高级细分操作 (按需排障 / 离线分步)"),
                h("span", { style: { fontSize: "12px", color: themeStyles.textSecondary } }, showAdvanced ? "收起 ▲" : "展开 ▼")
              ),
              showAdvanced ? h(
                "div",
                { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px", paddingTop: "14px", borderTop: "1px solid " + themeStyles.cardBorder } },
                h("button", { type: "button", onClick: handleSaveBaselineOnly, disabled: actionLoading, className: "dsh-action-btn", style: { padding: "6px 12px", borderRadius: "6px", border: "1px solid " + themeStyles.cardBorder, background: themeStyles.btnSecondaryBg, color: themeStyles.btnSecondaryText, cursor: "pointer", fontSize: "12px" } }, "💾 仅固化为基线 (SaveBaseline)"),
                h("button", { type: "button", onClick: handleGitPullOnly, disabled: actionLoading, className: "dsh-action-btn", style: { padding: "6px 12px", borderRadius: "6px", border: "1px solid " + themeStyles.cardBorder, background: themeStyles.btnSecondaryBg, color: themeStyles.btnSecondaryText, cursor: "pointer", fontSize: "12px" } }, "☁️ 仅拉取仓库 (GitPull)"),
                h("button", { type: "button", onClick: handleGitPushOnly, disabled: actionLoading, className: "dsh-action-btn", style: { padding: "6px 12px", borderRadius: "6px", border: "1px solid " + themeStyles.cardBorder, background: themeStyles.btnSecondaryBg, color: themeStyles.btnSecondaryText, cursor: "pointer", fontSize: "12px" } }, "🚀 仅推送工作区 (GitPush)"),
                h("button", { type: "button", onClick: handlePullPlan, disabled: actionLoading, className: "dsh-action-btn", style: { padding: "6px 12px", borderRadius: "6px", border: "1px solid " + themeStyles.cardBorder, background: themeStyles.btnSecondaryBg, color: themeStyles.btnSecondaryText, cursor: "pointer", fontSize: "12px" } }, "⬇️ 仅离线对齐计划 (Align)")
              ) : null
            ),
            h(
              "div",
              {
                style: {
                  width: "100%",
                  borderRadius: "10px",
                  border: "1px solid " + (isDark ? "rgba(255,255,255,0.08)" : "#cbd5e1"),
                  background: isDark ? "#090d13" : "#f8fafc",
                  overflow: "hidden",
                  boxSizing: "border-box",
                },
              },
              h(
                "div",
                {
                  style: {
                    height: "28px",
                    padding: "0 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid " + (isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0"),
                    background: isDark ? "rgba(255,255,255,0.02)" : "#f1f5f9",
                    fontSize: "11px",
                    color: themeStyles.textSecondary,
                  },
                },
                h("span", { style: { fontWeight: "600", color: isDark ? "#94a3b8" : "#475569" } }, "📋 同步终端日志"),
                h("span", null, pullSchedule?.last ? ("上次对齐: " + (pullSchedule.last.result === "failed" ? "失败" : "成功") + " (" + (pullSchedule.last.finishedAt || "") + ")") : "对齐就绪")
              ),
              h(
                "div",
                {
                  style: {
                    color: isDark ? "#f1f5f9" : "#1e293b",
                    padding: "10px 14px",
                    fontFamily: "Consolas, 'Cascadia Code', monospace",
                    fontSize: "12px",
                    lineHeight: "1.5",
                    minHeight: "85px",
                    maxHeight: "180px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                  },
                },
                consoleOutput || "点击上方按钮比对差异、拉取对齐或全量发布，脚本与 Git 输出显示在这里..."
              )
            ),
            h(
              "div",
              {
                style: {
                  padding: "16px 20px",
                  borderRadius: "12px",
                  background: themeStyles.cardBg,
                  border: "1px solid " + themeStyles.cardBorder,
                },
              },
              h(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" } },
                h("h3", { style: { margin: 0, fontSize: "14px", fontWeight: "600" } }, "🏛️ AgentWorkspace 双核与双机中枢架构全景"),
                h("span", { style: { fontSize: "12px", color: themeStyles.textSecondary } }, "以项目文档为单一事实来源 · 规则、技能与基线全维同步")
              ),
              h("div", { style: { maxWidth: "820px", margin: "0 auto" } }, h(ArchitectureOverview, { isDark }))
            )
          )
        )
      );
    }

    function SettingsPage({ hostCtx }) {
      const { isDark, toggleTheme } = useCurrentTheme(hostCtx);
      const themeStyles = getThemeStyles(isDark);

      const [status, setStatus] = useState(null);
      const [actionLoading, setActionLoading] = useState(false);
      const [toast, setToast] = useState(null);
      const [sidebarThemeBtn, setSidebarThemeBtn] = useState(() => {
        if (typeof localStorage === "undefined") return true;
        return localStorage.getItem("dsh_sidebar_theme_btn_visible") !== "false";
      });

      const showToast = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
      };

      const fetchStatus = useCallback(async () => {
        try {
          const res = await apiCall("/status");
          if (res.ok) setStatus(res);
        } catch (err) {
          showToast("获取状态失败: " + err.message, "error");
        }
      }, []);

      useEffect(() => {
        fetchStatus();
      }, [fetchStatus]);

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
          showToast("操作失败: " + err.message, "error");
        } finally {
          setActionLoading(false);
        }
      };

      const handleToggleSidebarBtn = () => {
        const next = !sidebarThemeBtn;
        setSidebarThemeBtn(next);
        localStorage.setItem("dsh_sidebar_theme_btn_visible", next ? "true" : "false");
        window.dispatchEvent(new Event("dsh-hub-settings-changed"));
        showToast(next ? "已开启侧栏底部外观切换图标" : "已隐藏侧栏底部外观切换图标", "success");
      };

      const isPatched = status?.quitAction?.status === "fully_patched" || status?.quitAction?.status === "patched";

      return h(
        "div",
        {
          className: "dsh-hub-root",
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
        h("style", null, COMMON_CSS),
        toast ? h("div", {
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
        }, h("span", null, toast.type === "error" ? "⚠️" : "✅"), h("span", null, toast.msg)) : null,
        h(
          "div",
          { className: "dsh-hub-main" },
          h(
            "div",
            {
              className: "dsh-hub-header",
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "20px",
                paddingBottom: "16px",
                borderBottom: "1px solid " + themeStyles.cardBorder,
                flexWrap: "wrap",
                gap: "12px",
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
                    background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                  },
                },
                h(DesktopSettingsNavIcon, { size: 24, active: true })
              ),
              h(
                "div",
                null,
                h("h1", { style: { margin: "0 0 4px 0", fontSize: "22px", fontWeight: "600", color: themeStyles.textPrimary } }, "桌面环境与功能设置"),
                h("p", { style: { margin: 0, fontSize: "13px", color: themeStyles.textSecondary } }, "配置当前单机 DSH 客户端的窗口关闭退出行为、外观与界面快捷控件")
              )
            )
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "18px" } },
            h(
              "div",
              {
                className: "dsh-hub-card",
                style: {
                  background: themeStyles.cardBg,
                  borderRadius: "14px",
                  border: "1px solid " + themeStyles.cardBorder,
                  padding: "22px 26px",
                  boxShadow: themeStyles.cardShadow,
                },
              },
              h(
                "div",
                { className: "dsh-hub-card-body" },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" } },
                  h(
                    "span",
                    {
                      style: {
                        padding: "3px 10px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "600",
                        background: isPatched ? themeStyles.statusGoodBg : themeStyles.statusWarnBg,
                        border: "1px solid " + (isPatched ? themeStyles.statusGoodBorder : themeStyles.statusWarnBorder),
                        color: isPatched ? themeStyles.statusGoodText : themeStyles.statusWarnText,
                      },
                    },
                    isPatched ? "已激活：彻底移除托盘 + 直接完全退出" : "当前为：官方默认（托盘后台驻留）"
                  )
                ),
                h("h2", { style: { margin: "0 0 8px 0", fontSize: "17px", fontWeight: "600", color: themeStyles.textPrimary } }, isPatched ? "无托盘驻留，点击右上角 (X) 直接退出" : "点击关闭按钮隐藏至托盘后台驻留"),
                h("p", { style: { margin: 0, fontSize: "13px", lineHeight: "1.6", color: themeStyles.textSecondary } }, isPatched ? "已禁用系统托盘创建，任务栏通知区域干干净净；点击窗口右上角 (X) 时跳过所有阻隔立即平稳退出，完全不存在后台服务残留。" : "官方默认行为：启动时在任务栏右下角常驻托盘图标，点击关闭按钮时窗口仅隐藏至系统托盘，需右键退出。")
              ),
              h(
                "div",
                { className: "dsh-hub-card-actions" },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handleToggleQuitAction,
                    disabled: actionLoading,
                    className: "dsh-action-btn",
                    style: {
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "13.5px",
                      fontWeight: "600",
                      background: isPatched ? (isDark ? "rgba(255,255,255,0.12)" : "#e2e8f0") : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: isPatched ? themeStyles.textPrimary : "#ffffff",
                    },
                  },
                  isPatched ? "恢复为官方托盘驻留" : "彻底移除托盘并直接退出"
                )
              )
            ),
            h(
              "div",
              {
                style: {
                  background: themeStyles.cardBg,
                  borderRadius: "14px",
                  border: "1px solid " + themeStyles.cardBorder,
                  padding: "22px 26px",
                  boxShadow: themeStyles.cardShadow,
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                },
              },
              h("h3", { style: { margin: 0, fontSize: "16px", fontWeight: "600" } }, "🎨 外观模式与界面控件配置"),
              h(
                "div",
                { className: "dsh-hub-card", style: { padding: "12px 16px", borderRadius: "10px", background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc" } },
                h(
                  "div",
                  { className: "dsh-hub-card-body" },
                  h("strong", { style: { fontSize: "14px" } }, "当前外观模式"),
                  h("p", { style: { margin: "2px 0 0 0", fontSize: "12.5px", color: themeStyles.textSecondary } }, isDark ? "深色暗调模式 (Dark Mode)" : "浅色明亮模式 (Light Mode)")
                ),
                h(
                  "div",
                  { className: "dsh-hub-card-actions" },
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
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "none",
                        background: isDark ? "#fbbf24" : "#1e293b",
                        color: isDark ? "#1e293b" : "#ffffff",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "600",
                      },
                    },
                    isDark ? h(SunIcon, { size: 16 }) : h(MoonIcon, { size: 16 }),
                    h("span", null, isDark ? "切换为浅色明亮" : "切换为深色暗调")
                  )
                )
              ),
              h(
                "div",
                { className: "dsh-hub-card", style: { padding: "12px 16px", borderRadius: "10px", background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc" } },
                h(
                  "div",
                  { className: "dsh-hub-card-body" },
                  h("strong", { style: { fontSize: "14px" } }, "侧边栏底部常驻外观图标"),
                  h("p", { style: { margin: "2px 0 0 0", fontSize: "12.5px", color: themeStyles.textSecondary } }, "在左侧导航栏底部的设置图标旁，显示日/月一键切换小按钮")
                ),
                h(
                  "div",
                  { className: "dsh-hub-card-actions" },
                  h(
                    "button",
                    {
                      type: "button",
                      onClick: handleToggleSidebarBtn,
                      className: "dsh-action-btn",
                      style: {
                        padding: "7px 16px",
                        borderRadius: "8px",
                        border: "1px solid " + (sidebarThemeBtn ? "#10b981" : themeStyles.cardBorder),
                        background: sidebarThemeBtn ? (isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5") : themeStyles.btnSecondaryBg,
                        color: sidebarThemeBtn ? (isDark ? "#34d399" : "#059669") : themeStyles.btnSecondaryText,
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "600",
                      },
                    },
                    sidebarThemeBtn ? "已开启显示" : "已隐藏关闭"
                  )
                )
              ),
              h(
                "div",
                { style: { padding: "12px 16px", borderRadius: "10px", background: isDark ? "rgba(255,255,255,0.02)" : "#f8fafc", fontSize: "12.5px", color: themeStyles.textSecondary, lineHeight: "1.6" } },
                h("strong", { style: { color: themeStyles.textPrimary } }, "⌨️ 全局快捷键："),
                " 在客户端内随时按下 ",
                h("code", { style: { padding: "2px 6px", borderRadius: "4px", background: isDark ? "#1e293b" : "#e2e8f0" } }, "Ctrl + Shift + L"),
                " 即可直接无感切换深浅色外观。"
              )
            )
          )
        )
      );
    }

    return {
      inject: ["slots", "theme"],
      apply(ctx) {
        console.log("[dsh-desktop-hub] Client plugin applying v2.3.0 dual entrances...");

        ctx.slots.inject("sidebar.panellist", () =>
          ctx.slots.register(
            {
              name: "sidebar.panellist",
              id: "desktop-hub-sync",
              order: 6,
              label: () => "中枢同步",
            },
            (props) => h(HubSyncNavIcon, { size: props.size, active: props.active })
          )
        );

        ctx.slots.inject("main", () =>
          ctx.slots.register(
            {
              name: "main",
              key: "desktop-hub-sync",
            },
            (props) => h(SyncPage, { ...props, hostCtx: ctx })
          )
        );

        ctx.slots.inject("sidebar.panellist", () =>
          ctx.slots.register(
            {
              name: "sidebar.panellist",
              id: "desktop-hub-settings",
              order: 7,
              label: () => "桌面设置",
            },
            (props) => h(DesktopSettingsNavIcon, { size: props.size, active: props.active })
          )
        );

        ctx.slots.inject("main", () =>
          ctx.slots.register(
            {
              name: "main",
              key: "desktop-hub-settings",
            },
            (props) => h(SettingsPage, { ...props, hostCtx: ctx })
          )
        );

        ctx.slots.inject("sidebar.footer.action", () =>
          ctx.slots.register(
            {
              name: "sidebar.footer.action",
              id: "desktop-hub-sidebar-theme",
              order: 10,
              label: () => "切换外观",
            },
            (props) => h(SidebarFooterThemeToggle, { ...props, hostCtx: ctx })
          )
        );
      },
    };
  },
});
