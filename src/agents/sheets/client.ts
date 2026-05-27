/**
 * GOOGLE SHEETS AGENT — Ottoflow Video Hub Content Queue
 *
 * V1 schema: "Sheet1" / "Content Pipeline" — 21 columns A-U
 * V2 schema: "Video Gen — Advance Tier" — 56 columns A-BD
 *            Cinematic orchestration control panel.
 *            Single source of truth for storyboard, voice, Veo, and pipeline state.
 *
 * V2 Column Sections:
 *   A-B:   Identity          (Row ID, Topic)
 *   C-H:   Core Content DNA  (Angle, Hook Strategy, Emotional Trigger, Story Arc, CTA, Style)
 *   I-O:   Creator Identity  (Persona, Energy, Archetype, Camera, Voice Profile, Speaking, Avatar URL)
 *   P-V:   Visual Cinematic  (Visual ID, Lighting, Motion, Environment, Pacing, Color Mood, Shot Language)
 *   W-AB:  Storyboard        (Scene Count, Hook/Reveal/Insight/Proof/CTA scene prompts)
 *   AC-AH: Veo Generation    (Strategy, Motion Intensity, Camera Motion, Realism, UGC Style, Fallback)
 *   AI-AL: Voice + Script    (Narration Style, Speech Cadence, Emphasis Style, Caption Style)
 *   AM-AO: Hooks             (Hook A, B, C)
 *   AP-AV: Pipeline Observability (per-stage status × 7)
 *   AW-BB: Output            (Master Status, Worker Job ID, Scheduled At, Script, Video URL, Drive Link)
 *   BC-BD: Performance       (Score, Notes/Errors)
 *
 * Data starts at row 4 (rows 1-3 are section label / column name / description headers).
 */

import { google, sheets_v4, Auth } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as url from "url";
import { getConfig } from "../config/config";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentStatus =
  | "Pending"
  | "Queued"
  | "Scheduled"
  | "Processing"
  | "Rendering"
  | "Approval"
  | "Exporting"
  | "Done"
  | "Rejected"
  | "Error";

export type PlatformStatus = "Pending" | "Uploaded" | "Scheduled" | "Live" | "Error";

export type StageStatus = "Pending" | "Generating" | "Rendering" | "Done" | "Error" | "Skipped";

export interface ContentRow {
  rowIndex:          number;
  topic:             string;
  script:            string;
  hookA:             string;
  hookB:             string;
  hookC:             string;
  voice:             string;   // legacy V1 — mapped to voiceProfile in V2
  style:             string;   // Video Style
  status:            ContentStatus;
  outputLink:        string;
  tiktokStatus:      PlatformStatus;
  tiktokLink:        string;
  youtubeStatus:     PlatformStatus;
  youtubeLink:       string;
  instagramStatus:   PlatformStatus;
  instagramLink:     string;
  facebookStatus:    PlatformStatus;
  facebookLink:      string;
  dateScheduled:     string;
  timeScheduled:     string;
  performance:       string;
  avatarUrl:         string;

  // ── V2 Advanced Cinematic Fields (optional — only populated in v2-advanced schema) ──

  // Core Content DNA
  coreAngle?:          string;  // myth-bust | stat-first | story-arc | problem-first
  hookStrategy?:       string;  // question | bold-statement | conflict | promise | shock | story
  emotionalTrigger?:   string;  // free text: "anxiety about being left behind"
  storyArc?:           string;  // same options as coreAngle
  ctaStyle?:           string;  // follow | save | comment | share

  // Creator Identity
  creatorPersona?:     string;  // "25yo productivity obsessive at cluttered home desk"
  creatorEnergy?:      string;  // "confessional and raw"
  creatorArchetype?:   string;  // "burned-out corporate escapee"
  cameraStyle?:        string;  // "handheld self-film"
  voiceProfile?:       string;  // ElevenLabs alias: "bright friendly", "female calm", etc.
  speakingStyle?:      string;  // "conversational", "punchy", "documentary"

