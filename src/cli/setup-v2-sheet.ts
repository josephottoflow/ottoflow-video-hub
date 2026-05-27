/**
 * CLI: Set up the "Video Gen — Advance Tier" sheet with the V2 cinematic schema.
 *
 * What it does:
 *  1. Clears and recreates the sheet tab
 *  2. Writes 3 header rows (section / column name / description)
 *  3. Sets column widths and freezes header rows
 *  4. Adds dropdown validation on controlled columns
 *  5. Adds a sample test row (row 4)
 *
 * Usage:
 *   npx tsx src/cli/setup-v2-sheet.ts
 */

import * as dotenv from "dotenv";

import { google, Auth } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as url from "url";

const SHEET_NAME     = "Video Gen — Advance Tier";
const SCOPES         = ["https://www.googleapis.com/auth/spreadsheets"];
const TOKEN_PATH     = path.resolve(process.cwd(), ".oauth-token.json");
const SECRET_PATH    = path.resolve(process.cwd(), "client_secret.json");
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? "";

// ─── Column definitions ─────────────────────────────────────────────────────
// [sectionLabel, columnName, description]
const COLUMNS: [string, string, string][] = [
  // A-B: Identity
  ["IDENTITY",       "Row ID",              "Auto-number or leave blank"],
  ["IDENTITY",       "Topic",               "Specific video topic / angle — the more specific the better"],

  // C-H: Core Content DNA
  ["CORE CONTENT",   "Core Angle",          "myth-bust | stat-first | story-arc | problem-first"],
  ["CORE CONTENT",   "Hook Strategy",       "question | bold-statement | conflict | promise | shock | story"],
  ["CORE CONTENT",   "Emotional Trigger",   "Core emotion to activate (e.g. 'anxiety about being left behind')"],
  ["CORE CONTENT",   "Story Arc",           "Drives 3-beat narrative — same options as Core Angle"],
  ["CORE CONTENT",   "CTA Style",           "follow | save | comment | share"],
  ["CORE CONTENT",   "Video Style",         "Educational | Motivational | Case Study | Lifestyle | Startup-Focused"],

  // I-O: Creator Identity
  ["CREATOR",        "Creator Persona",     "e.g. '25yo productivity obsessive at cluttered home desk'"],
  ["CREATOR",        "Creator Energy",      "e.g. 'confessional and raw' | 'frustrated truth-teller'"],
  ["CREATOR",        "Creator Archetype",   "e.g. 'burned-out corporate escapee' | 'self-taught entrepreneur'"],
  ["CREATOR",        "Camera Style",        "handheld self-film | documentary follow | locked tripod"],
  ["CREATOR",        "Voice Profile",       "bright friendly | female calm | male deep | male warm | etc."],
  ["CREATOR",        "Speaking Style",      "conversational | punchy | documentary | confessional"],
  ["CREATOR",        "Avatar URL",          "Optional: face image URL for D-ID lipsync (leave blank to skip)"],

  // P-V: Visual Cinematic
  ["VISUAL",         "Visual Identity",     "dark-cinematic | bright-minimal | neon-tech | warm-story | high-contrast"],
  ["VISUAL",         "Lighting Style",      "e.g. 'laptop screen glow in dark room' | 'golden hour window'"],
  ["VISUAL",         "Motion Style",        "e.g. 'handheld drift' | 'slow dolly' | 'locked with lens breathing'"],
  ["VISUAL",         "Environment Style",   "e.g. 'cluttered home desk' | 'parked car in rain' | 'kitchen 6am'"],
  ["VISUAL",         "Pacing Profile",      "fast | medium | slow | dynamic"],
  ["VISUAL",         "Color Mood",          "e.g. 'deep charcoal + cold blue' | 'warm amber + shadow'"],
  ["VISUAL",         "Shot Language",       "e.g. 'ECU → CU → MS → MCU → CU'"],

  // W-AB: Storyboard
  ["STORYBOARD",     "Scene Count",         "3 | 4 | 5 — number of Veo scenes"],
  ["STORYBOARD",     "Hook Scene Prompt",   "Optional visual seed for hook scene — Gemini expands this"],
  ["STORYBOARD",     "Reveal Scene Prompt", "Optional visual seed for reveal scene"],
  ["STORYBOARD",     "Insight Scene Prompt","Optional visual seed for insight scene"],
  ["STORYBOARD",     "Proof Scene Prompt",  "Optional visual seed for proof scene"],
  ["STORYBOARD",     "CTA Scene Prompt",    "Optional visual seed for CTA scene"],

  // AC-AH: Veo Generation
  ["VEO",            "Veo Prompt Strategy", "e.g. 'maximize realism' | 'UGC handheld creator POV'"],
  ["VEO",            "Motion Intensity",    "subtle | medium | high"],
  ["VEO",            "Camera Motion",       "handheld | locked | dolly | tracking"],
  ["VEO",            "Realism Level",       "ultra-realistic | stylized | documentary"],
  ["VEO",            "UGC Style",           "creator-pov | documentary | confessional | lifestyle"],
  ["VEO",            "Fallback Style",      "gradient-dark | gradient-warm | imagen3"],

  // AI-AL: Voice + Script
  ["VOICE",          "Narration Style",     "confessional | punchy | documentary | conversational"],
  ["VOICE",          "Speech Cadence",      "slow | medium | fast | dynamic"],
  ["VOICE",          "Emphasis Style",      "caps-key-words | measured | explosive"],
  ["VOICE",          "Caption Style",       "auto | impact | word-by-word | slide-up | pulse"],

  // AM-AO: Hooks
  ["HOOKS",          "Hook A",              "AI-generated or manually written opening hook"],
  ["HOOKS",          "Hook B",              "Alternative hook (different style)"],
  ["HOOKS",          "Hook C",              "Direct you-language challenge"],

  // AP-AV: Pipeline Observability
  ["PIPELINE OBS",   "Storyboard Status",   "Pending | Generating | Done | Error"],
  ["PIPELINE OBS",   "Script Status",       "Pending | Generating | Done | Error"],
  ["PIPELINE OBS",   "Voice Status",        "Pending | Generating | Done | Skipped | Error"],
  ["PIPELINE OBS",   "Veo Status",          "Pending | Generating | Done | Skipped | Error"],
  ["PIPELINE OBS",   "Render Status",       "Pending | Rendering | Done | Error"],
  ["PIPELINE OBS",   "Approval Status",     "Pending | Done | Error"],
  ["PIPELINE OBS",   "Publish Status",      "Pending | Scheduled | Live | Error"],

  // AW-BB: Output
  ["OUTPUT",         "Pipeline Status",     "Pending | Queued | Processing | Rendering | Done | Rejected | Error"],
  ["OUTPUT",         "Worker Job ID",       "BullMQ job ID (auto-filled)"],
  ["OUTPUT",         "Scheduled At",        "ISO timestamp of queue time"],
  ["OUTPUT",         "Script (Full)",       "Final narration script"],
  ["OUTPUT",         "Output Video URL",    "R2 / CDN URL of rendered MP4"],
  ["OUTPUT",         "Drive Link",          "Google Drive share link"],

  // BC-BD: Performance
  ["PERFORMANCE",    "Performance Score",   "Views, saves, engagement rate"],
  ["PERFORMANCE",    "Notes / Errors",      "Error messages and pipeline notes"],
];

