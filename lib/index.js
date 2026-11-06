import { exec, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

// 路径全部来自插件配置（cordis.patch.yml 的 config 段）或环境变量，源码中不写死任何本机路径。
let AGENT_WORKSPACE = null;
let BASELINE_ROOT = null;
let SCRIPTS_DIR = null;
let SYNC_SCRIPT = null;

function configurePaths(config = {}) {
  AGENT_WORKSPACE = config.agentWorkspace || process.env.DSH_AGENT_WORKSPACE || null;
  BASELINE_ROOT = config.baselineRoot || (AGENT_WORKSPACE ? path.join(AGENT_WORKSPACE, "deploy", "dsh", "baselines") : null);
  SCRIPTS_DIR = config.scriptsDir || (AGENT_WORKSPACE ? path.join(AGENT_WORKSPACE, "deploy", "dsh") : null);
  SYNC_SCRIPT = SCRIPTS_DIR ? path.join(SCRIPTS_DIR, "dsh-profile-sync.ps1") : null;
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
    const backupPath = `${asarPath}.original`;
    const hasBackup = fs.existsSync(backupPath);
    const fd = fs.openSync(asarPath, "r");
    try {
      const stats = fs.fstatSync(fd);
      const { headerSize, header } = readAsarHeader(fd);
      const { offset, size } = findMainJsInAsar(header, headerSize);

      const mainBuf = Buffer.alloc(size);
      fs.readSync(fd, mainBuf, 0, size, offset);

      const hasTargetClose = mainBuf.includes(REPLACEMENT_CLOSE_BUF);
      const hasPrevClose = mainBuf.includes(PREV_CLOSE_BUF);
      const hasClosePatch = hasTargetClose || hasPrevClose;
      const hasTrayPatch = mainBuf.includes(REPLACEMENT_TRAY_BUF);

      let status = "original";
      if (hasTargetClose && hasTrayPatch) status = "fully_patched";
      else if (hasClosePatch && hasTrayPatch) status = "legacy_patched";
      else if (hasClosePatch || hasTrayPatch) status = "partial_patched";

      return {
        status,
        asarPath,
        hasBackup,
        trayDisabled: hasTrayPatch,
        directQuit: hasClosePatch,
        upgradedClose: hasTargetClose,
        fileSize: stats.size,
      };
    } finally {
      fs.closeSync(fd);
    }
  });
}

function applyQuitActionPatch(asarPath) {
  return withNoAsar(() => {
    const backupPath = `${asarPath}.original`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(asarPath, backupPath);
    }

    const fd = fs.openSync(asarPath, "r+");
    try {
      const { headerSize, header } = readAsarHeader(fd);
      const { offset, size } = findMainJsInAsar(header, headerSize);

      const mainBuf = Buffer.alloc(size);
      fs.readSync(fd, mainBuf, 0, size, offset);

      let trayIdx = mainBuf.indexOf(TARGET_TRAY_ORIG_BUF);
      if (trayIdx !== -1) {
        fs.writeSync(fd, REPLACEMENT_TRAY_BUF, 0, TARGET_TRAY_LEN, offset + trayIdx);
      }

      let closeIdx = mainBuf.indexOf(TARGET_CLOSE_ORIG_BUF);
      if (closeIdx === -1) closeIdx = mainBuf.indexOf(PREV_CLOSE_BUF);
      if (closeIdx !== -1) {
        fs.writeSync(fd, REPLACEMENT_CLOSE_BUF, 0, TARGET_CLOSE_LEN, offset + closeIdx);
      }

      return { success: true, message: "补丁应用成功：已禁用托盘并设置窗口直接退出" };
    } finally {
      fs.closeSync(fd);
    }
  });
}

function restoreQuitActionPatch(asarPath) {
  return withNoAsar(() => {
    const backupPath = `${asarPath}.original`;
    if (!fs.existsSync(backupPath)) {
      throw new Error(`未找到备份文件: ${backupPath}，无法恢复`);
    }
    fs.copyFileSync(backupPath, asarPath);
    return { success: true, message: "已通过备份完全恢复官方原版退出行为" };
  });
}

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