  // Visual Cinematic Control
  visualIdentity?:     string;  // dark-cinematic | bright-minimal | neon-tech | warm-story | high-contrast
  lightingStyle?:      string;  // "laptop screen glow in dark room"
  motionStyle?:        string;  // "handheld drift", "slow dolly", "locked with lens breathing"
  environmentStyle?:   string;  // "cluttered home desk", "parked car in rain"
  pacingProfile?:      string;  // fast | medium | slow | dynamic
  colorMood?:          string;  // "deep charcoal + cold blue"
  shotLanguage?:       string;  // "ECU → CU → MS → MCU → CU"

  // Storyboard System
  sceneCount?:         number;  // 3 | 4 | 5
  hookScenePrompt?:    string;  // optional scene-level visual prompt seed
  revealScenePrompt?:  string;
  insightScenePrompt?: string;
  proofScenePrompt?:   string;
  ctaScenePrompt?:     string;

  // Veo Generation
  veoPromptStrategy?:  string;  // "maximize realism", "UGC handheld"
  motionIntensity?:    string;  // subtle | medium | high
  cameraMotion?:       string;  // handheld | locked | dolly | tracking
  realismLevel?:       string;  // ultra-realistic | stylized | documentary
  ugcStyle?:           string;  // creator-pov | documentary | confessional | lifestyle
  fallbackStyle?:      string;  // gradient-dark | gradient-warm | imagen3

  // Voice + Script
  narrationStyle?:     string;  // confessional | punchy | documentary | conversational
  speechCadence?:      string;  // slow | medium | fast | dynamic
  emphasisStyle?:      string;  // caps-key-words | measured | explosive
  captionStyle?:       string;  // impact | word-by-word | slide-up | pulse | auto

  // Per-stage observability
  storyboardStatus?:   string;
  scriptStatus?:       string;
  voiceStatus?:        string;
  veoStatus?:          string;
  renderStatus?:       string;
  approvalStatus?:     string;
  publishStatus?:      string;
}

// ─── V1 Column Map (Sheet1 / "Content Pipeline") — 21 cols A–U ───────────────

const COL = {
  topic:           "A",
  script:          "B",
  hookA:           "C",
  hookB:           "D",
  hookC:           "E",
  voice:           "F",
  style:           "G",
  status:          "H",
  outputLink:      "I",
  tiktokStatus:    "J",
  tiktokLink:      "K",
  youtubeStatus:   "L",
  youtubeLink:     "M",
  instagramStatus: "N",
  instagramLink:   "O",
  facebookStatus:  "P",
  facebookLink:    "Q",
  dateScheduled:   "R",
  timeScheduled:   "S",
  performance:     "T",
  avatarUrl:       "U",
} as const;

const LAST_COL_V1 = "U";

// ─── V2 Advanced Column Map — 56 cols A–BD ────────────────────────────────────
// 0-indexed positions match the Sheets API values array.
// Columns: A(0) B(1) C(2) ... Z(25) AA(26) AB(27) AC(28) ... AZ(51) BA(52) BB(53) BC(54) BD(55)

