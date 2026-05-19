import "dotenv/config";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";

const VIDEO = "D:/tiktok-product-video-factory/outputs/5-workflows-every-business-should-automate-right-now/5-workflows-every-business-should-automate-right-now.mp4";
const FOLDER = process.env.GOOGLE_DRIVE_OUTPUTS_ID;

function getDrive() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && key) {
    const auth = new google.auth.JWT(email, undefined, key, ["https://www.googleapis.com/auth/drive.file"]);
    return google.drive({ version: "v3", auth });
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new OAuth2Client(clientId, clientSecret, "http://localhost:3333");
    oauth2.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: "v3", auth: oauth2 });
  }
  return null;
}

async function main() {
  const drive = getDrive();
  if (!drive) { console.error("No Google credentials"); process.exit(1); }
  if (!FOLDER) { console.error("GOOGLE_DRIVE_OUTPUTS_ID not set"); process.exit(1); }
  if (!fs.existsSync(VIDEO)) { console.error("Video file not found:", VIDEO); process.exit(1); }

  console.log("Uploading to Drive folder:", FOLDER);
  const res = await drive.files.create({
    requestBody: { name: "5-workflows-every-business-should-automate-right-now.mp4", parents: [FOLDER] },
    media: { mimeType: "video/mp4", body: fs.createReadStream(VIDEO) },
    fields: "id",
  });
  const fileId = res.data.id;
  if (!fileId) throw new Error("No file ID returned");

  await drive.permissions.create({ fileId, requestBody: { role: "reader", type: "anyone" } });
  const url = `https://drive.google.com/file/d/${fileId}/view`;
  console.log("Drive URL:", url);
}

main().catch(e => { console.error("Failed:", e.message); process.exit(1); });
