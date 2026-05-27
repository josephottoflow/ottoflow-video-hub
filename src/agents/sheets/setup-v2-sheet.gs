/**
 * OTTOFLOW V2 SHEET SETUP SCRIPT
 * Paste this into Google Apps Script (Extensions → Apps Script) and run setupAdvancedSheet().
 *
 * What it does:
 *  1. Creates / clears "Video Gen — Advance Tier" tab
 *  2. Writes the 3-row header (section labels / column names / descriptions)
 *  3. Formats sections with distinct background colors
 *  4. Freezes rows 1-3 and column A
 *  5. Sets column widths
 *
 * After running: data rows start at row 4.
 * The TypeScript SheetsClient reads from row 4 onward (dataStartRow = 4).
 */

const SHEET_NAME = "Video Gen — Advance Tier";

// Column layout — 56 columns A(1) through BD(56)
// Each entry: [sectionLabel, columnName, description]
const COLUMNS = [
  // A-B: Identity
  ["IDENTITY",       "Row ID",              "Auto-number or leave blank"],
  ["IDENTITY",       "Topic",               "The specific video topic / angle"],

  // C-H: Core Content DNA
  ["CORE CONTENT",   "Core Angle",          "myth-bust | stat-first | story-arc | problem-first"],
  ["CORE CONTENT",   "Hook Strategy",       "question | bold-statement | conflict | promise | shock | story"],
  ["CORE CONTENT",   "Emotional Trigger",   "The core emotion to activate (e.g. 'anxiety about being left behind')"],
  ["CORE CONTENT",   "Story Arc",           "Same options as Core Angle — drives 3-beat narrative structure"],
  ["CORE CONTENT",   "CTA Style",           "follow | save | comment | share"],
  ["CORE CONTENT",   "Video Style",         "Educational | Motivational | Case Study | Lifestyle | Startup"],

  // I-O: Creator Identity
  ["CREATOR",        "Creator Persona",     "e.g. '25yo productivity obsessive at cluttered home desk'"],
  ["CREATOR",        "Creator Energy",      "e.g. 'confessional and raw' | 'frustrated truth-teller'"],
  ["CREATOR",        "Creator Archetype",   "e.g. 'burned-out corporate escapee' | 'self-taught entrepreneur'"],
  ["CREATOR",        "Camera Style",        "handheld self-film | documentary follow | locked tripod"],
  ["CREATOR",        "Voice Profile",       "ElevenLabs alias: bright friendly | female calm | male deep | etc."],
  ["CREATOR",        "Speaking Style",      "conversational | punchy | documentary | confessional"],
  ["CREATOR",        "Avatar URL",          "Optional: face image URL for D-ID lipsync"],

  // P-V: Visual Cinematic
  ["VISUAL",         "Visual Identity",     "dark-cinematic | bright-minimal | neon-tech | warm-story | high-contrast"],
  ["VISUAL",         "Lighting Style",      "e.g. 'laptop screen glow in dark room' | 'golden hour window'"],
  ["VISUAL",         "Motion Style",        "e.g. 'handheld drift' | 'slow dolly' | 'locked with lens breathing'"],
  ["VISUAL",         "Environment Style",   "e.g. 'cluttered home desk' | 'parked car in rain' | 'kitchen 6am'"],
  ["VISUAL",         "Pacing Profile",      "fast | medium | slow | dynamic"],
  ["VISUAL",         "Color Mood",          "e.g. 'deep charcoal + cold blue' | 'warm amber + shadow'"],
  ["VISUAL",         "Shot Language",       "e.g. 'ECU → CU → MS → MCU → CU'"],

  // W-AB: Storyboard
  ["STORYBOARD",     "Scene Count",         "3 | 4 | 5 — how many Veo scenes to generate"],
  ["STORYBOARD",     "Hook Scene Prompt",   "Optional visual seed for the hook scene — Gemini expands this"],
  ["STORYBOARD",     "Reveal Scene Prompt", "Optional visual seed for the reveal scene"],
  ["STORYBOARD",     "Insight Scene Prompt","Optional visual seed for the insight scene"],
  ["STORYBOARD",     "Proof Scene Prompt",  "Optional visual seed for the proof scene"],
  ["STORYBOARD",     "CTA Scene Prompt",    "Optional visual seed for the CTA scene"],

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
  ["VOICE",          "Caption Style",       "impact | word-by-word | slide-up | pulse | auto"],

  // AM-AO: Hooks
  ["HOOKS",          "Hook A",              "AI-generated or manually written opening hook"],
  ["HOOKS",          "Hook B",              "Alternative hook (different style)"],
  ["HOOKS",          "Hook C",              "Alternative hook (you-language challenge)"],

  // AP-AV: Pipeline Observability
  ["PIPELINE OBS",   "Storyboard Status",  "Pending | Generating | Done | Error"],
  ["PIPELINE OBS",   "Script Status",      "Pending | Generating | Done | Error"],
  ["PIPELINE OBS",   "Voice Status",       "Pending | Generating | Done | Skipped | Error"],
  ["PIPELINE OBS",   "Veo Status",         "Pending | Generating | Done | Skipped | Error"],
  ["PIPELINE OBS",   "Render Status",      "Pending | Rendering | Done | Error"],
  ["PIPELINE OBS",   "Approval Status",    "Pending | Done | Error (Rejected)"],
  ["PIPELINE OBS",   "Publish Status",     "Pending | Scheduled | Live | Error"],

  // AW-BB: Output
  ["OUTPUT",         "Pipeline Status",    "Master: Pending | Queued | Processing | Rendering | Done | Rejected | Error"],
  ["OUTPUT",         "Worker Job ID",      "BullMQ job ID (auto-filled by worker)"],
  ["OUTPUT",         "Scheduled At",       "ISO timestamp of when job was queued"],
  ["OUTPUT",         "Script (Full)",      "Final narration script (AI-generated)"],
  ["OUTPUT",         "Output Video URL",   "R2 / CDN URL of rendered MP4"],
  ["OUTPUT",         "Drive Link",         "Google Drive share link"],

  // BC-BD: Performance
  ["PERFORMANCE",    "Performance Score",  "Views, saves, engagement rate"],
  ["PERFORMANCE",    "Notes / Errors",     "Error messages and internal pipeline notes"],
];

