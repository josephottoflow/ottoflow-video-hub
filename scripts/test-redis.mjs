import IORedis from "ioredis";

const UPSTASH = "rediss://default:gQAAAAAAAesVAAIgcDEyOThlNWE1MjNmY2E0YjY0YTRlODhmNzRkNTRlZDRjMw@pet-lamb-125717.upstash.io:6379";

const r = new IORedis(UPSTASH, { connectTimeout: 6000, maxRetriesPerRequest: 0, tls: {} });

r.ping()
  .then(v  => { console.log("Upstash OK:", v); r.disconnect(); process.exit(0); })
  .catch(e => { console.log("Upstash FAIL:", e.message); r.disconnect(); process.exit(1); });

setTimeout(() => { console.log("TIMEOUT"); r.disconnect(); process.exit(1); }, 8000);
