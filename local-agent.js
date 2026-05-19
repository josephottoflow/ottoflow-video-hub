/**
 * Ottoflow Local Agent — Windows + Mac
 * Runs on port 7654. Lets the Vercel dashboard start/restart
 * the render worker and install auto-start — all via button clicks.
 */
const http = require("http");
const { spawn, execSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

const PORT   = 7654;
const PROJ   = __dirname;
const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

const LOG_FILE = path.join(PROJ, "worker.log");
let lastError  = "";
let workerProc = null;

// Guards against double-restart races:
// intentional = we killed the worker ourselves, suppress the exit-handler restart
let intentionalKill  = false;
let restartScheduled = false;
let workerRestarting = false; // true during the 5s window between crash and respawn

function log(line) {
  const ts  = new Date().toISOString().slice(11, 19);
  const out = `[${ts}] ${line}\n`;
  process.stdout.write(out);
  try { fs.appendFileSync(LOG_FILE, out); } catch {}
}

function killWorker() {
  if (!workerProc) return;
  intentionalKill = true;
  try {
    // On Windows, kill() with no signal sends SIGTERM to the process tree via taskkill
    if (IS_WIN && workerProc.pid) {
      try { execSync(`taskkill /pid ${workerProc.pid} /t /f`, { stdio: "ignore" }); } catch {}
    } else {
      workerProc.kill("SIGTERM");
    }
  } catch {}
  workerProc = null;
}

function startWorker() {
  // Prevent concurrent starts
  if (restartScheduled) {
    clearTimeout(restartScheduled);
    restartScheduled = false;
  }

  killWorker();

  // Trim log file to last 200 lines on each start
  try {
    const lines = fs.readFileSync(LOG_FILE, "utf8").split("\n");
    if (lines.length > 200) fs.writeFileSync(LOG_FILE, lines.slice(-200).join("\n"));
  } catch {}

  intentionalKill  = false; // reset before spawning so exit handler works normally
  workerRestarting = false; // we're spawning now — no longer "restarting"

  const proc = spawn("npm", ["run", "worker"], {
    cwd:   PROJ,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  workerProc = proc;

  proc.stdout?.on("data", d => { const t = d.toString().trim(); if (t) log("[worker] " + t); });
  proc.stderr?.on("data", d => {
    const t = d.toString().trim();
    if (t) { log("[worker-err] " + t); lastError = t.slice(0, 300); }
  });

  proc.on("exit", (code) => {
    if (workerProc === proc) workerProc = null; // clear ref only if it's still us

    if (intentionalKill) {
      // We killed it ourselves — startWorker() handles the next spawn, don't double-restart
      intentionalKill = false;
      return;
    }

    log(`[agent] Worker exited unexpectedly (code ${code}) — restarting in 5s`);
    workerRestarting = true;
    restartScheduled = setTimeout(() => {
      restartScheduled = false;
      startWorker();
    }, 5000);
  });

  log("[agent] Worker started (pid " + proc.pid + ")");
}

function isWorkerAlive() {
  if (!workerProc || !workerProc.pid) return false;
  try { process.kill(workerProc.pid, 0); return true; } catch { return false; }
}

function installStartup() {
  if (IS_WIN) {
    const startupDir = path.join(
      process.env.APPDATA || "",
      "Microsoft", "Windows", "Start Menu", "Programs", "Startup"
    );
    const bat  = `@echo off\r\ntitle Ottoflow Agent\r\ncd /d "${PROJ}"\r\nnode local-agent.js\r\necho.\r\necho Agent stopped. Check worker.log for errors.\r\npause\r\n`;
    const dest = path.join(startupDir, "ottoflow-agent.bat");
    fs.writeFileSync(dest, bat);
    console.log("[agent] Installed to Windows startup: " + dest);
    return { dest, platform: "windows" };
  }

  if (IS_MAC) {
    const launchDir = path.join(process.env.HOME || "", "Library", "LaunchAgents");
    fs.mkdirSync(launchDir, { recursive: true });
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ottoflow.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${path.join(PROJ, "local-agent.js")}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${PROJ}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${path.join(PROJ, "agent.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(PROJ, "agent.log")}</string>
</dict>
</plist>`;
    const dest = path.join(launchDir, "com.ottoflow.agent.plist");
    fs.writeFileSync(dest, plist);
    try { execSync(`launchctl load "${dest}"`); } catch {}
    console.log("[agent] Installed to Mac LaunchAgents: " + dest);
    return { dest, platform: "mac" };
  }

  throw new Error("Unsupported platform: " + process.platform);
}

// Auto-start worker on agent launch
startWorker();

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  if (req.url === "/start") {
    startWorker();
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url === "/install-startup") {
    try {
      const result = installStartup();
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, ...result }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: String(e) }));
    }
    return;
  }

  if (req.url === "/worker-status") {
    const alive = isWorkerAlive();
    // If dead and no restart already scheduled, kick one off
    if (!alive && !restartScheduled) {
      log("[agent] Worker was dead on status-check — restarting...");
      startWorker();
    }
    res.writeHead(200);
    // Report actual state — don't lie that it's alive while it's still starting
    res.end(JSON.stringify({ ok: true, workerAlive: alive, workerRestarting: !alive && workerRestarting, pid: workerProc?.pid ?? null }));
    return;
  }

  if (req.url === "/logs") {
    let lines = [];
    try {
      const raw = fs.readFileSync(LOG_FILE, "utf8");
      lines = raw.split("\n").filter(Boolean).slice(-50);
    } catch {}
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, lines, lastError }));
    return;
  }

  if (req.url === "/ping") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, platform: process.platform }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));

}).listen(PORT, "127.0.0.1", () => {
  console.log("Ottoflow Local Agent on http://localhost:" + PORT);
  console.log("Worker started. Minimize this window — do not close it.");
});