const NUM_COLS = COLUMNS.length; // 56

// Section background colors (hex)
const SECTION_BG: Record<string, string> = {
  "IDENTITY":      "#1a1a2e",
  "CORE CONTENT":  "#1e1b4b",
  "CREATOR":       "#14532d",
  "VISUAL":        "#1c1917",
  "STORYBOARD":    "#0c1445",
  "VEO":           "#18181b",
  "VOICE":         "#1f2937",
  "HOOKS":         "#1a1a2e",
  "PIPELINE OBS":  "#14532d",
  "OUTPUT":        "#1e1b4b",
  "PERFORMANCE":   "#18181b",
};

// Section text colors
const SECTION_FG: Record<string, string> = {
  "IDENTITY":      "#a78bfa",
  "CORE CONTENT":  "#818cf8",
  "CREATOR":       "#4ade80",
  "VISUAL":        "#fb923c",
  "STORYBOARD":    "#60a5fa",
  "VEO":           "#e879f9",
  "VOICE":         "#facc15",
  "HOOKS":         "#f472b6",
  "PIPELINE OBS":  "#86efac",
  "OUTPUT":        "#c7d2fe",
  "PERFORMANCE":   "#a1a1aa",
};

function hexToColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { red: r, green: g, blue: b };
}

// ─── Auth ───────────────────────────────────────────────────────────────────