function runSyncText(args) {
  if (!AGENT_WORKSPACE || !SYNC_SCRIPT) return Promise.resolve({ ok: false, output: NOT_CONFIGURED });
  const fullArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SYNC_SCRIPT, ...args];
  const opts = {
    cwd: AGENT_WORKSPACE,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  };
  const attempt = (exe) =>
    execFilePromise(exe, fullArgs, opts).then(
      ({ stdout, stderr }) => ({ ok: true, output: [stdout, stderr].filter(Boolean).join("\n") }),
      (err) => ({
        ok: false,
        notFound: err.code === "ENOENT",
        output: [err.stdout, err.stderr].filter(Boolean).join("\n") || err.message || String(err),
      })
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
              result = restoreQuitActionPatch(asarPath);
            } else {
              result = applyQuitActionPatch(asarPath);
            }
            const updated = getQuitActionStatus(asarPath);
            sendJson(res, 200, { ok: true, result, updated });
            return;
          }

          // 3. POST /api/desktop-hub/sync/diff
          if (pathname === "/api/desktop-hub/sync/diff" && req.method === "POST") {
            const r = await runSyncText(["-Action", "Diff", "-SyncRepo"]);
            sendJson(res, 200, { ok: r.ok, output: r.output });
            return;
          }

          // 4. POST /api/desktop-hub/sync/save-baseline
          if ((pathname === "/api/desktop-hub/sync/save-baseline" || pathname === "/api/desktop-hub/sync/push") && req.method === "POST") {
            const r = await runSyncText(["-Action", "SaveBaseline", "-Apply"]);
            sendJson(res, 200, { ok: r.ok, output: r.output });
            return;
          }

          // 4b. GET /api/desktop-hub/sync/repo-status
          if (pathname === "/api/desktop-hub/sync/repo-status" && req.method === "GET") {
            const r = await runSyncJson(["-Action", "RepoStatus"]);
            sendJson(res, 200, r.ok ? { ...r.data } : r);
            return;
          }

          // 4c. POST /api/desktop-hub/sync/git-pull
          if (pathname === "/api/desktop-hub/sync/git-pull" && req.method === "POST") {
            const r = await runSyncText(["-Action", "GitPull"]);
            sendJson(res, 200, { ok: r.ok, output: r.output });
            return;
          }

          // 4d. POST /api/desktop-hub/sync/git-push
          if (pathname === "/api/desktop-hub/sync/git-push" && req.method === "POST") {
            const r = await runSyncText(["-Action", "GitPush"]);
            sendJson(res, 200, { ok: r.ok, output: r.output });
            return;
          }

          // 5. POST /api/desktop-hub/sync/pull-plan
          if (pathname === "/api/desktop-hub/sync/pull-plan" && req.method === "POST") {
            const r = await runSyncText(["-Action", "Pull", "-SyncRepo"]);
            sendJson(res, 200, { ok: r.ok, output: r.output });
            return;
          }

          // 5b. GET /api/desktop-hub/sync/pull-schedule
          if (pathname === "/api/desktop-hub/sync/pull-schedule" && req.method === "GET") {
            const r = await runSyncJson(["-Action", "ScheduleStatus"]);
            sendJson(res, 200, r.ok ? { ok: true, ...r.data } : r);
            return;
          }

          // 5c. POST /api/desktop-hub/sync/pull-schedule
          if (pathname === "/api/desktop-hub/sync/pull-schedule" && req.method === "POST") {
            const body = await readJsonBody(req).catch(() => ({}));
            const closeDsh = Boolean(body && body.closeDsh);
            const args = ["-Action", "Pull", "-Schedule", "-Relaunch"];
            if (closeDsh) args.push("-CloseDsh");
            const r = await runSyncJson(args);
            sendJson(res, 200, r.ok ? { ok: true, ...r.data } : r);
            return;
          }

          // 5e. POST /api/desktop-hub/sync/auto-sync
          if (pathname === "/api/desktop-hub/sync/auto-sync" && req.method === "POST") {
            const pullRes = await runSyncText(["-Action", "GitPull"]);
            if (!pullRes.ok) {
              sendJson(res, 200, { ok: false, error: "从 GitHub 拉取失败：" + pullRes.output });
              return;
            }
            const r = await runSyncJson(["-Action", "Pull", "-Schedule", "-Relaunch", "-CloseDsh"]);
            sendJson(res, 200, r.ok ? { ok: true, pullOutput: pullRes.output, ...r.data } : r);
            return;
          }

          // 5d. POST /api/desktop-hub/sync/pull-cancel
          if (pathname === "/api/desktop-hub/sync/pull-cancel" && req.method === "POST") {
            const r = await runSyncJson(["-Action", "CancelSchedule"]);
            sendJson(res, 200, r.ok ? { ok: true, ...r.data } : r);
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
