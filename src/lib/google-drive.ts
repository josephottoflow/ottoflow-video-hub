import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

function getDriveClient() {
  // Prefer service account (private key set)
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && key) {
    const auth = new google.auth.JWT(email, undefined, key, SCOPES);
    return google.drive({ version: "v3", auth });
  }

  // OAuth2 fallback (refresh token set — works without service account key)
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new OAuth2Client(clientId, clientSecret, "http://localhost:3333");
    oauth2.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: "v3", auth: oauth2 });
  }

  return null;
}

export async function uploadVideoToDrive(
  localPath: string,
  fileName:  string
): Promise<string | null> {
  const drive    = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_OUTPUTS_ID;
  if (!drive || !folderId || !fs.existsSync(localPath)) return null;

  try {
    const res = await drive.files.create({
      requestBody: {
        name:    fileName,
        parents: [folderId],
      },
      media: {
        mimeType: "video/mp4",
        body:     fs.createReadStream(localPath),
      },
      fields: "id",
    });

    const fileId = res.data.id;
    if (!fileId) return null;

    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    return `https://drive.google.com/file/d/${fileId}/view`;
  } catch (err) {
    console.warn("[drive] Upload failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