const V2_COL = {
  // Identity
  rowId:              "A",   // 0
  topic:              "B",   // 1

  // Core Content DNA
  coreAngle:          "C",   // 2  — myth-bust | stat-first | story-arc | problem-first
  hookStrategy:       "D",   // 3  — question | bold-statement | conflict | promise | shock | story
  emotionalTrigger:   "E",   // 4  — free text
  storyArc:           "F",   // 5  — same values as coreAngle
  ctaStyle:           "G",   // 6  — follow | save | comment | share
  videoStyle:         "H",   // 7  — Educational | Motivational | Case Study | Lifestyle | Startup

  // Creator Identity
  creatorPersona:     "I",   // 8  — "25yo productivity obsessive at cluttered home desk"
  creatorEnergy:      "J",   // 9  — "confessional and raw"
  creatorArchetype:   "K",   // 10 — "burned-out corporate escapee"
  cameraStyle:        "L",   // 11 — "handheld self-film"
  voiceProfile:       "M",   // 12 — ElevenLabs alias: "bright friendly"
  speakingStyle:      "N",   // 13 — "conversational punchy"
  avatarUrl:          "O",   // 14 — D-ID lipsync avatar image URL

  // Visual Cinematic Control
  visualIdentity:     "P",   // 15 — dark-cinematic | bright-minimal | neon-tech | warm-story | high-contrast
  lightingStyle:      "Q",   // 16 — "laptop screen glow in dark room"
  motionStyle:        "R",   // 17 — "handheld drift"
  environmentStyle:   "S",   // 18 — "cluttered home desk"
  pacingProfile:      "T",   // 19 — fast | medium | slow | dynamic
  colorMood:          "U",   // 20 — "deep charcoal + cold blue"
  shotLanguage:       "V",   // 21 — "ECU → CU → MS → MCU"

  // Storyboard System
  sceneCount:         "W",   // 22 — 3 | 4 | 5
  hookScenePrompt:    "X",   // 23 — optional visual prompt seed (Gemini expands)
  revealScenePrompt:  "Y",   // 24
  insightScenePrompt: "Z",   // 25
  proofScenePrompt:   "AA",  // 26
  ctaScenePrompt:     "AB",  // 27

  // Veo Generation
  veoPromptStrategy:  "AC",  // 28 — "maximize realism", "UGC handheld"
  motionIntensity:    "AD",  // 29 — subtle | medium | high
  cameraMotion:       "AE",  // 30 — handheld | locked | dolly | tracking
  realismLevel:       "AF",  // 31 — ultra-realistic | stylized | documentary
  ugcStyle:           "AG",  // 32 — creator-pov | documentary | confessional | lifestyle
  fallbackStyle:      "AH",  // 33 — gradient-dark | gradient-warm | imagen3

  // Voice + Script
  narrationStyle:     "AI",  // 34 — confessional | punchy | documentary | conversational
  speechCadence:      "AJ",  // 35 — slow | medium | fast | dynamic
  emphasisStyle:      "AK",  // 36 — caps-key-words | measured | explosive
  captionStyle:       "AL",  // 37 — impact | word-by-word | slide-up | pulse | auto

  // Hooks
  hookA:              "AM",  // 38
  hookB:              "AN",  // 39
  hookC:              "AO",  // 40

  // Pipeline Observability (per-stage)
  storyboardStatus:   "AP",  // 41
  scriptStatus:       "AQ",  // 42
  voiceStatus:        "AR",  // 43
  veoStatus:          "AS",  // 44
  renderStatus:       "AT",  // 45
  approvalStatus:     "AU",  // 46
  publishStatus:      "AV",  // 47

  // Output + Master Pipeline
  status:             "AW",  // 48 — master pipeline status
  workerJobId:        "AX",  // 49
  scheduledAt:        "AY",  // 50
  script:             "AZ",  // 51 — full script (AI-generated)
  outputLink:         "BA",  // 52 — R2 / CDN URL of final video
  driveLink:          "BB",  // 53 — Google Drive link

  // Performance
  performance:        "BC",  // 54
  notes:              "BD",  // 55 — error messages / internal notes
} as const;

const LAST_COL_V2 = "BD";

