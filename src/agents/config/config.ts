/**
 * CONFIG AGENT — Secrets & Environment Manager
 * Centralized configuration with typed env vars and validation.
 * All API keys, passwords, and credentials flow through here.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// === Configuration Schema ===

interface AppConfig {
  // Google Sheets
  google: {
    serviceAccountEmail: string;
    privateKey: string;
    spreadsheetId: string;
  };
  // ElevenLabs (optional)
  elevenlabs: {
    apiKey: string;
    voiceId: string;
  };
  // Telegram Approval Bot
  telegram: {
    botToken: string;
    chatId: string;
    approvalTimeoutMs: number;
  };
  // App Settings
  app: {
    outputDir: string;
    tempDir: string;
    videoFormat: "mp4" | "webm";
    videoWidth: number;
    videoHeight: number;
    fps: number;
  };
  // Ollama (optional — used by prompt engine, SEO generator)
  ollama?: {
    url: string;
    model: string;
  };
  // TikTok Scraper (optional)
  tiktok?: {
    userAgent: string;
    viewport: { width: number; height: number };
    maxRetries: number;
  };
}

// === Default Values ===

const DEFAULTS = {
  elevenlabs: {
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - default voice
  },
  telegram: {
    approvalTimeoutMs: 300000, // 5 minutes default
  },
  app: {
    outputDir: "./outputs",
    tempDir: "./temp",
    videoFormat: "mp4" as const,
    videoWidth: 1080,
    videoHeight: 1920,
    fps: 30,
  },
};

// === Config Loader ===

function loadConfig(): AppConfig {
  return {
    google: {
      serviceAccountEmail: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      privateKey: getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      spreadsheetId: getEnv("GOOGLE_SPREADSHEET_ID"),
    },
    elevenlabs: {
      apiKey: getEnvOrDefault("ELEVENLABS_API_KEY", ""),
      voiceId: getEnvOrDefault(
        "ELEVENLABS_VOICE_ID",
        DEFAULTS.elevenlabs.voiceId
      ),
    },
    telegram: {
      botToken: getEnv("TELEGRAM_BOT_TOKEN"),
      chatId: getEnv("TELEGRAM_CHAT_ID"),
      approvalTimeoutMs: parseInt(
        getEnvOrDefault(
          "TELEGRAM_APPROVAL_TIMEOUT_MS",
          String(DEFAULTS.telegram.approvalTimeoutMs)
        )
      ),
    },
    app: {
      outputDir: getEnvOrDefault("OUTPUT_DIR", DEFAULTS.app.outputDir),
      tempDir: getEnvOrDefault("TEMP_DIR", DEFAULTS.app.tempDir),
      videoFormat: getEnvOrDefault(
        "VIDEO_FORMAT",
        DEFAULTS.app.videoFormat
      ) as "mp4" | "webm",
      videoWidth: parseInt(
        getEnvOrDefault("VIDEO_WIDTH", String(DEFAULTS.app.videoWidth))
      ),
      videoHeight: parseInt(
        getEnvOrDefault("VIDEO_HEIGHT", String(DEFAULTS.app.videoHeight))
      ),
      fps: parseInt(getEnvOrDefault("VIDEO_FPS", String(DEFAULTS.app.fps))),
    },
    // Optional: Ollama LLM
    ...(process.env.OLLAMA_URL
      ? {
          ollama: {
            url: process.env.OLLAMA_URL,
            model: getEnvOrDefault("OLLAMA_MODEL", "llama3.1"),
          },
        }
      : {}),
    // Optional: TikTok scraper
    ...(process.env.TIKTOK_USER_AGENT
      ? {
          tiktok: {
            userAgent: process.env.TIKTOK_USER_AGENT,
            viewport: {
              width: parseInt(getEnvOrDefault("TIKTOK_VIEWPORT_WIDTH", "390")),
              height: parseInt(getEnvOrDefault("TIKTOK_VIEWPORT_HEIGHT", "844")),
            },
            maxRetries: parseInt(getEnvOrDefault("TIKTOK_MAX_RETRIES", "3")),
          },
        }
      : {}),
  };
}

// === Helpers ===

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// === Validation ===

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function validateConfig(): {
  valid: boolean;
  missing: string[];
  present: string[];
} {
  const required = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
    "GOOGLE_SPREADSHEET_ID",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
  ];

  const missing: string[] = [];
  const present: string[] = [];

  for (const key of required) {
    if (process.env[key]) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  return { valid: missing.length === 0, missing, present };
}

// === .env Generator ===

export function generateEnvFile(values: Record<string, string> = {}): string {
  const template = `# ============================================
# TikTok Product Video Factory — Environment
# ============================================

# === Google Sheets API ===
GOOGLE_SERVICE_ACCOUNT_EMAIL=${values.GOOGLE_SERVICE_ACCOUNT_EMAIL || ""}
GOOGLE_PRIVATE_KEY=${values.GOOGLE_PRIVATE_KEY || ""}
GOOGLE_SPREADSHEET_ID=${values.GOOGLE_SPREADSHEET_ID || ""}

# === ElevenLabs TTS ===
ELEVENLABS_API_KEY=${values.ELEVENLABS_API_KEY || ""}
ELEVENLABS_VOICE_ID=${values.ELEVENLABS_VOICE_ID || DEFAULTS.elevenlabs.voiceId}

# === Telegram Approval Bot ===
TELEGRAM_BOT_TOKEN=${values.TELEGRAM_BOT_TOKEN || ""}
TELEGRAM_CHAT_ID=${values.TELEGRAM_CHAT_ID || ""}
TELEGRAM_APPROVAL_TIMEOUT_MS=${DEFAULTS.telegram.approvalTimeoutMs}

# === App Settings ===
OUTPUT_DIR=${DEFAULTS.app.outputDir}
TEMP_DIR=${DEFAULTS.app.tempDir}
VIDEO_FORMAT=${DEFAULTS.app.videoFormat}
VIDEO_WIDTH=${DEFAULTS.app.videoWidth}
VIDEO_HEIGHT=${DEFAULTS.app.videoHeight}
VIDEO_FPS=${DEFAULTS.app.fps}
`;

  return template;
}

export function writeEnvFile(
  filePath: string,
  values: Record<string, string> = {}
): void {
  const content = generateEnvFile(values);
  fs.writeFileSync(filePath, content, "utf-8");
}

// === Export Singleton ===

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}

export type { AppConfig };
export { DEFAULTS };