async function getAuth(): Promise<Auth.GoogleAuth | OAuth2Client> {
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (svcEmail && svcKey) {
    return new google.auth.GoogleAuth({
      credentials: { client_email: svcEmail, private_key: svcKey },
      scopes: SCOPES,
    });
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new OAuth2Client(clientId, clientSecret, "http://localhost:3333");
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }

  if (fs.existsSync(SECRET_PATH)) {
    return getOAuthFromFile();
  }

  throw new Error(
    "No Google credentials found. Set GOOGLE_SERVICE_ACCOUNT_EMAIL+GOOGLE_PRIVATE_KEY, " +
    "or GOOGLE_CLIENT_ID+GOOGLE_CLIENT_SECRET+GOOGLE_REFRESH_TOKEN in .env"
  );
}

async function getOAuthFromFile(): Promise<OAuth2Client> {
  const secret = JSON.parse(fs.readFileSync(SECRET_PATH, "utf-8"));
  const { client_id, client_secret, redirect_uris } = secret.installed || secret.web;
  const oauth2 = new OAuth2Client(client_id, client_secret, redirect_uris?.[0] || "http://localhost:3333");

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    oauth2.setCredentials(token);
    const expiry = token.expiry_date ? new Date(token.expiry_date) : null;
    if (!expiry || expiry <= new Date()) {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));
    }
    return oauth2;
  }

  const authUrl = oauth2.generateAuthUrl({ access_type: "offline", scope: SCOPES });
  console.log("\n─────────────────────────────────────────────");
  console.log("Open this URL to authenticate:");
  console.log(authUrl);
  console.log("─────────────────────────────────────────────\n");

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const qs   = url.parse(req.url || "", true).query;
      const code = qs.code as string;
      res.end("<h2>Ottoflow authenticated ✅</h2>");
      server.close();
      if (code) resolve(code); else reject(new Error("No code in redirect"));
    });
    server.listen(3333);
    setTimeout(() => { server.close(); reject(new Error("Auth timeout")); }, 300000);
  });

  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  return oauth2;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!SPREADSHEET_ID) {
    throw new Error("GOOGLE_SPREADSHEET_ID not set in .env");
  }

  console.log("Connecting to Google Sheets...");
  const auth   = await getAuth();
  const sheets = google.sheets({ version: "v4", auth: auth as any });

  // ── 1. Get sheet metadata / find or create the tab ────────────────────────
  const meta     = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = meta.data.sheets?.find(s => s.properties?.title === SHEET_NAME);
  let sheetId: number;

  if (existing) {
    sheetId = existing.properties!.sheetId!;
    console.log(`Found existing tab "${SHEET_NAME}" (sheetId=${sheetId}) — will clear and overwrite`);

    // Clear all content
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A1:BD1000`,
    });
    console.log("Cleared existing content");
  } else {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
    });
    sheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
    console.log(`Created new tab "${SHEET_NAME}" (sheetId=${sheetId})`);
  }

  // ── 2. Write 3 header rows ────────────────────────────────────────────────
  const sectionRow = COLUMNS.map(c => c[0]);
  const nameRow    = COLUMNS.map(c => c[1]);
  const descRow    = COLUMNS.map(c => c[2]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [sectionRow, nameRow, descRow] },
  });
  console.log("Wrote 3 header rows");

  // ── 3. Freeze rows + column ───────────────────────────────────────────────
  const batchRequests: any[] = [];

  // Unmerge ALL cells first — old schema may have merged cells that block freezing
  batchRequests.push({
    unmergeCells: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 100 },
    },
  });

  batchRequests.push({
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: { frozenRowCount: 3, frozenColumnCount: 1 },
      },
      fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
    },
  });

  // ── 4. Row heights ─────────────────────────────────────────────────────────
  [[0, 24], [1, 28], [2, 44]].forEach(([idx, px]) => {
    batchRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    });
  });

  // ── 5. Column widths ───────────────────────────────────────────────────────
  // Wide columns (indices 0-based): topic, persona, energy, archetype, lighting, motion, env, scene prompts, script
  const wideIdx   = new Set([1, 8, 9, 10, 15, 16, 17, 18, 22, 23, 24, 25, 26, 27, 50]);
  const narrowIdx = new Set([0, 40, 41, 42, 43, 44, 45, 46, 47, 48, 53, 54, 55]);

  for (let c = 0; c < NUM_COLS; c++) {
    const px = wideIdx.has(c) ? 220 : narrowIdx.has(c) ? 85 : 115;
    batchRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: c, endIndex: c + 1 },
        properties: { pixelSize: px },
        fields: "pixelSize",
      },
    });
  }

  // ── 6. Header row formatting ───────────────────────────────────────────────
  for (let c = 0; c < NUM_COLS; c++) {
    const section = COLUMNS[c][0];
    const bg = hexToColor(SECTION_BG[section] || "#18181b");
    const fg = hexToColor(SECTION_FG[section] || "#ffffff");

    // Row 1: section label
    batchRequests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: c, endColumnIndex: c + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: bg,
            textFormat: { foregroundColor: fg, bold: true, fontSize: 9 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    });

    // Row 2: column name
    batchRequests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: c, endColumnIndex: c + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: bg,
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
            verticalAlignment: "MIDDLE",
            wrapStrategy: "CLIP",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)",
      },
    });
  }

  // Row 3: descriptions — muted gray
  batchRequests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: NUM_COLS },
      cell: {
        userEnteredFormat: {
          backgroundColor: hexToColor("#111827"),
          textFormat: { foregroundColor: hexToColor("#6b7280"), italic: true, fontSize: 8 },
          verticalAlignment: "MIDDLE",
          wrapStrategy: "WRAP",
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)",
    },
  });

  // ── 7. Data row base formatting (rows 4-200) ───────────────────────────────
  batchRequests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 3, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: NUM_COLS },
      cell: {
        userEnteredFormat: {
          backgroundColor: hexToColor("#0f172a"),
          textFormat: { foregroundColor: hexToColor("#e2e8f0"), fontSize: 10 },
          verticalAlignment: "MIDDLE",
          wrapStrategy: "CLIP",
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)",
    },
  });

  // ── 8. Alternating row bands ──────────────────────────────────────────────
  for (let r = 3; r < 200; r += 2) {
    batchRequests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: NUM_COLS },
        cell: {
          userEnteredFormat: { backgroundColor: hexToColor("#1e293b") },
        },
        fields: "userEnteredFormat.backgroundColor",
      },
    });
  }

  // ── 9. Dropdown validation ────────────────────────────────────────────────
  const dropdowns: Array<{ col: number; values: string[] }> = [
    { col: 2,  values: ["myth-bust","stat-first","story-arc","problem-first"] },           // Core Angle
    { col: 3,  values: ["question","bold-statement","conflict","promise","shock","story"] }, // Hook Strategy
    { col: 5,  values: ["myth-bust","stat-first","story-arc","problem-first"] },           // Story Arc
    { col: 6,  values: ["follow","save","comment","share"] },                               // CTA Style
    { col: 7,  values: ["Educational","Motivational","Case Study","Lifestyle","Startup-Focused","Luxury","Cinematic"] },
    { col: 15, values: ["dark-cinematic","bright-minimal","neon-tech","warm-story","high-contrast"] },
    { col: 19, values: ["fast","medium","slow","dynamic"] },                                // Pacing
    { col: 22, values: ["3","4","5"] },                                                     // Scene Count
    { col: 29, values: ["subtle","medium","high"] },                                        // Motion Intensity
    { col: 30, values: ["handheld","locked","dolly","tracking"] },                          // Camera Motion
    { col: 31, values: ["ultra-realistic","stylized","documentary"] },                       // Realism
    { col: 32, values: ["creator-pov","documentary","confessional","lifestyle"] },          // UGC Style
    { col: 33, values: ["gradient-dark","gradient-warm","imagen3"] },                       // Fallback
    { col: 37, values: ["auto","impact","word-by-word","slide-up","pulse"] },              // Caption Style
    { col: 48, values: ["Pending","Queued","Processing","Rendering","Done","Rejected","Error"] }, // Pipeline Status
  ];

  for (const { col, values } of dropdowns) {
    batchRequests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 3, endRowIndex: 200, startColumnIndex: col, endColumnIndex: col + 1 },
        rule: {
          condition: { type: "ONE_OF_LIST", values: values.map(v => ({ userEnteredValue: v })) },
          showCustomUi: true,
          strict: false,
        },
      },
    });
  }

  // ── Apply all formatting batch ─────────────────────────────────────────────
  console.log(`Applying ${batchRequests.length} formatting requests...`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: batchRequests },
  });
  console.log("Formatting applied");

  // ── 10. Add first test row (row 4) ────────────────────────────────────────
  const testRow = Array(NUM_COLS).fill("") as string[];

  // Identity
  testRow[0]  = "1";                          // Row ID
  testRow[1]  = "Why most people STILL fail at building habits (and the one thing that actually works)";

  // Core Content DNA
  testRow[2]  = "myth-bust";                  // Core Angle
  testRow[3]  = "bold-statement";             // Hook Strategy
  testRow[4]  = "frustration with bad advice that doesn't work in real life";  // Emotional Trigger
  testRow[5]  = "myth-bust";                  // Story Arc
  testRow[6]  = "save";                       // CTA Style
  testRow[7]  = "Educational";               // Video Style

  // Creator Identity
  testRow[8]  = "28yo behavioral psychology nerd at messy home desk with sticky notes everywhere"; // Creator Persona
  testRow[9]  = "frustrated truth-teller — genuinely irritated by the mainstream advice";         // Creator Energy
  testRow[10] = "self-taught researcher who tested everything on themselves";                      // Creator Archetype
  testRow[11] = "handheld self-film";         // Camera Style
  testRow[12] = "bright friendly";            // Voice Profile
  testRow[13] = "confessional punchy";        // Speaking Style

  // Visual Cinematic
  testRow[15] = "dark-cinematic";             // Visual Identity
  testRow[16] = "laptop screen glow as cold blue-white key light in dim room, warm floor lamp creating background separation"; // Lighting
  testRow[17] = "slight natural handheld drift, creator self-film slow push-in 3cm";              // Motion Style
  testRow[18] = "cluttered home desk with psychology books, sticky notes on monitor, cold coffee"; // Environment
  testRow[19] = "dynamic";                    // Pacing Profile
  testRow[20] = "deep charcoal #1a1a2e + monitor cold blue #d4e9ff + warm amber lamp #ffbf00";   // Color Mood
  testRow[21] = "ECU → CU → MS → MCU → CU"; // Shot Language

  // Storyboard
  testRow[22] = "5";                          // Scene Count
  testRow[23] = "Creator mid-rant at desk — jaw tight, laptop open, sticky notes everywhere, laptop glow on frustrated face";
  testRow[24] = "Creator leaning closer to camera with wide eyes, phone screen glow, dim bedroom — surprise/discovery energy";
  testRow[25] = "Slow push-in on creator gesturing with open hands — relaxed posture of someone who figured it out, natural window light";
  testRow[26] = "Creator nodding with conviction at camera — body language of lived experience, home studio in soft focus";
  testRow[27] = "Creator pointing gently at camera with genuine smile — not performed, warm window light from right";

  // Veo Generation
  testRow[28] = "maximize UGC realism — handheld creator POV, natural light only, no studio lighting";  // Veo Strategy
  testRow[29] = "medium";                     // Motion Intensity
  testRow[30] = "handheld";                   // Camera Motion
  testRow[31] = "ultra-realistic";            // Realism Level
  testRow[32] = "creator-pov";               // UGC Style
  testRow[33] = "imagen3";                   // Fallback Style

  // Voice + Script
  testRow[34] = "confessional";              // Narration Style
  testRow[35] = "dynamic";                   // Speech Cadence
  testRow[36] = "caps-key-words";            // Emphasis Style
  testRow[37] = "auto";                      // Caption Style

  // Pipeline Status (all start Pending)
  testRow[48] = "Pending";                   // Master Pipeline Status

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A4`,
    valueInputOption: "RAW",
    requestBody: { values: [testRow] },
  });

  console.log(`\n✅ Sheet setup complete!\n`);
  console.log(`   Sheet: "${SHEET_NAME}"`);
  console.log(`   Columns: ${NUM_COLS} (A–BD)`);
  console.log(`   Header rows: 3 (section labels / column names / descriptions)`);
  console.log(`   Data starts at: row 4`);
  console.log(`   Test row added: row 4 — "Why most people STILL fail at building habits..."`);
  console.log(`\n   Open the sheet to review: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
  console.log(`\n   To queue the test row: POST /api/pipeline/v2 with { rowIndex: 4 }\n`);
}

main().catch((err) => {
  console.error("❌ Error:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
