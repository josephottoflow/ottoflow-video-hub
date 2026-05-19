import "dotenv/config";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

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

async function uploadAndPatch(id, localPath, fileName) {
  const drive    = getDrive();
  const folderId = process.env.GOOGLE_DRIVE_OUTPUTS_ID;
  if (!drive)    { console.log("No Drive credentials"); return; }
  if (!folderId) { console.log("GOOGLE_DRIVE_OUTPUTS_ID not set"); return; }
  if (!fs.existsSync(localPath)) { console.log("File not found:", localPath); return; }

  console.log("Uploading:", fileName);
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: "video/mp4", body: fs.createReadStream(localPath) },
    fields: "id",
  });
  const fileId = res.data.id;
  await drive.permissions.create({ fileId, requestBody: { role: "reader", type: "anyone" } });
  const url = `https://drive.google.com/file/d/${fileId}/view`;
  await pool.query("UPDATE jobs SET output_link = $1 WHERE id = $2", [url, id]);
  console.log("Patched:", url);
}

await uploadAndPatch(
  "c413a168-3c9d-4840-8eff-14da6aace11e",
  "D:/tiktok-product-video-factory/outputs/why-ai-automation-is-the-best-hire-you-will-ever-make/why-ai-automation-is-the-best-hire-you-will-ever-make.mp4",
  "why-ai-automation-is-the-best-hire-you-will-ever-make.mp4"
);
await uploadAndPatch(
  "9dd33071-70a6-4f61-b4aa-b3a855a9de9c",
  "D:/tiktok-product-video-factory/outputs/how-ottoflow-cuts-your-workflow-time-by-80-percent/how-ottoflow-cuts-your-workflow-time-by-80-percent.mp4",
  "how-ottoflow-cuts-your-workflow-time-by-80-percent.mp4"
);

await pool.end();
console.log("Done.");
