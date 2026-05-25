// Runtime environment validation
//
// Call validateEnv() at startup (in workers) or in health-check routes.
// Never throws — always returns a report so callers can decide what to do.
// Call requireEnv() if you want a hard failure on missing required vars.

interface EnvVar {
  key:      string;
  required: boolean;
  desc:     string;
}

const ENV_VARS: EnvVar[] = [
  { key: "DATABASE_URL",          required: true,  desc: "Neon PostgreSQL connection string" },
  { key: "REDIS_URL",             required: true,  desc: "Railway Redis — BullMQ queue and lock operations (worker-internal, private network)" },
  { key: "UPSTASH_URL",          required: false, desc: "Upstash Redis — status/logs/pubsub (public, Vercel-accessible); falls back to REDIS_URL if unset" },
  { key: "ANTHROPIC_API_KEY",     required: false, desc: "Claude API — scriptwriter / topic agents" },
  { key: "GEMINI_API_KEY",        required: false, desc: "Gemini — primary AI provider" },
  { key: "ELEVENLABS_API_KEY",    required: false, desc: "ElevenLabs TTS voiceover" },
  { key: "R2_ACCOUNT_ID",         required: false, desc: "Cloudflare R2 storage" },
  { key: "R2_ACCESS_KEY_ID",      required: false, desc: "Cloudflare R2 storage" },
  { key: "R2_SECRET_ACCESS_KEY",  required: false, desc: "Cloudflare R2 storage" },
  { key: "R2_BUCKET_NAME",        required: false, desc: "Cloudflare R2 bucket name" },
  { key: "PEXELS_API_KEY",        required: false, desc: "Pexels stock video / images" },
  { key: "TELEGRAM_BOT_TOKEN",    required: false, desc: "Telegram approval bot" },
  { key: "TELEGRAM_CHAT_ID",      required: false, desc: "Telegram approval channel" },
  { key: "GOOGLE_SHEETS_ID",      required: false, desc: "Google Sheets content source" },
];

export interface EnvReport {
  ok:       boolean;
  missing:  string[];   // required vars that are not set
  absent:   string[];   // optional vars that are not set
  present:  string[];   // vars that are set (names only, never values)
}

export function validateEnv(): EnvReport {
  const missing = ENV_VARS.filter(v =>  v.required && !process.env[v.key]).map(v => v.key);
  const absent  = ENV_VARS.filter(v => !v.required && !process.env[v.key]).map(v => v.key);
  const present = ENV_VARS.filter(v => !!process.env[v.key]).map(v => v.key);
  return { ok: missing.length === 0, missing, absent, present };
}

/** Logs a structured startup diagnostic and exits(1) on missing required vars. */
export function requireEnv(): void {
  const { ok, missing, absent, present } = validateEnv();

  console.log(`[env] ${present.length}/${ENV_VARS.length} vars configured`);

  if (absent.length > 0) {
    for (const k of absent) {
      const v = ENV_VARS.find(e => e.key === k)!;
      console.warn(`[env] optional missing: ${k} — ${v.desc}`);
    }
  }

  if (!ok) {
    console.error("[env] FATAL — missing required environment variables:");
    for (const k of missing) {
      const v = ENV_VARS.find(e => e.key === k)!;
      console.error(`[env]   ✗ ${k} — ${v.desc}`);
    }
    process.exit(1);
  }
}
