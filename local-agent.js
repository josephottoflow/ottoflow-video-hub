/**
 * Ottoflow Local Agent
 * Runs on port 7654. Lets the Vercel dashboard control the worker
 * and install itself to Windows startup — all via button clicks.
 */
const http = require("http");
const { spawn } = require("child_process");
const fs   = require("fs");
const path = require("path");

const PORT    = 7654;
const PROJ    = __dirname;
const STARTUP = path.join(
  process.env.APPDATA || "",
  "Microsoft", "Windows", "Start Menu", "Programs", "Startup"
);

let workerProc = null;

function startWorker() {
  if (workerProc && !workerProc.killed) {
    try { process.kill(-workerProc.pid); } catch {}
  }
  workerProc = spawn("npm", ["run", "worker"], {
    cwd:      PROJ,
    shell:    true,
    detached: true,
    stdio:    "ignore",
  });
  workerProc.unref();
  console.log("[agent] Worker started");
}

function installStartup() {
  // Write a startup .bat that goes to the project folder and runs the agent
  const bat = `@echo off\ncd /d "${PROJ}"\nstart /min "" node local-agent.js\n`;
  const dest = path.join(STARTUP, "ottoflow-agent.bat");
  fs.writeFileSync(dest, bat);
  console.log("[agent] Installed to startup: " + dest);
  return dest;
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
      const dest = installStartup();
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, path: dest }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: String(e) }));
    }
    return;
  }

  if (req.url === "/ping") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));

}).listen(PORT, "127.0.0.1", () => {
  console.log("Ottoflow Local Agent on http://localhost:" + PORT);
  console.log("Worker started. Minimize this window — do not close it.");
});
