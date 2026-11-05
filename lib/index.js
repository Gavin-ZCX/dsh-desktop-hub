import { exec, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

// 路径全部来自插件配置（cordis.patch.yml 的 config 段）或环境变量，源码中不写死任何本机路径。
//   agentWorkspace : 中枢工作区根目录（必填，或环境变量 DSH_AGENT_WORKSPACE）
//   baselineRoot   : 日期基线所在目录（可选，默认 <agentWorkspace>/deploy/dsh/baselines）
//   scriptsDir     : 同步与快捷方式脚本目录（可选，默认 <agentWorkspace>/deploy/dsh）
//   obsidianShared : Obsidian 共享配置目录（可选，或环境变量 DSH_OBSIDIAN_SHARED；未配置时禁用重建功能）
let AGENT_WORKSPACE = null;
let BASELINE_ROOT = null;
let SCRIPTS_DIR = null;
let SYNC_SCRIPT = null;
let SHORTCUT_SCRIPT = null;
let OBSIDIAN_SHARED = null;

function configurePaths(config = {}) {
  AGENT_WORKSPACE = config.agentWorkspace || process.env.DSH_AGENT_WORKSPACE || null;
  OBSIDIAN_SHARED = config.obsidianShared || process.env.DSH_OBSIDIAN_SHARED || null;
  BASELINE_ROOT = config.baselineRoot || (AGENT_WORKSPACE ? path.join(AGENT_WORKSPACE, "deploy", "dsh", "baselines") : null);
  SCRIPTS_DIR = config.scriptsDir || (AGENT_WORKSPACE ? path.join(AGENT_WORKSPACE, "deploy", "dsh") : null);
  SYNC_SCRIPT = SCRIPTS_DIR ? path.join(SCRIPTS_DIR, "dsh-profile-sync.ps1") : null;
  SHORTCUT_SCRIPT = SCRIPTS_DIR ? path.join(SCRIPTS_DIR, "create-desktop-shortcut.ps1") : null;
}

// 取 baselineRoot 下名称最新的基线子目录（YYYY-MM-DD，同日修订加 -N 后缀）
function latestBaselineDir() {
  if (!BASELINE_ROOT || !fs.existsSync(BASELINE_ROOT)) return null;
  const dated = fs
    .readdirSync(BASELINE_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}(-\d+)?$/.test(d.name))
    .map((d) => d.name)
    .sort();
  return dated.length ? path.join(BASELINE_ROOT, dated[dated.length - 1]) : null;
}

const NOT_CONFIGURED = "未配置 agentWorkspace：请在 cordis.patch.yml 中为 dsh-desktop-hub 设置 config.agentWorkspace，或设置环境变量 DSH_AGENT_WORKSPACE。";

