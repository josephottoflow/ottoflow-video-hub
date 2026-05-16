/**
 * GOOGLE SHEETS AGENT — Ottoflow Video Hub Content Queue
 * Text + script driven. No image folders — backgrounds from Pexels.
 * Tracks per-platform status and output links independently.
 *
 * Columns A–T:
 * A  Topic              B  Script
 * C  Hook A             D  Hook B             E  Hook C
 * F  Voice              G  Style
 * H  Status             I  Output Link
 * J  TikTok Status      K  TikTok Link
 * L  YouTube Status     M  YouTube Link
 * N  Instagram Status   O  Instagram Link
 * P  Facebook Status    Q  Facebook Link
 * R  Date Scheduled     S  Time Scheduled     T  Performance
 */

import { google, sheets_v4, Auth } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as url from "url";
import { getConfig } from "../config/config";

// === Types ===

export type ContentStatus =
  | "Pending"
  | "Queued"       // job added to BullMQ, waiting for worker
  | "Processing"
  | "Rendering"
  | "Approval"
  | "Exporting"
  | "Done"
  | "Rejected"
  | "Error";

export type PlatformStatus = "Pending" | "Uploaded" | "Scheduled" | "Live" | "Error";

export interface ContentRow {
  rowIndex:         number;
  topic:            string;
  script:           string;
  hookA:            string;
  hookB:            string;
  hookC:            string;
  voice:            string;   // e.g. "Female energetic"
  style:            string;   // e.g. "Educational", "Motivational", "Case Study"
  status:           ContentStatus;
  outputLink:       string;
  tiktokStatus:     PlatformStatus;
  tiktokLink:       string;
  youtubeStatus:    PlatformStatus;
  youtubeLink:      string;
  instagramStatus:  PlatformStatus;
  instagramLink:    string;
  facebookStatus:   PlatformStatus;
  facebookLink:     string;
  dateScheduled:    string;
  timeScheduled:    string;
  performance:      string;
  avatarUrl:        string;  // face image URL for D-ID lipsync (col U)
}

// === Column Map ===

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

const LAST_COL = "U";

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

// === Client ===

