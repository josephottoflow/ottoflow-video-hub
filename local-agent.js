/**
 * Ottoflow Local Agent
 * Runs silently on port 7654. Lets the Vercel dashboard start/restart
 * the render worker with one button click — no terminal needed.
 */
const http    = require("http");
const { spawn } = require("child_process");

const PORT = 7654;
let workerProc = null;

function startWorker() {
  if (workerProc && !workerProc.killed) {
    try { process.kill(-workerProc.pid); } catch {}
  }
  workerProc = spawn("npm", ["run", "worker"], {
    cwd:      __dirname,
    shell:    true,
    detached: true,
    stdio:    "ignore",
  });
  workerProc.unref();
  console.log("[agent] Worker started (pid " + workerProc.pid + ")");
}

// Auto-start worker when agent launches
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

  if (req.url === "/ping") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));

}).listen(PORT, "127.0.0.1", () => {
  console.log("Ottoflow Local Agent listening on http://localhost:" + PORT);
  console.log("Worker auto-started. Minimize this window — do not close it.");
});