// 0-indexed positions for parseRow() array access
const V2_IDX = {
  topic:              1,
  coreAngle:          2,
  hookStrategy:       3,
  emotionalTrigger:   4,
  storyArc:           5,
  ctaStyle:           6,
  videoStyle:         7,
  creatorPersona:     8,
  creatorEnergy:      9,
  creatorArchetype:  10,
  cameraStyle:       11,
  voiceProfile:      12,
  speakingStyle:     13,
  avatarUrl:         14,
  visualIdentity:    15,
  lightingStyle:     16,
  motionStyle:       17,
  environmentStyle:  18,
  pacingProfile:     19,
  colorMood:         20,
  shotLanguage:      21,
  sceneCount:        22,
  hookScenePrompt:   23,
  revealScenePrompt: 24,
  insightScenePrompt:25,
  proofScenePrompt:  26,
  ctaScenePrompt:    27,
  veoPromptStrategy: 28,
  motionIntensity:   29,
  cameraMotion:      30,
  realismLevel:      31,
  ugcStyle:          32,
  fallbackStyle:     33,
  narrationStyle:    34,
  speechCadence:     35,
  emphasisStyle:     36,
  captionStyle:      37,
  hookA:             38,
  hookB:             39,
  hookC:             40,
  storyboardStatus:  41,
  scriptStatus:      42,
  voiceStatus:       43,
  veoStatus:         44,
  renderStatus:      45,
  approvalStatus:    46,
  publishStatus:     47,
  status:            48,
  workerJobId:       49,
  scheduledAt:       50,
  script:            51,
  outputLink:        52,
  driveLink:         53,
  performance:       54,
  notes:             55,
} as const;

// V1 header row written on initializeSheet() for new sheets
const HEADER_ROW = [
  "Topic", "Script",
  "Hook A", "Hook B", "Hook C",
  "Voice", "Style",
  "Status", "Output Link",
  "TikTok Status", "TikTok Link",
  "YouTube Status", "YouTube Link",
  "Instagram Status", "Instagram Link",
  "Facebook Status", "Facebook Link",
  "Date Scheduled", "Time Scheduled",
  "Performance",
  "Avatar URL",
];

// ─── Auth ─────────────────────────────────────────────────────────────────────

const TOKEN_PATH        = path.resolve(process.cwd(), ".oauth-token.json");
const CLIENT_SECRET_PATH = path.resolve(process.cwd(), "client_secret.json");
const SCOPES            = ["https://www.googleapis.com/auth/spreadsheets"];

// ─── Client ───────────────────────────────────────────────────────────────────

export class SheetsClient {
  private sheets!: sheets_v4.Sheets;
  private spreadsheetId: string;
  private sheetName: string;
  protected readonly schema: "v1" | "v2-advanced";
  protected readonly dataStartRow: number;

  constructor(sheetName = "Sheet1", schema: "v1" | "v2-advanced" = "v1") {
    const config = getConfig();
    this.spreadsheetId = config.google.spreadsheetId;
    this.sheetName  = sheetName;
    this.schema     = schema;
    // V2 sheet has 3 header rows (section labels / column names / descriptions); data at row 4
    this.dataStartRow = schema === "v2-advanced" ? 4 : 2;
  }