// Section color map
const SECTION_COLORS = {
  "IDENTITY":      { bg: "#1a1a2e", fg: "#a78bfa" },
  "CORE CONTENT":  { bg: "#1e1b4b", fg: "#818cf8" },
  "CREATOR":       { bg: "#14532d", fg: "#4ade80" },
  "VISUAL":        { bg: "#1c1917", fg: "#fb923c" },
  "STORYBOARD":    { bg: "#0c1445", fg: "#60a5fa" },
  "VEO":           { bg: "#18181b", fg: "#e879f9" },
  "VOICE":         { bg: "#1f2937", fg: "#facc15" },
  "HOOKS":         { bg: "#1a1a2e", fg: "#f472b6" },
  "PIPELINE OBS":  { bg: "#14532d", fg: "#86efac" },
  "OUTPUT":        { bg: "#1e1b4b", fg: "#c7d2fe" },
  "PERFORMANCE":   { bg: "#18181b", fg: "#a1a1aa" },
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    red:   parseInt(result[1], 16) / 255,
    green: parseInt(result[2], 16) / 255,
    blue:  parseInt(result[3], 16) / 255,
  } : { red: 0, green: 0, blue: 0 };
}

function columnLetter(idx) {
  // Convert 0-based index to A, B, ..., Z, AA, AB, ...
  let s = "";
  idx += 1;
  while (idx > 0) {
    idx -= 1;
    s = String.fromCharCode(65 + (idx % 26)) + s;
    idx = Math.floor(idx / 26);
  }
  return s;
}

function setupAdvancedSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Delete old tab if it exists, recreate fresh
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(SHEET_NAME);

  const numCols = COLUMNS.length; // 56

  // Build the 3 header rows
  const sectionRow    = COLUMNS.map(c => c[0]);
  const colNameRow    = COLUMNS.map(c => c[1]);
  const descRow       = COLUMNS.map(c => c[2]);

  // Write all 3 header rows at once
  sheet.getRange(1, 1, 3, numCols).setValues([sectionRow, colNameRow, descRow]);

  // Freeze rows 1-3 and column A
  sheet.setFrozenRows(3);
  sheet.setFrozenColumns(1);

  // ── Format header rows ──────────────────────────────────────────────────────

  // Row 1: Section labels — dark background, colored text per section
  let prevSection = null;
  for (let c = 0; c < numCols; c++) {
    const section = COLUMNS[c][0];
    const colors  = SECTION_COLORS[section] || { bg: "#18181b", fg: "#ffffff" };
    const cell    = sheet.getRange(1, c + 1);
    cell.setBackground(colors.bg)
        .setFontColor(colors.fg)
        .setFontWeight("bold")
        .setFontSize(9)
        .setHorizontalAlignment("center");

    // Merge consecutive cells in the same section
    if (section !== prevSection) prevSection = section;
  }

  // Row 2: Column names — white bold text on dark bg
  for (let c = 0; c < numCols; c++) {
    const section = COLUMNS[c][0];
    const colors  = SECTION_COLORS[section] || { bg: "#18181b", fg: "#ffffff" };
    const bg      = colors.bg;
    sheet.getRange(2, c + 1)
         .setBackground(bg)
         .setFontColor("#ffffff")
         .setFontWeight("bold")
         .setFontSize(10)
         .setWrap(false);
  }

  // Row 3: Descriptions — muted gray text
  sheet.getRange(3, 1, 1, numCols)
       .setBackground("#111827")
       .setFontColor("#6b7280")
       .setFontSize(8)
       .setFontStyle("italic")
       .setWrap(true);

  // ── Row heights ─────────────────────────────────────────────────────────────
  sheet.setRowHeight(1, 24);
  sheet.setRowHeight(2, 28);
  sheet.setRowHeight(3, 40);

  // ── Column widths ───────────────────────────────────────────────────────────
  const WIDE_COLS  = [1, 8, 9, 10, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 27, 28, 34, 38, 50, 51]; // 0-indexed
  const NARROW_COLS = [0, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49]; // 0-indexed

  for (let c = 0; c < numCols; c++) {
    let width = 120;
    if (WIDE_COLS.includes(c))   width = 220;
    if (NARROW_COLS.includes(c)) width = 90;
    sheet.setColumnWidth(c + 1, width);
  }

  // ── Alternating row banding (data rows start at row 4) ──────────────────────
  sheet.getRange(4, 1, 200, numCols)
       .setBackground("#0f172a")
       .setFontColor("#e2e8f0")
       .setFontSize(10);

  // Light alternating band
  for (let r = 4; r <= 200; r += 2) {
    sheet.getRange(r, 1, 1, numCols).setBackground("#1e293b");
  }

  // ── Dropdown validation on key columns ──────────────────────────────────────
  const rule = (values) => SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true).setAllowInvalid(true).build();

  // Core Angle (C = col 3) and Story Arc (F = col 6)
  sheet.getRange(4, 3, 200, 1).setDataValidation(rule(["myth-bust","stat-first","story-arc","problem-first"]));
  sheet.getRange(4, 6, 200, 1).setDataValidation(rule(["myth-bust","stat-first","story-arc","problem-first"]));

  // Hook Strategy (D = col 4)
  sheet.getRange(4, 4, 200, 1).setDataValidation(rule(["question","bold-statement","conflict","promise","shock","story"]));

  // CTA Style (G = col 7)
  sheet.getRange(4, 7, 200, 1).setDataValidation(rule(["follow","save","comment","share"]));

  // Video Style (H = col 8)
  sheet.getRange(4, 8, 200, 1).setDataValidation(rule(["Educational","Motivational","Case Study","Lifestyle","Startup-Focused","Luxury","Cinematic"]));

  // Visual Identity (P = col 16)
  sheet.getRange(4, 16, 200, 1).setDataValidation(rule(["dark-cinematic","bright-minimal","neon-tech","warm-story","high-contrast"]));

  // Pacing Profile (T = col 20)
  sheet.getRange(4, 20, 200, 1).setDataValidation(rule(["fast","medium","slow","dynamic"]));

  // Scene Count (W = col 23)
  sheet.getRange(4, 23, 200, 1).setDataValidation(rule(["3","4","5"]));

  // Motion Intensity (AD = col 30)
  sheet.getRange(4, 30, 200, 1).setDataValidation(rule(["subtle","medium","high"]));

  // Camera Motion (AE = col 31)
  sheet.getRange(4, 31, 200, 1).setDataValidation(rule(["handheld","locked","dolly","tracking"]));

  // Realism Level (AF = col 32)
  sheet.getRange(4, 32, 200, 1).setDataValidation(rule(["ultra-realistic","stylized","documentary"]));

  // UGC Style (AG = col 33)
  sheet.getRange(4, 33, 200, 1).setDataValidation(rule(["creator-pov","documentary","confessional","lifestyle"]));

  // Caption Style (AL = col 38)
  sheet.getRange(4, 38, 200, 1).setDataValidation(rule(["auto","impact","word-by-word","slide-up","pulse"]));

  // Pipeline Status (AW = col 49)
  sheet.getRange(4, 49, 200, 1).setDataValidation(rule(["Pending","Queued","Processing","Rendering","Done","Rejected","Error"]));

  SpreadsheetApp.getUi().alert("✅ Advanced V2 sheet setup complete!\n\nThe sheet now has:\n• 56 columns (A-BD)\n• 3 header rows (labels / names / descriptions)\n• Data starts at row 4\n• Dropdown validation on key columns\n\nYou can now add content rows starting at row 4.");
}