// Path where OAuth2 tokens are cached after first login
const TOKEN_PATH = path.resolve(process.cwd(), ".oauth-token.json");
// Path where the downloaded OAuth2 client secret JSON lives
const CLIENT_SECRET_PATH = path.resolve(process.cwd(), "client_secret.json");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export class SheetsClient {
  private sheets!: sheets_v4.Sheets;
  private spreadsheetId: string;
  private sheetName: string;

  constructor(sheetName = "Sheet1") {
    const config = getConfig();
    this.spreadsheetId = config.google.spreadsheetId;
    this.sheetName = sheetName;
  }

  /**
   * Initialize auth — must be called before any sheet operations.
   * Auto-detects: service account → OAuth2 client secret → error.
   */
  async connect(): Promise<void> {
    const config = getConfig();
    let auth: Auth.GoogleAuth | OAuth2Client;

    if (config.google.serviceAccountEmail && config.google.privateKey) {
      // Service account path
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

    // OAuth2 via env vars (Vercel-friendly — no local file needed)
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
      // OAuth2 path — uses downloaded client_secret.json (local dev)
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

  /**
   * Get an authorized OAuth2 client.
   * On first run: opens browser for user login and saves token.
   * On subsequent runs: loads cached token from .oauth-token.json.
   */
  private async getOAuth2Client(): Promise<OAuth2Client> {
    const secret  = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, "utf-8"));
    const { client_id, client_secret, redirect_uris } = secret.installed || secret.web;
    const oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris?.[0] || "http://localhost:3333");

    // Load cached token if available
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      oauth2Client.setCredentials(token);
      // Refresh if expired
      const expiry = token.expiry_date ? new Date(token.expiry_date) : null;
      if (!expiry || expiry <= new Date()) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));
      }
      return oauth2Client;
    }

    // First time — open browser for login
    const authUrl = oauth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES });
    console.log("\n─────────────────────────────────────────────────");
    console.log("GOOGLE AUTH REQUIRED — open this URL in your browser:");
    console.log(authUrl);
    console.log("─────────────────────────────────────────────────\n");

    // Start a local server to catch the redirect
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

  // === Auto-detect first sheet tab name ===

  private async detectSheetName(): Promise<void> {
    // Only auto-detect when using the default tab — never override an explicitly named sheet
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

  // === Initialize headers if empty ===

  async initializeSheet(): Promise<void> {
    await this.connect();
    await this.ensureSheetExists();
    await this.detectSheetName();
    const range = `${this.sheetName}!A1:${LAST_COL}1`;
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId, range,
      });
      if (res.data.values?.length) return;
    } catch { /* sheet may not exist yet */ }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_ROW] },
    });
  }

  // === Read all rows ===

  async getAllContent(): Promise<ContentRow[]> {
    const range = `${this.sheetName}!A2:${LAST_COL}`;
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId, range,
    });
    return (res.data.values || []).map((row, i) => this.parseRow(row, i + 2));
  }

  // === Get rows ready to process ===

  async getPendingContent(): Promise<ContentRow[]> {
    const all = await this.getAllContent();
    return all.filter(
      (r) => r.status.toLowerCase() === "pending" && r.topic.trim() !== ""
    );
  }

  // === Write generated script + hooks back to the sheet ===

  async updateScript(
    rowIndex: number,
    script: string,
    hookA: string,
    hookB: string,
    hookC: string
  ): Promise<void> {
    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `${this.sheetName}!${COL.script}${rowIndex}`, values: [[script]] },
          { range: `${this.sheetName}!${COL.hookA}${rowIndex}`,  values: [[hookA]] },
          { range: `${this.sheetName}!${COL.hookB}${rowIndex}`,  values: [[hookB]] },
          { range: `${this.sheetName}!${COL.hookC}${rowIndex}`,  values: [[hookC]] },
        ],
      },
    });
  }

  // === Update master status ===

  async updateStatus(rowIndex: number, status: ContentStatus, errorMsg?: string): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!${COL.status}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [[status]] },
    });

    if (errorMsg) {
      // Write error into Performance column for visibility
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${COL.performance}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values: [[`ERROR: ${errorMsg}`]] },
      });
    }
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
      range: `${this.sheetName}!A2:T500`,
    });
  }

  // === Update platform-specific status + link ===

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

  // === Mark fully complete ===

  async markComplete(rowIndex: number, outputLink: string): Promise<void> {
    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `${this.sheetName}!${COL.status}${rowIndex}`,     values: [["Done"]] },
          { range: `${this.sheetName}!${COL.outputLink}${rowIndex}`,  values: [[outputLink]] },
        ],
      },
    });
  }

  // === Add a new content row ===

  async addContent(row: Partial<ContentRow>): Promise<number> {
    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:${LAST_COL}`,
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
          "Pending",           // status
          "",                  // outputLink
          "Pending",           // tiktokStatus
          "",                  // tiktokLink
          "Pending",           // youtubeStatus
          "",                  // youtubeLink
          "Pending",           // instagramStatus
          "",                  // instagramLink
          "Pending",           // facebookStatus
          "",                  // facebookLink
          row.dateScheduled   || "",
          row.timeScheduled   || "",
          "",                  // performance
          row.avatarUrl       || "",  // Avatar URL (col U)
        ]],
      },
    });

    const updated = res.data.updates?.updatedRange || "";
    const match = updated.match(/!A(\d+)/);
    return match ? parseInt(match[1]) : -1;
  }

  // === Parse a raw row array into a typed ContentRow ===

  private parseRow(row: string[], rowIndex: number): ContentRow {
    return {
      rowIndex,
      topic:           row[0]  || "",
      script:          row[1]  || "",
      hookA:           row[2]  || "",
      hookB:           row[3]  || "",
      hookC:           row[4]  || "",
      voice:           row[5]  || "Female energetic",
      style:           row[6]  || "Educational",
      status:          (row[7]  || "Pending") as ContentStatus,
      outputLink:      row[8]  || "",
      tiktokStatus:    (row[9]  || "Pending") as PlatformStatus,
      tiktokLink:      row[10] || "",
      youtubeStatus:   (row[11] || "Pending") as PlatformStatus,
      youtubeLink:     row[12] || "",
      instagramStatus: (row[13] || "Pending") as PlatformStatus,
      instagramLink:   row[14] || "",
      facebookStatus:  (row[15] || "Pending") as PlatformStatus,
      facebookLink:    row[16] || "",
      dateScheduled:   row[17] || "",
      timeScheduled:   row[18] || "",
      performance:     row[19] || "",
      avatarUrl:       row[20] || "",
    };
  }
}

// Re-export ContentRow as ProductRow for backward-compatibility with existing imports
export type { ContentRow as ProductRow };