// 探测 app.asar 路径
function detectAsarPath() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const progFiles = process.env.ProgramFiles || "";
  const progFilesX86 = process.env["ProgramFiles(x86)"] || "";

  const candidates = [
    path.join(localAppData, "Programs", "DeepSeek Harness", "resources", "app.asar"),
    path.join(progFiles, "DeepSeek Harness", "resources", "app.asar"),
    path.join(progFilesX86, "DeepSeek Harness", "resources", "app.asar"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

// 位置 1: 关闭窗口处理 (224 字节)
const TARGET_CLOSE_ORIGINAL = `			const hide = () => {\r\n				if (!quitting && !shellInstallerOwnsQuit && !sessionEnding && !window.isDestroyed()) hideMainWindow(window);\r\n			};\r\n			if (backgroundNotice === void 0) hide();\r\n			else backgroundNotice.close(hide);`.replace(/\r\n/g, "\n");
const TARGET_CLOSE_LEN = Buffer.byteLength(TARGET_CLOSE_ORIGINAL, "utf8");

let targetClosePatch = `			quitWithoutConfirmation(); /* DSH_DIRECT_QUIT_NO_TRAY_PATCH */`;
while (Buffer.byteLength(targetClosePatch, "utf8") < TARGET_CLOSE_LEN) {
  targetClosePatch += " ";
}
const REPLACEMENT_CLOSE_BUF = Buffer.from(targetClosePatch, "utf8");
const TARGET_CLOSE_ORIG_BUF = Buffer.from(TARGET_CLOSE_ORIGINAL, "utf8");

let prevClosePatch = `			app.quit(); /* DSH_DIRECT_QUIT_NO_TRAY_PATCH */`;
while (Buffer.byteLength(prevClosePatch, "utf8") < TARGET_CLOSE_LEN) {
  prevClosePatch += " ";
}
const PREV_CLOSE_BUF = Buffer.from(prevClosePatch, "utf8");

// 位置 2: 禁用创建系统托盘 (40 字节)
const TARGET_TRAY_ORIGINAL = "\tif (process.platform === \"win32\") try {";
const TARGET_TRAY_LEN = Buffer.byteLength(TARGET_TRAY_ORIGINAL, "utf8");

let targetTrayPatch = "\tif (!1 /* NO_TRAY_PATCH */) try {";
while (Buffer.byteLength(targetTrayPatch, "utf8") < TARGET_TRAY_LEN) {
  targetTrayPatch += " ";
}
const REPLACEMENT_TRAY_BUF = Buffer.from(targetTrayPatch, "utf8");
const TARGET_TRAY_ORIG_BUF = Buffer.from(TARGET_TRAY_ORIGINAL, "utf8");

function readAsarHeader(fd) {
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  const headerSize = buf.readUInt32LE(12);
  const headerBuf = Buffer.alloc(headerSize);
  fs.readSync(fd, headerBuf, 0, headerSize, 16);
  const header = JSON.parse(headerBuf.toString("utf8"));
  return { headerSize, header };
}

function findMainJsInAsar(header, headerSize) {
  const fileEntry = header.files?.lib?.files?.["main.js"];
  if (!fileEntry) throw new Error("未在 app.asar 中找到 lib/main.js");
  const baseOffset = 16 + headerSize;
  const absOffset = baseOffset + Number(fileEntry.offset);
  return { offset: absOffset, size: fileEntry.size };
}

function withNoAsar(fn) {
  const prev = process.noAsar;
  process.noAsar = true;
  try {
    return fn();
  } finally {
    process.noAsar = prev;
  }
}

function getQuitActionStatus(asarPath) {
  return withNoAsar(() => {
    if (!fs.existsSync(asarPath)) {
      return { status: "not_found", asarPath, hasBackup: false };
    }
    const backupPath = asarPath + ".original";
    const hasBackup = fs.existsSync(backupPath);

    const fd = fs.openSync(asarPath, "r");
    try {
      const { headerSize, header } = readAsarHeader(fd);
      const mainJs = findMainJsInAsar(header, headerSize);
      const contentBuf = Buffer.alloc(mainJs.size);
      fs.readSync(fd, contentBuf, 0, mainJs.size, mainJs.offset);

      const hasCloseOriginal = contentBuf.includes(TARGET_CLOSE_ORIG_BUF);
      const hasClosePatch = contentBuf.includes(REPLACEMENT_CLOSE_BUF) || contentBuf.includes(PREV_CLOSE_BUF);
      const isUpgradedClose = contentBuf.includes(REPLACEMENT_CLOSE_BUF);

      const hasTrayOriginal = contentBuf.includes(TARGET_TRAY_ORIG_BUF);
      const hasTrayPatch = contentBuf.includes(REPLACEMENT_TRAY_BUF);

      let status = "unknown";
      if (hasClosePatch && hasTrayPatch) {
        status = "fully_patched"; // 托盘已彻底禁用 + 直接完全退出
      } else if (hasClosePatch && !hasTrayPatch) {
        status = "partially_patched";
      } else if (hasCloseOriginal && hasTrayOriginal) {
        status = "original";
      }

      return {
        asarPath,
        hasBackup,
        status,
        trayDisabled: hasTrayPatch,
        directQuit: hasClosePatch,
        upgradedClose: isUpgradedClose,
        fileSize: fs.statSync(asarPath).size,
      };
    } catch (err) {
      return { asarPath, hasBackup, status: "error", error: String(err) };
    } finally {
      fs.closeSync(fd);
    }
  });
}

function applyQuitActionPatch(asarPath) {
  return withNoAsar(() => {
    const backupPath = asarPath + ".original";
    const fd = fs.openSync(asarPath, "r+");
    try {
      const { headerSize, header } = readAsarHeader(fd);
      const mainJs = findMainJsInAsar(header, headerSize);
      const contentBuf = Buffer.alloc(mainJs.size);
      fs.readSync(fd, contentBuf, 0, mainJs.size, mainJs.offset);

      // 自动备份原版
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(asarPath, backupPath);
      }

      // 1. 修补关闭行为 (退出不再等待)
      let closeIndex = contentBuf.indexOf(TARGET_CLOSE_ORIG_BUF);
      if (closeIndex === -1) {
        closeIndex = contentBuf.indexOf(PREV_CLOSE_BUF);
      }
      if (closeIndex !== -1) {
        const writePos = mainJs.offset + closeIndex;
        fs.writeSync(fd, REPLACEMENT_CLOSE_BUF, 0, TARGET_CLOSE_LEN, writePos);
      }

      // 2. 彻底禁用启动时创建系统托盘
      const trayIndex = contentBuf.indexOf(TARGET_TRAY_ORIG_BUF);
      if (trayIndex !== -1) {
        const writePos = mainJs.offset + trayIndex;
        fs.writeSync(fd, REPLACEMENT_TRAY_BUF, 0, TARGET_TRAY_LEN, writePos);
      }

      fs.fsyncSync(fd);

      return {
        success: true,
        message: "已成功应用优化：彻底移除系统托盘图标（不驻留），点击窗口右上角 (X) 直接完全退出！",
      };
    } finally {
      fs.closeSync(fd);
    }
  });
}

function restoreQuitActionPatch(asarPath) {
  return withNoAsar(() => {
    const backupPath = asarPath + ".original";
    const fd = fs.openSync(asarPath, "r+");
    try {
      const { headerSize, header } = readAsarHeader(fd);
      const mainJs = findMainJsInAsar(header, headerSize);
      const contentBuf = Buffer.alloc(mainJs.size);
      fs.readSync(fd, contentBuf, 0, mainJs.size, mainJs.offset);

      // 1. 还原关闭行为
      let closeIndex = contentBuf.indexOf(REPLACEMENT_CLOSE_BUF);
      if (closeIndex === -1) {
        closeIndex = contentBuf.indexOf(PREV_CLOSE_BUF);
      }
      if (closeIndex !== -1) {
        const writePos = mainJs.offset + closeIndex;
        fs.writeSync(fd, TARGET_CLOSE_ORIG_BUF, 0, TARGET_CLOSE_LEN, writePos);
      }

      // 2. 还原托盘创建
      const trayIndex = contentBuf.indexOf(REPLACEMENT_TRAY_BUF);
      if (trayIndex !== -1) {
        const writePos = mainJs.offset + trayIndex;
        fs.writeSync(fd, TARGET_TRAY_ORIG_BUF, 0, TARGET_TRAY_LEN, writePos);
      }

      fs.fsyncSync(fd);

      return { success: true, message: "已成功还原为官方默认行为（启用托盘图标 + 关闭窗口隐藏到托盘）。" };
    } finally {
      try {
        fs.closeSync(fd);
      } catch (_) {}
    }
  });
}

async function runPowerShell(scriptPath, args = []) {
  if (!AGENT_WORKSPACE || !scriptPath) return { ok: false, error: NOT_CONFIGURED };
  const cmd = `pwsh -NoProfile -File "${scriptPath}" ${args.join(" ")}`;
  try {
    const { stdout, stderr } = await execPromise(cmd, {
      cwd: AGENT_WORKSPACE,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout, stderr };
  } catch (err) {
    // 降级尝试 Windows PowerShell
    const fallbackCmd = `powershell -NoProfile -File "${scriptPath}" ${args.join(" ")}`;
    try {
      const { stdout, stderr } = await execPromise(fallbackCmd, {
        cwd: AGENT_WORKSPACE,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        maxBuffer: 10 * 1024 * 1024,
      });
      return { ok: true, stdout, stderr };
    } catch (fallbackErr) {
      return { ok: false, error: err.message || String(err), stdout: err.stdout, stderr: err.stderr };
    }
  }
}

// 以参数数组调用同步脚本并解析其 -Json 输出（最后一个以 { 开头的行）。
// 不像 runPowerShell 那样在失败后用 Windows PowerShell 重跑，避免把“安排/取消”执行两遍；
// 只有找不到 pwsh 时才改用 powershell。
function runSyncJson(args) {
  if (!AGENT_WORKSPACE || !SYNC_SCRIPT) return Promise.resolve({ ok: false, error: NOT_CONFIGURED });
  const fullArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SYNC_SCRIPT, ...args, "-Json"];
  const opts = {
    cwd: AGENT_WORKSPACE,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  };
  const parse = (stdout) => {
    const line = String(stdout || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{"))
      .pop();
    if (!line) return null;
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  };
  const attempt = (exe) =>
    execFilePromise(exe, fullArgs, opts).then(
      ({ stdout, stderr }) => {
        const data = parse(stdout);
        return data ? { ok: true, data } : { ok: false, error: "无法解析脚本输出", output: stdout || stderr };
      },
      (err) => ({ ok: false, notFound: err.code === "ENOENT", error: err.stderr || err.message || String(err), output: err.stdout })
    );
  return attempt("pwsh").then((r) => (r.notFound ? attempt("powershell") : r));
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
        resolve({});
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

export const name = "dsh-desktop-hub";

export function apply(ctx, config = {}) {
  console.log("[dsh-desktop-hub] Host plugin initializing...");
  configurePaths(config);
  if (!AGENT_WORKSPACE) console.warn("[dsh-desktop-hub] " + NOT_CONFIGURED);

  const asarPath = detectAsarPath();

  const mountRoute = (webServer) => {
    return webServer.register({
      kind: "prefix",
      path: "/api/desktop-hub",
      handler: async (req, res) => {
        try {
          if (req.method === "OPTIONS") {
            res.writeHead(200, {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            });
            res.end();
            return;
          }

          const parsedUrl = new URL(req.url, "http://localhost");
          const pathname = parsedUrl.pathname;

          // 1. GET /api/desktop-hub/status
          if (pathname === "/api/desktop-hub/status" && req.method === "GET") {
            const quitAction = getQuitActionStatus(asarPath);
            const statusData = {
              ok: true,
              hostname: os.hostname(),
              platform: process.platform,
              arch: process.arch,
              user: os.userInfo()?.username || "",
              workspaceDir: AGENT_WORKSPACE,
              hubBaselineDir: latestBaselineDir(),
              configured: Boolean(AGENT_WORKSPACE),
              quitAction,
              serverTime: new Date().toISOString(),
            };
            sendJson(res, 200, statusData);
            return;
          }

          // 2. POST /api/desktop-hub/quit-action/toggle
          if (pathname === "/api/desktop-hub/quit-action/toggle" && req.method === "POST") {
            const cur = getQuitActionStatus(asarPath);
            const isCurrentlyPatched = cur.status === "fully_patched" || cur.status === "patched";
            let result;
            if (isCurrentlyPatched) {
              // 还原官方默认
              result = restoreQuitActionPatch(asarPath);
            } else {
              // 应用直接退出与禁用托盘
              result = applyQuitActionPatch(asarPath);
            }
            const updated = getQuitActionStatus(asarPath);
            sendJson(res, 200, { ok: true, result, updated });
            return;
          }

          // 3. POST /api/desktop-hub/sync/diff
          if (pathname === "/api/desktop-hub/sync/diff" && req.method === "POST") {
            const resExec = await runPowerShell(SYNC_SCRIPT, ["-Action", "Diff"]);
            sendJson(res, 200, {
              ok: resExec.ok,
              output: resExec.stdout || resExec.stderr || resExec.error,
            });
            return;
          }

          // 4. POST /api/desktop-hub/sync/push
          if (pathname === "/api/desktop-hub/sync/push" && req.method === "POST") {
            const resExec = await runPowerShell(SYNC_SCRIPT, ["-Action", "Push", "-Apply"]);
            sendJson(res, 200, {
              ok: resExec.ok,
              output: resExec.stdout || resExec.stderr || resExec.error,
            });
            return;
          }

          // 5. POST /api/desktop-hub/sync/pull-plan（对齐计划，只预演不写入）
          if (pathname === "/api/desktop-hub/sync/pull-plan" && req.method === "POST") {
            const resExec = await runPowerShell(SYNC_SCRIPT, ["-Action", "Pull"]);
            sendJson(res, 200, {
              ok: resExec.ok,
              output: resExec.stdout || resExec.stderr || resExec.error,
            });
            return;
          }

          // 5b. GET /api/desktop-hub/sync/pull-schedule（是否已安排“关闭 DSH 后自动对齐”，及上次结果）
          if (pathname === "/api/desktop-hub/sync/pull-schedule" && req.method === "GET") {
            const r = await runSyncJson(["-Action", "ScheduleStatus"]);
            sendJson(res, 200, r.ok ? { ok: true, ...r.data } : r);
            return;
          }

          // 5c. POST /api/desktop-hub/sync/pull-schedule（安排：DSH 退出后执行 Pull -Apply，成功后重新打开 DSH）
          if (pathname === "/api/desktop-hub/sync/pull-schedule" && req.method === "POST") {
            const r = await runSyncJson(["-Action", "Pull", "-Schedule", "-Relaunch"]);
            sendJson(res, 200, r.ok ? { ok: true, ...r.data } : r);
            return;
          }

          // 5d. POST /api/desktop-hub/sync/pull-cancel（取消已安排的自动对齐）
          if (pathname === "/api/desktop-hub/sync/pull-cancel" && req.method === "POST") {
            const r = await runSyncJson(["-Action", "CancelSchedule"]);
            sendJson(res, 200, r.ok ? { ok: true, ...r.data } : r);
            return;
          }

          // 6. POST /api/desktop-hub/tools/relink-obsidian
          if (pathname === "/api/desktop-hub/tools/relink-obsidian" && req.method === "POST") {
            if (!OBSIDIAN_SHARED) {
              sendJson(res, 200, { ok: false, error: "未配置 obsidianShared：请在 config.obsidianShared 或环境变量 DSH_OBSIDIAN_SHARED 中指定 Obsidian 共享配置目录。" });
              return;
            }
            try {
              const { stdout, stderr } = await execPromise(
                `python "${path.join(OBSIDIAN_SHARED, "relink_all.py")}" --apply`,
                {
                  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
                  maxBuffer: 10 * 1024 * 1024,
                }
              );
              sendJson(res, 200, { ok: true, output: stdout || stderr });
            } catch (pyErr) {
              sendJson(res, 200, { ok: false, error: pyErr.message || String(pyErr) });
            }
            return;
          }

          // 7. POST /api/desktop-hub/tools/create-shortcut
          if (pathname === "/api/desktop-hub/tools/create-shortcut" && req.method === "POST") {
            const resExec = await runPowerShell(SHORTCUT_SCRIPT);
            sendJson(res, 200, {
              ok: resExec.ok,
              output: resExec.stdout || resExec.stderr || resExec.error,
            });
            return;
          }

          sendJson(res, 404, { ok: false, error: "API Route Not Found" });
        } catch (globalErr) {
          console.error("[dsh-desktop-hub] Handler error:", globalErr);
          sendJson(res, 500, { ok: false, error: String(globalErr) });
        }
      },
    });
  };

  ctx.inject(["webServer"], (innerCtx) => {
    mountRoute(innerCtx.webServer);
    console.log("[dsh-desktop-hub] Mounted /api/desktop-hub routes on webServer");
  });
}
