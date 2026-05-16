/**
 * Re-authorizes Google OAuth2 with Sheets + Drive scope.
 * Writes the new GOOGLE_REFRESH_TOKEN to .env automatically.
 * Run once: node scripts/auth-drive.mjs
 */
import "dotenv/config";
import { OAuth2Client } from "google-auth-library";
import * as http from "http";
import * as fs   from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH  = path.resolve(__dirname, "../.env");

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

const clientId     = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT     = "http://localhost:3333";

if (!clientId || !clientSecret) {
  console.error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env");
  process.exit(1);
}

const oauth2 = new OAuth2Client(clientId, clientSecret, REDIRECT);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent", // force refresh_token even if previously authorized
});

console.log("\n──────────────────────────────────────────────────────");
console.log("OPEN THIS URL IN YOUR BROWSER to authorize Google:");
console.log(authUrl);
console.log("──────────────────────────────────────────────────────\n");
console.log("Waiting for authorization (server on http://localhost:3333)...\n");

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost:3333");
    const c   = url.searchParams.get("code");
    res.end("<h2>Ottoflow authorized ✅ — You can close this tab and return to the terminal.</h2>");
    server.close();
    if (c) resolve(c); else reject(new Error("No code in redirect"));
  });
  server.listen(3333, () => {});
  setTimeout(() => { server.close(); reject(new Error("Auth timeout (5 min)")); }, 300_000);
});

const { tokens } = await oauth2.getToken(code);
const refreshToken = tokens.refresh_token;

if (!refreshToken) {
  console.error("No refresh_token returned. Try revoking app access at https://myaccount.google.com/permissions and re-running.");
  process.exit(1);
}

console.log("New refresh token:", refreshToken);

// Update .env in place
let env = fs.readFileSync(ENV_PATH, "utf8");
if (env.includes("GOOGLE_REFRESH_TOKEN=")) {
  env = env.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
} else {
  env += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
}
fs.writeFileSync(ENV_PATH, env);

console.log("\n✅ GOOGLE_REFRESH_TOKEN updated in .env");
console.log("Drive uploads will now work. Run 'npm run worker' to start rendering.");