  /**
   * Initialize auth — must be called before any sheet operations.
   * Auto-detects: service account → OAuth2 env vars → OAuth2 client secret → error.
   */
  async connect(): Promise<void> {
    const config = getConfig();
    let auth: Auth.GoogleAuth | OAuth2Client;

    if (config.google.serviceAccountEmail && config.google.privateKey) {
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: config.google.serviceAccountEmail,
          private_key:  config.google.privateKey,
        },
        scopes: SCOPES,
      });
      this.sheets = google.sheets({ version: "v4", auth });
      return;
    }

    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (clientId && clientSecret && refreshToken) {
      const oauth2Client = new OAuth2Client(clientId, clientSecret, "http://localhost:3333");
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      this.sheets = google.sheets({ version: "v4", auth: oauth2Client });
      return;
    }

    if (fs.existsSync(CLIENT_SECRET_PATH)) {
      const oauth2Client = await this.getOAuth2Client();
      this.sheets = google.sheets({ version: "v4", auth: oauth2Client });
      return;
    }

    throw new Error(
      "No Google credentials found.\n" +
      "Option A: Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY in .env\n" +
      "Option B: Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN in .env\n" +
      "Option C: Save client_secret.json in project root and run: npx tsx src/cli/auth-google.ts"
    );
  }

  private async getOAuth2Client(): Promise<OAuth2Client> {
    const secret  = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, "utf-8"));
    const { client_id, client_secret, redirect_uris } = secret.installed || secret.web;
    const oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris?.[0] || "http://localhost:3333");

    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      oauth2Client.setCredentials(token);
      const expiry = token.expiry_date ? new Date(token.expiry_date) : null;
      if (!expiry || expiry <= new Date()) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));
      }
      return oauth2Client;
    }

    const authUrl = oauth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES });
    console.log("\n─────────────────────────────────────────────────");
    console.log("GOOGLE AUTH REQUIRED — open this URL in your browser:");
    console.log(authUrl);
    console.log("─────────────────────────────────────────────────\n");

    const code = await new Promise<string>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const qs  = url.parse(req.url || "", true).query;
        const code = qs.code as string;
        res.end("<h2>Ottoflow authenticated ✅ You can close this tab.</h2>");
        server.close();
        if (code) resolve(code); else reject(new Error("No code in redirect"));
      });
      server.listen(3333, () => console.log("Waiting for Google login on http://localhost:3333 ..."));
      setTimeout(() => { server.close(); reject(new Error("Auth timeout (5 min)")); }, 300000);
    });

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log("✅ Google auth saved to .oauth-token.json\n");
    return oauth2Client;
  }

  // ─── Sheet lifecycle ────────────────────────────────────────────────────────

  private async detectSheetName(): Promise<void> {
    if (this.sheetName !== "Sheet1") return;
    const meta = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
    const firstSheet = meta.data.sheets?.[0]?.properties?.title;
    if (firstSheet) this.sheetName = firstSheet;
  }

  private async ensureSheetExists(): Promise<void> {
    const meta   = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
    const exists = meta.data.sheets?.some((s) => s.properties?.title === this.sheetName);
    if (!exists) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: this.sheetName } } }] },
      });
      console.log(`[sheets] Created tab: ${this.sheetName}`);
    }
  }

  async initializeSheet(): Promise<void> {
    await this.connect();
    await this.ensureSheetExists();
    await this.detectSheetName();

    // V2 sheet headers are managed by the Apps Script setup — don't overwrite
    if (this.schema === "v2-advanced") return;

    const range = `${this.sheetName}!A1:${LAST_COL_V1}1`;
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId, range,
      });
      const existing = res.data.values?.[0] ?? [];
      if (existing.length >= HEADER_ROW.length) return;
    } catch { /* sheet may not exist yet */ }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_ROW] },
    });
  }

  // ─── Read ───────────────────────────────────────────────────────────────────

  async getAllContent(): Promise<ContentRow[]> {
    const lastCol = this.schema === "v2-advanced" ? LAST_COL_V2 : LAST_COL_V1;
    const range   = `${this.sheetName}!A${this.dataStartRow}:${lastCol}`;
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId, range,
    });
    const start = this.dataStartRow;
    return (res.data.values || []).map((row, i) => this.parseRow(row, i + start));
  }

  async getPendingContent(): Promise<ContentRow[]> {
    const all = await this.getAllContent();
    return all.filter(
      (r) => r.status.toLowerCase() === "pending" && r.topic.trim() !== ""
    );
  }

  // ─── Write: Script + Hooks ──────────────────────────────────────────────────

  async updateScript(
    rowIndex: number,
    script: string,
    hookA: string,
    hookB: string,
    hookC: string
  ): Promise<void> {
    const scriptCol = this.schema === "v2-advanced" ? V2_COL.script : COL.script;
    const hookACol  = this.schema === "v2-advanced" ? V2_COL.hookA  : COL.hookA;
    const hookBCol  = this.schema === "v2-advanced" ? V2_COL.hookB  : COL.hookB;
    const hookCCol  = this.schema === "v2-advanced" ? V2_COL.hookC  : COL.hookC;
    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `${this.sheetName}!${scriptCol}${rowIndex}`, values: [[script]] },
          { range: `${this.sheetName}!${hookACol}${rowIndex}`,  values: [[hookA]] },
          { range: `${this.sheetName}!${hookBCol}${rowIndex}`,  values: [[hookB]] },
          { range: `${this.sheetName}!${hookCCol}${rowIndex}`,  values: [[hookC]] },
        ],
      },
    });
  }

  // ─── Write: Master Pipeline Status ─────────────────────────────────────────

  async updateStatus(rowIndex: number, status: ContentStatus, errorMsg?: string): Promise<void> {
    const statusCol = this.schema === "v2-advanced" ? V2_COL.status : COL.status;
    const errorCol  = this.schema === "v2-advanced" ? V2_COL.notes  : COL.performance;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!${statusCol}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[status]] },
    });

    if (errorMsg) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${errorCol}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [[`ERROR: ${errorMsg.slice(0, 500)}`]] },
      });
    }
  }

  // ─── Write: Granular Per-Stage Status (V2 only) ─────────────────────────────

  async updateStageStatus(
    rowIndex: number,
    stage: "storyboard" | "script" | "voice" | "veo" | "render" | "approval" | "publish",
    status: StageStatus
  ): Promise<void> {
    if (this.schema !== "v2-advanced") return;

    const colMap: Record<string, string> = {
      storyboard: V2_COL.storyboardStatus,
      script:     V2_COL.scriptStatus,
      voice:      V2_COL.voiceStatus,
      veo:        V2_COL.veoStatus,
      render:     V2_COL.renderStatus,
      approval:   V2_COL.approvalStatus,
      publish:    V2_COL.publishStatus,
    };
    const col = colMap[stage];
    if (!col) return;

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!${col}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[status]] },
    }).catch((err: unknown) => {
      console.warn(`[sheets] updateStageStatus(${stage}=${status}) failed: ${err instanceof Error ? err.message : err}`);
    });
  }

  // ─── Write: Worker Job ID (V2 only) ─────────────────────────────────────────

  async updateWorkerJobId(rowIndex: number, jobId: string): Promise<void> {
    if (this.schema !== "v2-advanced") return;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!${V2_COL.workerJobId}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[jobId]] },
    }).catch((err: unknown) => {
      console.warn(`[sheets] updateWorkerJobId failed: ${err instanceof Error ? err.message : err}`);
    });
  }

  // ─── Write: Mark complete ────────────────────────────────────────────────────

  async markComplete(rowIndex: number, outputLink: string): Promise<void> {
    const statusCol = this.schema === "v2-advanced" ? V2_COL.status    : COL.status;
    const outputCol = this.schema === "v2-advanced" ? V2_COL.outputLink : COL.outputLink;
    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `${this.sheetName}!${statusCol}${rowIndex}`, values: [["Done"]] },
          { range: `${this.sheetName}!${outputCol}${rowIndex}`, values: [[outputLink]] },
        ],
      },
    });
  }

  // ─── Write: Platform status ──────────────────────────────────────────────────

  async updatePlatform(
    rowIndex: number,
    platform: "tiktok" | "youtube" | "instagram" | "facebook",
    status: PlatformStatus,
    link = ""
  ): Promise<void> {
    const statusCol = {
      tiktok:    COL.tiktokStatus,
      youtube:   COL.youtubeStatus,
      instagram: COL.instagramStatus,
      facebook:  COL.facebookStatus,
    }[platform];

    const linkCol = {
      tiktok:    COL.tiktokLink,
      youtube:   COL.youtubeLink,
      instagram: COL.instagramLink,
      facebook:  COL.facebookLink,
    }[platform];

    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `${this.sheetName}!${statusCol}${rowIndex}`, values: [[status]] },
          { range: `${this.sheetName}!${linkCol}${rowIndex}`,   values: [[link]] },
        ],
      },
    });
  }

  async clearPerformance(rowIndex: number): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!${COL.performance}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[""]] },
    });
  }

  async clearAllContent(): Promise<void> {
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A2:U500`,
    });
  }

  // ─── Write: Append new topic row ─────────────────────────────────────────────

  async appendRow(row: {
    topic:              string;
    style?:             string;
    voice?:             string;
    status?:            string;
    // Optional cinematic fields for V2 row pre-fill
    coreAngle?:         string;
    hookStrategy?:      string;
    creatorPersona?:    string;
    visualIdentity?:    string;
    emotionalTrigger?:  string;
  }): Promise<number> {
    if (this.schema !== "v2-advanced") {
      return this.addContent({
        topic: row.topic,
        style: row.style || "Educational",
        voice: row.voice || "Female energetic",
      });
    }

    // 56-column V2 sparse array (indices 0-55, columns A-BD)
    const sparse = Array(56).fill("") as string[];
    sparse[V2_IDX.topic]         = row.topic;
    sparse[V2_IDX.videoStyle]    = row.style            || "Educational";
    sparse[V2_IDX.voiceProfile]  = row.voice            || "bright friendly";
    sparse[V2_IDX.coreAngle]     = row.coreAngle        || "";
    sparse[V2_IDX.hookStrategy]  = row.hookStrategy     || "";
    sparse[V2_IDX.emotionalTrigger] = row.emotionalTrigger || "";
    sparse[V2_IDX.creatorPersona] = row.creatorPersona  || "";
    sparse[V2_IDX.visualIdentity] = row.visualIdentity  || "";
    sparse[V2_IDX.status]        = row.status           || "Pending";

    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:${LAST_COL_V2}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [sparse] },
    });

    const updated = res.data.updates?.updatedRange || "";
    const match   = updated.match(/!A(\d+)/);
    return match ? parseInt(match[1]) : -1;
  }

  // ─── Write: Add V1 content row ───────────────────────────────────────────────

  async addContent(row: Partial<ContentRow>): Promise<number> {
    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:${LAST_COL_V1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          row.topic            || "",
          row.script           || "",
          row.hookA            || "",
          row.hookB            || "",
          row.hookC            || "",
          row.voice            || "Female energetic",
          row.style            || "Educational",
          "Pending",
          "",
          "Pending", "",
          "Pending", "",
          "Pending", "",
          "Pending", "",
          row.dateScheduled   || "",
          row.timeScheduled   || "",
          "",
          row.avatarUrl       || "",
        ]],
      },
    });

    const updated = res.data.updates?.updatedRange || "";
    const match = updated.match(/!A(\d+)/);
    return match ? parseInt(match[1]) : -1;
  }

  // ─── Parse ───────────────────────────────────────────────────────────────────

  private parseRow(row: string[], rowIndex: number): ContentRow {
    const g = (idx: number) => row[idx] || "";

    if (this.schema === "v2-advanced") {
      return {
        rowIndex,
        topic:   g(V2_IDX.topic),
        script:  g(V2_IDX.script),
        hookA:   g(V2_IDX.hookA),
        hookB:   g(V2_IDX.hookB),
        hookC:   g(V2_IDX.hookC),
        voice:   g(V2_IDX.voiceProfile) || "bright friendly",
        style:   g(V2_IDX.videoStyle)   || "Educational",
        status:  (g(V2_IDX.status)      || "Pending") as ContentStatus,
        outputLink:      g(V2_IDX.outputLink),
        tiktokStatus:    "Pending" as PlatformStatus,
        tiktokLink:      "",
        youtubeStatus:   "Pending" as PlatformStatus,
        youtubeLink:     "",
        instagramStatus: "Pending" as PlatformStatus,
        instagramLink:   "",
        facebookStatus:  "Pending" as PlatformStatus,
        facebookLink:    "",
        dateScheduled:   g(V2_IDX.scheduledAt),
        timeScheduled:   "",
        performance:     g(V2_IDX.performance),
        avatarUrl:       g(V2_IDX.avatarUrl),

        // Core Content DNA
        coreAngle:          g(V2_IDX.coreAngle),
        hookStrategy:       g(V2_IDX.hookStrategy),
        emotionalTrigger:   g(V2_IDX.emotionalTrigger),
        storyArc:           g(V2_IDX.storyArc),
        ctaStyle:           g(V2_IDX.ctaStyle),

        // Creator Identity
        creatorPersona:     g(V2_IDX.creatorPersona),
        creatorEnergy:      g(V2_IDX.creatorEnergy),
        creatorArchetype:   g(V2_IDX.creatorArchetype),
        cameraStyle:        g(V2_IDX.cameraStyle),
        voiceProfile:       g(V2_IDX.voiceProfile),
        speakingStyle:      g(V2_IDX.speakingStyle),

        // Visual Cinematic Control
        visualIdentity:     g(V2_IDX.visualIdentity),
        lightingStyle:      g(V2_IDX.lightingStyle),
        motionStyle:        g(V2_IDX.motionStyle),
        environmentStyle:   g(V2_IDX.environmentStyle),
        pacingProfile:      g(V2_IDX.pacingProfile),
        colorMood:          g(V2_IDX.colorMood),
        shotLanguage:       g(V2_IDX.shotLanguage),

        // Storyboard System
        sceneCount:         g(V2_IDX.sceneCount) ? parseInt(g(V2_IDX.sceneCount)) : undefined,
        hookScenePrompt:    g(V2_IDX.hookScenePrompt)    || undefined,
        revealScenePrompt:  g(V2_IDX.revealScenePrompt)  || undefined,
        insightScenePrompt: g(V2_IDX.insightScenePrompt) || undefined,
        proofScenePrompt:   g(V2_IDX.proofScenePrompt)   || undefined,
        ctaScenePrompt:     g(V2_IDX.ctaScenePrompt)     || undefined,

        // Veo Generation
        veoPromptStrategy:  g(V2_IDX.veoPromptStrategy)  || undefined,
        motionIntensity:    g(V2_IDX.motionIntensity)     || undefined,
        cameraMotion:       g(V2_IDX.cameraMotion)        || undefined,
        realismLevel:       g(V2_IDX.realismLevel)        || undefined,
        ugcStyle:           g(V2_IDX.ugcStyle)            || undefined,
        fallbackStyle:      g(V2_IDX.fallbackStyle)       || undefined,

        // Voice + Script
        narrationStyle:     g(V2_IDX.narrationStyle)      || undefined,
        speechCadence:      g(V2_IDX.speechCadence)       || undefined,
        emphasisStyle:      g(V2_IDX.emphasisStyle)        || undefined,
        captionStyle:       g(V2_IDX.captionStyle)         || undefined,

        // Per-stage observability
        storyboardStatus:   g(V2_IDX.storyboardStatus)    || undefined,
        scriptStatus:       g(V2_IDX.scriptStatus)         || undefined,
        voiceStatus:        g(V2_IDX.voiceStatus)          || undefined,
        veoStatus:          g(V2_IDX.veoStatus)            || undefined,
        renderStatus:       g(V2_IDX.renderStatus)         || undefined,
        approvalStatus:     g(V2_IDX.approvalStatus)       || undefined,
        publishStatus:      g(V2_IDX.publishStatus)        || undefined,
      };
    }

    // V1 schema
    return {
      rowIndex,
      topic:           g(0),
      script:          g(1),
      hookA:           g(2),
      hookB:           g(3),
      hookC:           g(4),
      voice:           g(5)  || "Female energetic",
      style:           g(6)  || "Educational",
      status:          (g(7) || "Pending") as ContentStatus,
      outputLink:      g(8),
      tiktokStatus:    (g(9)  || "Pending") as PlatformStatus,
      tiktokLink:      g(10),
      youtubeStatus:   (g(11) || "Pending") as PlatformStatus,
      youtubeLink:     g(12),
      instagramStatus: (g(13) || "Pending") as PlatformStatus,
      instagramLink:   g(14),
      facebookStatus:  (g(15) || "Pending") as PlatformStatus,
      facebookLink:    g(16),
      dateScheduled:   g(17),
      timeScheduled:   g(18),
      performance:     g(19),
      avatarUrl:       g(20),
    };
  }
}

// Re-export for backward-compatibility
export type { ContentRow as ProductRow };
