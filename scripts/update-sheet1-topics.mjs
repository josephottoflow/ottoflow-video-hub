/**
 * Replaces all data rows in Sheet1 with 5 fresh Ottoflow topics.
 * Run with: node scripts/update-sheet1-topics.mjs
 */
import "dotenv/config";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
let   SHEET_NAME     = "Content Pipeline"; // will be confirmed from spreadsheet metadata

// ── 5 new Ottoflow topics ──────────────────────────────────────────────────
const NEW_ROWS = [
  // [Topic, Script, Hook A, Hook B, Hook C, Voice, Style, Status]
  [
    "How Ottoflow cuts your workflow time by 80 percent",
    "Most businesses waste 3 hours a day on repetitive tasks. Ottoflow automates them in minutes. Set it up once and it runs forever. Follow for more automation wins.",
    "You're wasting 3 hours every single day",
    "80% of manual work can be automated now",
    "What if your workflow just ran itself?",
    "Female energetic",
    "Educational",
    "Pending",
  ],
  [
    "5 workflows every business should automate right now",
    "If you're still doing these manually, you're losing money. Lead follow-ups. Invoice reminders. Report generation. Onboarding emails. Data entry. Ottoflow handles all five. Save this.",
    "Still doing these 5 tasks by hand?",
    "5 automations that save 10 hours weekly",
    "Your competitors already automated these",
    "Female energetic",
    "Educational",
    "Pending",
  ],
  [
    "Why AI automation is the best hire you will ever make",
    "The best employee never takes a break, never makes typos, and works 24/7 for pennies. That's AI automation. Ottoflow gives your whole team one. Follow to see how.",
    "The employee that never sleeps or fails",
    "AI costs less than one coffee per day",
    "Why top companies automate before they hire",
    "Female energetic",
    "Motivational",
    "Pending",
  ],
  [
    "How to build a no-code automation in under 10 minutes",
    "You don't need a developer to automate your business. Open Ottoflow. Pick a trigger. Connect your apps. Done. Your workflow just went from manual to magic. Try it free.",
    "Build your first automation in 10 minutes",
    "No code. No developer. No problem.",
    "What would you automate first?",
    "Female energetic",
    "startup-focused",
    "Pending",
  ],
  [
    "The hidden cost of manual processes in your business",
    "Manual work isn't just slow, it's expensive. Every data entry error costs you twice. Every delayed response loses a lead. Ottoflow eliminates both. Your team deserves better.",
    "Manual work costs more than you think",
    "One workflow error costs your business 5 hours",
    "What is repetitive work really costing you?",
    "Female energetic",
    "Case Study",
    "Pending",
  ],
];

async function getAuth() {
  const email      = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (email && privateKey) {
    return new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: privateKey },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  // OAuth2 fallback
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    const { OAuth2Client } = await import("google-auth-library");
    const oauth2 = new OAuth2Client(clientId, clientSecret, "http://localhost:3333");
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }

  throw new Error("No Google credentials found. Set service account or OAuth2 vars in .env");
}

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GOOGLE_SPREADSHEET_ID not set in .env");

  const auth   = await getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // 0. List all tabs and find the right one (first tab that is NOT Sheet2/V2)
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const allTabs = meta.data.sheets?.map(s => s.properties?.title).filter(Boolean) || [];
  console.log(`Tabs found: ${allTabs.join(", ")}`);

  // Pick "Content Pipeline" if it exists, else first tab that isn't Sheet2
  const found = allTabs.find(t => t === "Content Pipeline")
    ?? allTabs.find(t => t !== "Sheet2")
    ?? allTabs[0];
  SHEET_NAME = found;
  console.log(`Using tab: "${SHEET_NAME}"`);

  // Also delete the accidental "Sheet1" tab if it was created
  const wrongTab = meta.data.sheets?.find(s => s.properties?.title === "Sheet1");
  if (wrongTab && wrongTab.properties?.sheetId !== undefined) {
    console.log(`Deleting accidental "Sheet1" tab...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ deleteSheet: { sheetId: wrongTab.properties.sheetId } }] },
    });
    console.log(`Deleted "Sheet1" tab.`);
  }

  // 1. Clear all data rows (keep header in row 1)
  console.log(`Clearing ${SHEET_NAME} data rows...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:U1000`,
  });

  // 2. Write new rows starting at A2
  const values = NEW_ROWS;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  console.log(`Done! Wrote ${values.length} rows to ${SHEET_NAME}.`);
  values.forEach((r, i) => console.log(`  Row ${i + 2}: ${r[0]}`));
}

main().catch(err => { console.error(err); process.exit(1); });
